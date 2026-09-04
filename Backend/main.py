import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from typing import Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from sqlalchemy import String, or_
from sqlalchemy.orm import Session

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ai_service import extract_document_data
from database import get_db, init_db
from models import (
    CorrectionExample,
    Document,
    DocumentStatusEnum,
    ExtractedRecord,
    RegionEnum,
    ValidationResult,
)
from schemas.schemas import CommitRequest
from validation_engine import run_all_validations

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

# Enable CORS for React frontend (localhost:5173, localhost:3000, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images statically so the frontend can render them next to the table
app.mount("/uploaded_images", StaticFiles(directory=str(UPLOAD_DIR)), name="uploaded_images")


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

    # 4. Call Ollama Qwen 2.5 VL extraction with in-context few-shot learning
    try:
        extracted_data = extract_document_data(str(file_path), region=doc.region.value)
    except Exception as exc:
        doc.status = DocumentStatusEnum.flagged
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Document extraction failed: {str(exc)}",
        )

    # 5. Run Validation Rules Engine (Section 7 & 8 of Spec)
    rule_results, ui_fields, overall_status, overall_conf = run_all_validations(
        db=db, doc_id=doc.id, extracted_data=extracted_data
    )

    # 6. Update document status
    doc.status = DocumentStatusEnum(overall_status)
    doc.overall_confidence = overall_conf

    # 7. Save extracted record to database
    record = ExtractedRecord(
        id=uuid.uuid4(),
        document_id=doc.id,
        landowner_details=extracted_data.get("landowner_details"),
        survey_number=extracted_data.get("survey_number"),
        khasra_number=extracted_data.get("khasra_number"),
        khata_number=extracted_data.get("khata_number"),
        khatauni_number=extracted_data.get("khatauni_number"),
        plot_area=extracted_data.get("plot_area"),
        village=extracted_data.get("village"),
        tehsil=extracted_data.get("tehsil"),
        district=extracted_data.get("district"),
        ownership_details=extracted_data.get("ownership_details"),
        field_confidences=extracted_data.get("field_confidences") or {},
        overall_confidence=overall_conf,
    )
    db.add(record)

    # 8. Save validation results to database
    for r in rule_results:
        validation_entry = ValidationResult(
            id=uuid.uuid4(),
            document_id=doc.id,
            rule_name=r["rule_name"],
            passed=r["passed"],
            detail=r.get("detail", ""),
        )
        db.add(validation_entry)

    db.commit()

    # 9. Return Section 2b API Response contract directly powering the UI
    return {
        "document_id": str(doc.id),
        "status": doc.status.value,
        "region": doc.region.value,
        "fields": ui_fields,
        "validation_flags": rule_results,
        "extracted_data": extracted_data,
    }


