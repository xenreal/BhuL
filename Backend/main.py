import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ai_service import extract_document_data
from database import get_db, init_db
from models import Document, DocumentStatusEnum, ExtractedRecord, RegionEnum

# Ensure upload directory exists
UPLOAD_DIR = Path(__file__).resolve().parent / "uploaded_images"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    yield


app = FastAPI(
    title="BhuLekh Land Record Digitization API",
    description="Extracts structured data from Indian land records using local Qwen 2.5 VL via Ollama",
    lifespan=lifespan,
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/documents/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    region: str = Form(default="north_central"),
    db: Session = Depends(get_db),
):
    """
    Accepts a scanned land record document, streams it safely to disk,
    runs OCR and field extraction through Qwen 2.5 VL, records both
    the document metadata and extracted records into SQLite, and returns
    the extracted JSON.
    """
    # 1. Save uploaded file to disk with unique UUID filename
    file_ext = Path(file.filename).suffix if file.filename else ".jpg"
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save document to disk: {str(exc)}",
        )

    # 2. Validate region enum
    try:
        region_enum = RegionEnum(region.lower())
    except ValueError:
        region_enum = RegionEnum.north_central

    # 3. Create Document DB entry
    doc = Document(
        id=uuid.uuid4(),
        filename=file.filename or unique_filename,
        region=region_enum,
        status=DocumentStatusEnum.processing,
        image_path=str(file_path),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 4. Call Ollama Qwen 2.5 VL extraction
    try:
        extracted_data = extract_document_data(str(file_path))
    except Exception as exc:
        doc.status = DocumentStatusEnum.flagged
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Document extraction failed: {str(exc)}",
        )

    # 5. Compute overall confidence score
    field_confs = extracted_data.get("field_confidences", {})
    overall_conf = 0.9
    if isinstance(field_confs, dict) and field_confs:
        scores = [float(v) for v in field_confs.values() if isinstance(v, (int, float))]
        if scores:
            overall_conf = round(sum(scores) / len(scores), 2)

    # 6. Flag or verify document based on 0.65 threshold (spec Section 8)
    doc.status = (
        DocumentStatusEnum.verified
        if overall_conf >= 0.65
        else DocumentStatusEnum.flagged
    )

    # 7. Save extracted record to database
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
        field_confidences=field_confs,
        overall_confidence=overall_conf,
    )
    db.add(record)
    db.commit()

    return {
        "document_id": str(doc.id),
        "status": doc.status.value,
        "region": doc.region.value,
        "extracted_data": extracted_data,
    }
