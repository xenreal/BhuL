import json
import mimetypes
import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

from models import ExtractedRecordSchema

# Load environment variables from .env next to this file
load_dotenv(Path(__file__).resolve().parent / ".env")


def get_genai_client() -> genai.Client:
    """Initializes and returns the official Gemini client using the GEMINI_API_KEY."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY environment variable is missing. "
            "Please set GEMINI_API_KEY in your environment or .env file."
        )
    return genai.Client(api_key=api_key)


def extract_document_data(image_path: str) -> dict:
    """
    Extracts structured land record data from an image file using Gemini 1.5 Flash.
    Enforces ExtractedRecordSchema with response_mime_type='application/json'.
    """
    client = get_genai_client()

    file_path = Path(image_path).resolve()
    if not file_path.is_file():
        raise FileNotFoundError(f"Document file not found at: {file_path}")

    # Determine file mime type (fallback to image/jpeg if unknown)
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "image/jpeg"

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    file_part = types.Part.from_bytes(
        data=file_bytes,
        mime_type=mime_type,
    )

    user_prompt = (
        "Extract all land record information from this document into the defined JSON schema. "
        "Thoroughly analyze all columns/tables, and populate field_confidences with a score "
        "between 0.0 and 1.0 for each extracted field."
    )

    system_instruction = (
        "Extract the fields into the defined JSON schema. "
        "DO NOT translate Devanagari (Hindi) or Tamil text into English; "
        "keep the native Unicode script exactly as written."
    )

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=[file_part, user_prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExtractedRecordSchema,
            system_instruction=system_instruction,
        ),
    )

    if not response.text:
        raise ValueError("Gemini API returned an empty response.")

    return json.loads(response.text)

