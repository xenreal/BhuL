import base64
import json
import os
import re
from pathlib import Path
from dotenv import load_dotenv
import httpx
import json_repair

from schemas import ExtractedRecordSchema


def get_recent_corrections(region: str = "north_central", limit: int = 5) -> str:
    """
    Fetches recent human corrections from SQLite to inject into the VLM extraction prompt
    (Section 9 In-Context Few-Shot Learning).
    Restricted to general formatting and unit lessons to prevent entity names/numbers from leaking across documents.
    """
    try:
        from database import SessionLocal
        from models import CorrectionExample
        with SessionLocal() as db:
            corrections = (
                db.query(CorrectionExample)
                .filter(CorrectionExample.region == region)
                .order_by(CorrectionExample.created_at.desc())
                .limit(limit)
                .all()
            )
            if not corrections:
                return ""

            lines = []
            for c in corrections:
                if c.field_name in ["plot_area.unit", "plot_area.value"]:
                    lines.append(
                        f'- Field "{c.field_name}": do not mistake crop or descriptive text like "{c.wrong_value}" for units; format as "{c.corrected_value}".'
                    )
            if not lines:
                return ""
            return "FORMATTING LESSONS FROM VERIFICATION:\n" + "\n".join(lines)
    except Exception:
        return ""


def sanitize_extracted_record(data: dict) -> dict:
    """
    Sanitizes extracted record to strictly enforce legal revenue conventions:
    1. Landowner names must be the owner, not the cultivator (strips 'Cultivate' prefixes).
    2. Khata & Khatauni: cleans up prefixes and ensures numbers are properly separated.
    3. Plot Area: strips non-numeric words ('irrigated', etc.) and aggregates sub-plots into total holding.
    4. Removes land_classification completely as it is not needed.
    """
    if not isinstance(data, dict):
        return data

    # 1. Landowner Name
    owner_details = data.get("landowner_details")
    if isinstance(owner_details, dict):
        name = owner_details.get("name")
        if isinstance(name, str) and name:
            cleaned_name = re.sub(r"^(?:cultivate|cultivator|काश्तकार)\s*[:\-]?\s*", "", name, flags=re.IGNORECASE).strip()
            owner_details["name"] = cleaned_name

    # 2. Khata & Khatauni separation
    khata = data.get("khata_number")
    khatauni = data.get("khatauni_number")
    if isinstance(khata, str):
        data["khata_number"] = re.sub(r"^(?:khewat|khevat|khata)\s*(?:no\.?|नं\.?)?\s*[:\-]?\s*", "", khata, flags=re.IGNORECASE).strip()
    if isinstance(khatauni, str):
        data["khatauni_number"] = re.sub(r"^(?:khautani|khatauni)\s*(?:no\.?|नं\.?)?\s*[:\-]?\s*", "", khatauni, flags=re.IGNORECASE).strip()

    # 3. Plot Area sanitization
    plot_area = data.get("plot_area")
    if isinstance(plot_area, dict):
        val = plot_area.get("value")
        if val is not None:
            val_str = str(val)
            # Strip crop/soil words
            cleaned_val = re.sub(r"(?i)\b(irrigated|unirrigated|chahi|nahri|barani|sailab|abi|banjar|ghair\s*mumkin|crop|type|area|total|रकबा|सिंचित|असिंचित)\b", "", val_str)
            cleaned_val = re.sub(r"\s+", " ", cleaned_val).strip(" ,;-")
            # Extract all Kanal-Marla pairs and preserve them as comma-separated sub-plot areas
            km_pairs = re.findall(r"\b(\d+)\s*-\s*(\d+)\b", cleaned_val)
            if len(km_pairs) > 1:
                cleaned_val = ", ".join(f"{k}-{m}" for k, m in km_pairs)
            elif len(km_pairs) == 1:
                cleaned_val = f"{km_pairs[0][0]}-{km_pairs[0][1]}"
            plot_area["value"] = cleaned_val

    # 4. Remove land_classification completely
    data.pop("land_classification", None)

    return data


