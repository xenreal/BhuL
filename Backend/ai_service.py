import base64
import json
import os
import re
from pathlib import Path
from dotenv import load_dotenv
import httpx
import json_repair

from schemas import ExtractedRecordSchema


def extract_document_data(image_path: str) -> dict:
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
        "You are an expert Indian land revenue records (Jamabandi / ROR / 7/12 / Patta) extraction AI.\n"
        "Extract all structured fields from this document image (in English or Hindi) into the exact JSON schema provided.\n\n"
        "BILINGUAL FIELD EXTRACTION ANCHORS:\n"
        "1. LANDOWNER NAMES:\n"
        "   - Look for 'Name of Owner' / 'Owner Details' / 'नाम मालिक व एहवाल :' / 'नाम मालिक व अहवाल :'.\n"
        "   - All legal property owners are listed under this header, separated by commas.\n"
        "   - Extract all co-owner names as a comma-separated string into landowner_details.name.\n"
        "   - Address: Extract residence/address from this owner line (e.g. 'स्थानिय वासी' or resident village).\n\n"
        "2. KHATA / KHEWAT NUMBER:\n"
        "   - Read the account number from 'Khewat No.' / 'Khatauni No.' / 'खेवट न.' / 'खतौनी नं.' (e.g. '1/1' or '45').\n\n"
        "3. KHASRA PLOT NUMBERS:\n"
        "   - In the table, look at column 'Khasra No.' / 'Survey No.' / 'नाम खसरा हाल'. Extract all distinct plot numbers (e.g. '274, 276, 544').\n\n"
        "4. PLOT AREA (रकबा) & LAND CLASSIFICATION:\n"
        "   - UNIT: Must be a true measurement unit (e.g. 'Kanal-Marla', 'Kanal', 'Acre', 'Hectare', 'Bigha-Biswa', 'बीघा.बि.बि.'). In Punjab/Haryana Jamabandi, hyphenated areas like '5-8' or '14-10' are in 'Kanal-Marla'. NEVER set unit to 'irrigated'.\n"
        "   - VALUE: Extract numeric measurements or total area (e.g. '14-10' or '5-8, 2-10, 3-16, 2-16'). Strip words like 'irrigated' from the value.\n"
        "   - LAND CLASSIFICATION: Words like 'irrigated', 'unirrigated', 'chahi', 'nahri', 'barani', 'धान्नी', 'कुलाहू' belong strictly in 'land_classification', NOT in plot_area!\n\n"
        "5. GEOGRAPHY:\n"
        "   - District: from 'District:' / 'ज़िला:'\n"
        "   - Tehsil: from 'Tehsil:' / 'तहसील:'\n"
        "   - Village: from 'Village:' / 'Mohal:' / 'मोहाल:' / 'मौजा:'\n\n"
        "6. Preserve original script as written on the document (English text as English, Hindi text as Hindi). Never transliterate or invent text."
    )

    user_prompt = (
        "Extract structured land record data from this document image into the JSON schema.\n"
        "Bilingual Instructions:\n"
        "- Landowners: Look for 'Name of Owner' / 'Owner Details' / 'नाम मालिक व एहवाल :'. Extract all co-owner names separated by commas.\n"
        "- Khata Number: Read from 'Khewat No.' / 'Khatauni No.' / 'खेवट न.'.\n"
        "- Khasra Numbers: Read all plot numbers from the 'Khasra No.' / 'नाम खसरा हाल' column.\n"
        "- Plot Area: Set unit to 'Kanal-Marla' (or 'Bigha-Biswa' / 'Acre'). Set value to the numeric area ('14-10' or '5-8, 2-10, 3-16, 2-16'). Put 'irrigated' into 'land_classification'.\n"
        "- Location: Extract District, Tehsil, and Village from their headers.\n\n"
        "Return the extracted data as a valid JSON object matching the schema."
    )

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
            "num_ctx": 8192,
            "num_predict": 2048,
        },
    }

    try:
        with httpx.Client(timeout=180.0) as client:
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
        return json.loads(raw_content)
    except json.JSONDecodeError:
        pass

    # 2. Use json_repair (fixes missing commas, unescaped quotes, unquoted values)
    try:
        repaired = json_repair.repair_json(raw_content, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            return repaired
        if isinstance(repaired, list) and len(repaired) > 0 and isinstance(repaired[0], dict):
            return repaired[0]
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
            return repaired
    except Exception:
        pass

    try:
        return json.loads(text)
    except json.JSONDecodeError as err:
        print(f"\n[AI Service] Raw Content Failed to Parse:\n{raw_content}\n")
        raise ValueError(f"Could not parse AI response into valid JSON: {str(err)}")