@app.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Powers the 3 dashboard cards in the UI drawer (Section 2a & 2b of Spec):
    - uploaded_count: Total land documents uploaded to the system
    - committed_count: Documents verified and finalized to the database
    - pending_count: Documents currently flagged or requiring review
    """
    total_uploaded = db.query(Document).count()
    committed_count = db.query(Document).filter(Document.status == DocumentStatusEnum.committed).count()
    flagged_count = db.query(Document).filter(Document.status == DocumentStatusEnum.flagged).count()
    uploaded_only = db.query(Document).filter(Document.status == DocumentStatusEnum.uploaded).count()
    verified_count = db.query(Document).filter(Document.status == DocumentStatusEnum.verified).count()
    failed_count = db.query(Document).filter(Document.status == DocumentStatusEnum.failed).count()

    # Pending: flagged + unreviewed uploads
    pending_count = flagged_count + uploaded_only

    # Average confidence score across all records (normalized to 0.0 - 1.0)
    records = db.query(ExtractedRecord.overall_confidence).filter(ExtractedRecord.overall_confidence.isnot(None)).all()
    avg_conf = 0.0
    if records:
        valid_scores = []
        for r in records:
            score = float(r[0])
            if score > 10.0:
                score = score / 100.0
            elif score > 1.0:
                score = score / 10.0
            valid_scores.append(min(max(score, 0.0), 1.0))
        if valid_scores:
            avg_conf = round(sum(valid_scores) / len(valid_scores), 2)

    return {
        "uploaded_count": total_uploaded,
        "committed_count": committed_count,
        "pending_count": pending_count,
        "verified_count": verified_count,
        "flagged_count": flagged_count,
        "failed_count": failed_count,
        "avg_confidence": avg_conf,
    }


@app.patch("/documents/{document_id}/commit")
def commit_document(
    document_id: str,
    payload: Optional[CommitRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Called when the user clicks 'Commit to Database' on the UI table (Section 2b & 9).
    Accepts human corrections, logs divergences into CorrectionExample for few-shot learning,
    updates ExtractedRecord, and transitions document status to 'committed'.
    """
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UUID format")

    doc = db.query(Document).filter(Document.id == doc_uuid).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    record = db.query(ExtractedRecord).filter(ExtractedRecord.document_id == doc_uuid).first()
    corrections_logged = 0

    if payload and payload.corrections and record:
        for field_name, new_val in payload.corrections.items():
            original_val = None

            # 1. Handle landowner details name
            if field_name == "landowner_details.name":
                owner_dict = dict(record.landowner_details) if isinstance(record.landowner_details, dict) else {}
                original_val = owner_dict.get("name")
                if str(new_val).strip() != str(original_val).strip():
                    owner_dict["name"] = new_val
                    record.landowner_details = owner_dict
                    db.add(CorrectionExample(
                        id=uuid.uuid4(),
                        region=doc.region.value,
                        field_name="landowner_details.name",
                        ocr_snippet="नाम मालिक व एहवाल",
                        wrong_value=str(original_val),
                        corrected_value=str(new_val),
                    ))
                    corrections_logged += 1

            # 2. Handle plot area
            elif field_name in ["plot_area", "plot_area.value"]:
                area_dict = dict(record.plot_area) if isinstance(record.plot_area, dict) else {}
                if isinstance(new_val, dict):
                    original_val = area_dict
                    record.plot_area = new_val
                else:
                    original_val = area_dict.get("value")
                    area_dict["value"] = new_val
                    record.plot_area = area_dict

                if str(new_val).strip() != str(original_val).strip():
                    db.add(CorrectionExample(
                        id=uuid.uuid4(),
                        region=doc.region.value,
                        field_name="plot_area",
                        ocr_snippet="रकबा / Area",
                        wrong_value=str(original_val),
                        corrected_value=str(new_val),
                    ))
                    corrections_logged += 1

            # 3. Handle scalar fields (khasra_number, village, tehsil, district, etc.)
            elif hasattr(record, field_name):
                original_val = getattr(record, field_name)
                if str(new_val).strip() != str(original_val).strip():
                    setattr(record, field_name, new_val)
                    db.add(CorrectionExample(
                        id=uuid.uuid4(),
                        region=doc.region.value,
                        field_name=field_name,
                        ocr_snippet=field_name,
                        wrong_value=str(original_val),
                        corrected_value=str(new_val),
                    ))
                    corrections_logged += 1

    doc.status = DocumentStatusEnum.committed
    db.commit()

    return {
        "document_id": str(doc.id),
        "status": doc.status.value,
        "corrections_logged": corrections_logged,
    }


@app.get("/documents")
def list_documents(
    status_filter: str = None,
    region_filter: str = None,
    db: Session = Depends(get_db),
):
    """List all uploaded documents with status and metadata."""
    query = db.query(Document)
    if status_filter:
        query = query.filter(Document.status == status_filter)
    if region_filter:
        query = query.filter(Document.region == region_filter)

    docs = query.order_by(Document.uploaded_at.desc()).all()
    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "region": d.region.value,
            "status": d.status.value,
            "image_url": f"/uploaded_images/{Path(d.image_path).name}" if d.image_path else None,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]