def extract_document_data(image_path: str, region: str = "north_central") -> dict:
    """
    Extracts structured land record data from an image using a local Qwen 2.5 VL
    model served via Ollama. Guarantees JSON output adhering to ExtractedRecordSchema.
    """
    # Always re-read .env dynamically so model/URL changes apply immediately
    env_path = Path(__file__).resolve().parent / ".env"
    load_dotenv(env_path, override=True)

    model_name = os.getenv("OLLAMA_MODEL", "qwen2.5vl:7b")
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    print(f"\n[AI Service] === Processing with Ollama model: '{model_name}' at '{base_url}' ===")

    file_path = Path(image_path).resolve()
    if not file_path.is_file():
        raise FileNotFoundError(f"Document file not found at: {file_path}")

    # Read and encode image as base64 for Ollama Vision API
    with open(file_path, "rb") as f:
        image_bytes = f.read()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    # Get JSON schema from the Pydantic model
    schema = ExtractedRecordSchema.model_json_schema()

    system_instruction = (
        "You are an expert Indian land revenue records (Jamabandi / RoR / 7/12 / Patta) extraction AI.\n"
        "Extract all structured fields from this document image (in English or Hindi) into the exact JSON schema provided.\n"
        "Rely SOLELY on the visible text printed in this specific document image. Never make up or reuse data from other documents.\n\n"
        "COLUMN MAPPING & EXTRACTION RULES:\n"
        "1. LANDOWNER NAMES (CRITICAL: EXTRACT OWNER, NEVER CULTIVATOR):\n"
        "   - Look at Column 4: 'Name of the owner and detail' / 'Name of the owner and address' / 'नाम मालिक व एहवाल'. THIS CONTAINS THE LEGAL LANDOWNER(S).\n"
        "   - Extract ONLY the legal owners into landowner_details.name. In Hindi documents, owner names appear before 'पुत्र' or 'पुत्रान'.\n"
        "   - STRICTLY AVOID Column 5: 'Name & Detail of the Person who cultivates the land' / 'नाम काश्तकार'. Cultivators/tenants (entries starting with 'Cultivate ...' or 'काश्तकार') are NOT owners. NEVER put cultivator names into landowner_details.name.\n"
        "   - Exclude relation prefixes ('son of', 'पुत्र'), shares, and addresses from the name string itself.\n"
        "   - If fractional shares are stated in the owner column, extract them into ownership_details.share.\n\n"
        "2. KHATA / KHEWAT NUMBER vs KHATAUNI NUMBER:\n"
        "   - KHATA / KHEWAT NUMBER: Look at Column 1 ('Khewat No.' / 'Khevat No.' / 'खेवट नं'). This is the proprietary owner holding number.\n"
        "   - KHATAUNI NUMBER: Look at Column 2 ('Khatauni No.' / 'Khautani No.' / 'खतौनी नं'). This is the cultivator holding number. Extract all holding numbers listed down Column 2, separated by commas. Never leave empty if numbers are visible in Column 2.\n"
        "   - Never mix up Column 1 (Khewat) and Column 2 (Khatauni).\n\n"
        "3. KHASRA PLOT NUMBERS:\n"
        "   - Look at Column 7: 'Khasra Number' / 'Survey No.' / 'नाम खसरा हाल'. Extract all plot numbers listed in the table, separated by commas.\n\n"
        "4. PLOT AREA (रकबा):\n"
        "   - Look at Column 8: 'Total of every field Area and Type of Crop' / 'रकबा व किस्म ज़मीन'.\n"
        "   - Extract all distinct sub-plot area measurements, separated by commas. Do NOT sum them into a single total if individual sub-plots are listed.\n"
        "   - Strip all descriptive non-numeric soil/crop words (such as 'irrigated', 'unirrigated', 'chahi', 'nahri', 'barani', 'रकबा', 'सिंचित', 'असिंचित').\n"
        "   - Determine the measurement unit as printed on the document (e.g. 'Kanal-Marla', 'Bigha-Biswa', 'Acre', 'Hectare').\n\n"
        "5. GEOGRAPHY / LOCATION:\n"
        "   - Extract District, Tehsil, and Village from the document header / top section.\n\n"
        "6. SCRIPT & FIDELITY:\n"
        "   - Preserve original script (English as English, Hindi as Hindi). Never transliterate names or invent text."
    )

    user_prompt = (
        "Extract structured land record data from this document image into the JSON schema based SOLELY on the visible text in THIS image:\n"
        "1. Landowner Details: Extract ONLY the legal owner name(s) from Column 4 ('Name of the owner and detail' / 'नाम मालिक व एहवाल'). Never extract cultivator/tenant names from Column 5 ('Name & Detail of the Person who cultivates' / 'नाम काश्तकार').\n"
        "2. Khata / Khewat Number: Extract the owner account number strictly from Column 1 ('Khewat / Khevat No.').\n"
        "3. Khatauni Number: Extract all cultivator holding numbers strictly from Column 2 ('Khatauni / Khautani No.'), comma-separated.\n"
        "4. Khasra Numbers: Extract all plot/survey numbers from Column 7 ('Khasra No.'), comma-separated.\n"
        "5. Plot Area: Extract area measurement(s) from Column 8 ('Area / रकबा'). If multiple sub-plot areas are listed, separate them with commas. Strip any crop or soil words like 'irrigated', 'unirrigated', etc. Set the measurement unit as specified on the document (e.g. 'Kanal-Marla', 'Bigha-Biswa', 'Acre', etc.).\n"
        "6. Location: Extract Village, Tehsil, and District from the document header text.\n"
        "7. Ownership Details: Extract fractional shares if written in the owner column into 'ownership_details.share'.\n\n"
        "Return strictly valid JSON matching the schema with data from this document only. Do not hallucinate or use values from other records."
    )

    # In-context few-shot learning from past human corrections (Section 9)
    past_corrections = get_recent_corrections(region=region, limit=5)
    if past_corrections:
        user_prompt += f"\n\n{past_corrections}\n"

    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "system",
                "content": system_instruction,
            },
            {
                "role": "user",
                "content": user_prompt,
                "images": [image_b64],
            },
        ],
        "format": schema,
        "stream": False,
        "options": {
            "temperature": 0.0,
            "num_ctx": 6144,
            "num_predict": 2048,
        },
    }

    try:
        with httpx.Client(timeout=300.0) as client:
            response = client.post(f"{base_url}/api/chat", json=payload)
            response.raise_for_status()
            result = response.json()
    except httpx.ConnectError:
        raise ConnectionError(
            f"Could not connect to Ollama at {base_url}. "
            "Please ensure Ollama is installed and running."
        )
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"Ollama returned error status {exc.response.status_code}: {exc.response.text}")

    raw_content = result.get("message", {}).get("content", "").strip()
    if not raw_content:
        raise ValueError("Ollama returned an empty response.")

    # 1. Try direct parse
    try:
        return sanitize_extracted_record(json.loads(raw_content))
    except json.JSONDecodeError:
        pass

    # 2. Use json_repair (fixes missing commas, unescaped quotes, unquoted values)
    try:
        repaired = json_repair.repair_json(raw_content, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            return sanitize_extracted_record(repaired)
        if isinstance(repaired, list) and len(repaired) > 0 and isinstance(repaired[0], dict):
            return sanitize_extracted_record(repaired[0])
    except Exception:
        pass

    # 3. Fallback to extracting substring between first { and last }
    text = raw_content
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace : last_brace + 1]

    # Auto-repair unquoted fractions (1/1) and hyphenated numbers (18-10-05)
    text = re.sub(r':\s*([0-9]+/[0-9]+)\s*([,}])', r': "\1"\2', text)
    text = re.sub(r':\s*([0-9]+-[0-9]+(?:-[0-9]+)*)\s*([,}])', r': "\1"\2', text)
    text = re.sub(r',\s*([}\]])', r'\1', text)

    try:
        repaired = json_repair.repair_json(text, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            return sanitize_extracted_record(repaired)
    except Exception:
        pass

    try:
        return sanitize_extracted_record(json.loads(text))
    except json.JSONDecodeError as err:
        print(f"\n[AI Service] Raw Content Failed to Parse:\n{raw_content}\n")
        raise ValueError(f"Could not parse AI response into valid JSON: {str(err)}")
