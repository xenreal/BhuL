import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ai_service import extract_document_data
from database import get_db, init_db
from models import Document, ExtractedRecord

# Path to local directory for storing uploaded document images
SAMPLE_DOCS_DIR = Path(__file__).resolve().parent / "sample_docs"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure directory exists and SQLite tables are created on startup."""
    SAMPLE_DOCS_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    yield


app = FastAPI(
    title="BhuL - Land Record Digitization API",
    description="Extract structured data from Indian land records using Gemini API",
    lifespan=lifespan,
)


@app.get("/health")
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}


@app.post("/documents/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Accepts a scanned document image, saves it to sample_docs/,
    records the document in SQLite, calls the Gemini API to extract
    structured fields, saves the extraction into ExtractedRecord,
    and returns the document ID along with the extracted JSON.
    """
    # 1. Generate unique filename and save file to sample_docs/
    file_ext = Path(file.filename).suffix if file.filename else ".jpg"
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    saved_path = SAMPLE_DOCS_DIR / unique_filename

    try:
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save document to disk: {str(exc)}",
        )

    # 2. Create Document DB row
    doc = Document(
        id=uuid.uuid4(),
        filename=file.filename or unique_filename,
        status="uploaded",
        image_path=str(saved_path),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 3. Call AI Service to extract structured fields via Gemini
    try:
        extracted_data = extract_document_data(str(saved_path))
    except Exception as exc:
        doc.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Document extraction failed: {str(exc)}",
        )

    # 4. Save returned dictionary into ExtractedRecord table
    record = ExtractedRecord(
        id=uuid.uuid4(),
        document_id=doc.id,
        landowner_details=extracted_data.get("landowner_details"),
        survey_number=extracted_data.get("survey_number"),
        khasra_number=extracted_data.get("khasra_number"),
        khata_number=extracted_data.get("khata_number"),
        plot_area=extracted_data.get("plot_area"),
        village=extracted_data.get("village"),
        tehsil=extracted_data.get("tehsil"),
        district=extracted_data.get("district"),
        land_classification=extracted_data.get("land_classification"),
        ownership_details=extracted_data.get("ownership_details"),
        field_confidences=extracted_data.get("field_confidences"),
    )
    doc.status = "processed"
    db.add(record)
    db.commit()

    # 5. Return document_id and the extracted JSON
    return {
        "document_id": str(doc.id),
        "extracted_data": extracted_data,
    }