@app.get("/documents/search")
def search_documents(
    query: str,
    type: str = "all",
    db: Session = Depends(get_db),
):
    """
    Search digitized land records (Section 11a of Spec).
    - type=id: exact or substring match on document_id, khasra_number, or survey_number
    - type=name: substring match on landowner name (works across English and Hindi text)
    - type=place: match on village, tehsil, or district
    - type=all: searches across all fields simultaneously
    """
    clean_q = query.strip()
    if not clean_q:
        return []

    # Join ExtractedRecord with Document
    base_query = db.query(ExtractedRecord, Document).join(
        Document, ExtractedRecord.document_id == Document.id
    )

    filters = []

    # 1. ID Filter
    if type in ["id", "all"]:
        id_filters = [
            ExtractedRecord.khasra_number.ilike(f"%{clean_q}%"),
            ExtractedRecord.survey_number.ilike(f"%{clean_q}%"),
            ExtractedRecord.khata_number.ilike(f"%{clean_q}%"),
            ExtractedRecord.khatauni_number.ilike(f"%{clean_q}%"),
        ]
        try:
            target_uuid = uuid.UUID(clean_q)
            id_filters.append(Document.id == target_uuid)
        except ValueError:
            pass
        if type == "id":
            filters.append(or_(*id_filters))
        else:
            filters.extend(id_filters)

    # 2. Name Filter
    if type in ["name", "all"]:
        name_filter = ExtractedRecord.landowner_details.cast(String).ilike(f"%{clean_q}%")
        filters.append(name_filter)

    # 3. Place Filter
    if type in ["place", "all"]:
        place_filters = [
            ExtractedRecord.village.ilike(f"%{clean_q}%"),
            ExtractedRecord.tehsil.ilike(f"%{clean_q}%"),
            ExtractedRecord.district.ilike(f"%{clean_q}%"),
        ]
        if type == "place":
            filters.append(or_(*place_filters))
        else:
            filters.extend(place_filters)

    if filters:
        base_query = base_query.filter(or_(*filters))

    results = base_query.order_by(Document.uploaded_at.desc()).limit(50).all()

    output = []
    for record, doc in results:
        output.append({
            "document_id": str(doc.id),
            "filename": doc.filename,
            "region": doc.region.value,
            "status": doc.status.value,
            "overall_confidence": record.overall_confidence,
            "landowner_details": record.landowner_details,
            "khasra_number": record.khasra_number,
            "khata_number": record.khata_number,
            "khatauni_number": record.khatauni_number,
            "survey_number": record.survey_number,
            "plot_area": record.plot_area,
            "village": record.village,
            "tehsil": record.tehsil,
            "district": record.district,
            "image_url": f"/uploaded_images/{Path(doc.image_path).name}" if doc.image_path else None,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        })

    return output


@app.get("/documents/{document_id}")
def get_document(document_id: str, db: Session = Depends(get_db)):
    """Fetch complete extraction, flags, and image URL for a document."""
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UUID format")

    doc = db.query(Document).filter(Document.id == doc_uuid).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    record = db.query(ExtractedRecord).filter(ExtractedRecord.document_id == doc_uuid).first()
    validations = db.query(ValidationResult).filter(ValidationResult.document_id == doc_uuid).all()

    extracted_dict = {}
    if record:
        extracted_dict = {
            "landowner_details": record.landowner_details,
            "khasra_number": record.khasra_number,
            "khata_number": record.khata_number,
            "khatauni_number": record.khatauni_number,
            "survey_number": record.survey_number,
            "plot_area": record.plot_area,
            "village": record.village,
            "tehsil": record.tehsil,
            "district": record.district,
            "ownership_details": record.ownership_details,
            "field_confidences": record.field_confidences,
            "overall_confidence": record.overall_confidence,
        }

    confs = (record.field_confidences if record else {}) or {}
    owner_details = (record.landowner_details if record else {}) or {}
    owner_name = owner_details.get("name") if isinstance(owner_details, dict) else None

    raw_fields = [
        ("landowner_details.name", owner_name, confs.get("landowner_details", 0.68)),
        ("khata_number", record.khata_number if record else None, confs.get("khata_number", 0.80)),
        ("khatauni_number", record.khatauni_number if record else None, confs.get("khatauni_number", 0.80)),
        ("khasra_number", record.khasra_number if record else None, confs.get("khasra_number", 0.82)),
        ("plot_area", record.plot_area if record else None, confs.get("plot_area", 0.76)),
        ("village", record.village if record else None, confs.get("village", 0.86)),
        ("tehsil", record.tehsil if record else None, confs.get("tehsil", 0.87)),
        ("district", record.district if record else None, confs.get("district", 0.88)),
    ]
    ui_fields = []
    for f_name, f_val, f_conf in raw_fields:
        is_empty = not f_val or str(f_val).strip().lower() in ("none", "null", "n/a", "")
        conf_val = float(f_conf) if isinstance(f_conf, (int, float)) else 0.75
        ui_fields.append({
            "field_name": f_name,
            "value": f_val,
            "confidence": round(conf_val, 2) if not is_empty else 0.0,
            "status": "confident" if (not is_empty and conf_val >= 0.7) else "unsure",
        })

    return {
        "document_id": str(doc.id),
        "filename": doc.filename,
        "region": doc.region.value,
        "status": doc.status.value,
        "image_url": f"/uploaded_images/{Path(doc.image_path).name}" if doc.image_path else None,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "fields": ui_fields,
        "extracted_data": extracted_dict,
        "validation_flags": [
            {
                "rule_name": v.rule_name,
                "passed": v.passed,
                "detail": v.detail,
            }
            for v in validations
        ],
    }
