import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    JSON,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import relationship

from database import Base


class RegionEnum(str, enum.Enum):
    north_central = "north_central"
    west = "west"
    south = "south"
    east = "east"


class DocumentStatusEnum(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    flagged = "flagged"
    verified = "verified"
    committed = "committed"
    failed = "failed"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    region = Column(SQLEnum(RegionEnum, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    status = Column(SQLEnum(DocumentStatusEnum, values_callable=lambda obj: [e.value for e in obj]), default=DocumentStatusEnum.uploaded, nullable=False)
    image_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    extracted_records = relationship("ExtractedRecord", back_populates="document", cascade="all, delete-orphan")
    validation_results = relationship("ValidationResult", back_populates="document", cascade="all, delete-orphan")
    verification_tasks = relationship("VerificationTask", back_populates="document", cascade="all, delete-orphan")


class ExtractedRecord(Base):
    __tablename__ = "extracted_records"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    document_id = Column(Uuid, ForeignKey("documents.id"), nullable=False)
    landowner_details = Column(JSON, nullable=True)
    survey_number = Column(String, nullable=True)
    khasra_number = Column(String, nullable=True)
    khata_number = Column(String, nullable=True)
    khatauni_number = Column(String, nullable=True)
    plot_area = Column(JSON, nullable=True)
    village = Column(String, nullable=True)
    tehsil = Column(String, nullable=True)
    district = Column(String, nullable=True)
    land_classification = Column(String, nullable=True)
    ownership_details = Column(JSON, nullable=True)
    mutation_records = Column(JSON, nullable=True)
    registration_information = Column(JSON, nullable=True)
    field_confidences = Column(JSON, nullable=True)
    overall_confidence = Column(Float, nullable=True)

    # Relationships
    document = relationship("Document", back_populates="extracted_records")


class ValidationResult(Base):
    __tablename__ = "validation_results"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    document_id = Column(Uuid, ForeignKey("documents.id"), nullable=False)
    rule_name = Column(String, nullable=False)
    passed = Column(Boolean, nullable=False)
    detail = Column(Text, nullable=True)

    # Relationships
    document = relationship("Document", back_populates="validation_results")


class VerificationTask(Base):
    __tablename__ = "verification_tasks"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    document_id = Column(Uuid, ForeignKey("documents.id"), nullable=False)
    flagged_fields = Column(JSON, nullable=False)
    corrected_data = Column(JSON, nullable=True)
    resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    document = relationship("Document", back_populates="verification_tasks")


class CorrectionExample(Base):
    __tablename__ = "correction_examples"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    region = Column(String, nullable=False)
    field_name = Column(String, nullable=False)
    ocr_snippet = Column(Text, nullable=False)
    wrong_value = Column(Text, nullable=False)
    corrected_value = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

