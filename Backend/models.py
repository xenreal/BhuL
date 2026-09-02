import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    JSON,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import relationship

from database import Base


# ==========================================
# SQLAlchemy Database Models (SQLite)
# ==========================================

class Document(Base):
    __tablename__ = "documents"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    status = Column(String, default="uploaded", nullable=False)
    image_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    extracted_records = relationship(
        "ExtractedRecord", back_populates="document", cascade="all, delete-orphan"
    )


class ExtractedRecord(Base):
    __tablename__ = "extracted_records"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    document_id = Column(Uuid, ForeignKey("documents.id"), nullable=False)
    landowner_details = Column(JSON, nullable=True)
    survey_number = Column(String, nullable=True)
    khasra_number = Column(String, nullable=True)
    khata_number = Column(String, nullable=True)
    plot_area = Column(JSON, nullable=True)
    village = Column(String, nullable=True)
    tehsil = Column(String, nullable=True)
    district = Column(String, nullable=True)
    land_classification = Column(String, nullable=True)
    ownership_details = Column(JSON, nullable=True)
    field_confidences = Column(JSON, nullable=True)

    # Relationship
    document = relationship("Document", back_populates="extracted_records")


class CorrectionExample(Base):
    __tablename__ = "correction_examples"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    field_name = Column(String, nullable=False)
    wrong_value = Column(Text, nullable=False)
    corrected_value = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


# ==========================================
# Pydantic Schemas for Gemini Structured Output
# ==========================================

class LandownerDetails(BaseModel):
    name: str = Field(
        description="Name of the property owner/khatedar. CRITICAL: Ignore government officials, village chiefs, or patwaris"
    )
    father_name: Optional[str] = Field(
        default=None,
        description="Father's or husband's name of the property owner"
    )
    address: Optional[str] = Field(
        default=None,
        description="Address or residence of the property owner"
    )


class PlotArea(BaseModel):
    value: float = Field(description="Numeric value of the plot area")
    unit: str = Field(description="Unit of measurement, e.g. acre, hectare, bigha, biswa, sq ft, etc.")


class OwnershipDetails(BaseModel):
    ownership_type: Optional[str] = Field(
        default=None,
        description="Type of ownership, e.g. individual, joint, government"
    )
    share: Optional[str] = Field(
        default=None,
        description="Share of ownership, e.g. '1/2', 'full'"
    )
    notes: Optional[str] = Field(
        default=None,
        description="Any additional ownership notes"
    )


class FieldConfidences(BaseModel):
    landowner_details: float = Field(description="Confidence score for landowner_details (0.0 to 1.0)")
    survey_number: float = Field(description="Confidence score for survey_number (0.0 to 1.0)")
    khasra_number: float = Field(description="Confidence score for khasra_number (0.0 to 1.0)")
    khata_number: float = Field(description="Confidence score for khata_number (0.0 to 1.0)")
    plot_area: float = Field(description="Confidence score for plot_area (0.0 to 1.0)")
    village: float = Field(description="Confidence score for village (0.0 to 1.0)")
    tehsil: float = Field(description="Confidence score for tehsil (0.0 to 1.0)")
    district: float = Field(description="Confidence score for district (0.0 to 1.0)")
    land_classification: float = Field(description="Confidence score for land_classification (0.0 to 1.0)")
    ownership_details: float = Field(description="Confidence score for ownership_details (0.0 to 1.0)")


class ExtractedRecordSchema(BaseModel):
    landowner_details: LandownerDetails = Field(
        description="Details of the landowner"
    )
    survey_number: Optional[str] = Field(
        default=None,
        description="South/West style identifier (e.g. Survey Number or Gat Number)"
    )
    khasra_number: Optional[str] = Field(
        default=None,
        description="North/Central style identifier (e.g. Khasra Number)"
    )
    khata_number: Optional[str] = Field(
        default=None,
        description="Owner account number (e.g. Khata, Khewat, Khatauni)"
    )
    plot_area: PlotArea = Field(
        description="Plot area size and unit"
    )
    village: str = Field(
        description="Name of the village (Mauja/Gram)"
    )
    tehsil: str = Field(
        description="Name of the sub-district / tehsil / taluka"
    )
    district: str = Field(
        description="Name of the district / zilla"
    )
    land_classification: Optional[str] = Field(
        default=None,
        description="Classification of the land, e.g. agricultural, residential, irrigated, barren"
    )
    ownership_details: Optional[OwnershipDetails] = Field(
        default=None,
        description="Ownership type and share details if available"
    )
    field_confidences: FieldConfidences = Field(
        description="Confidence scores between 0.0 and 1.0 for each extracted field"
    )
