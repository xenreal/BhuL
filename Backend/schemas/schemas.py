from typing import Any, Dict, Optional, Union
from pydantic import BaseModel, Field


class LandownerDetails(BaseModel):
    name: Optional[str] = Field(
        default=None,
        description="All co-owner names exactly as listed under the Owner column ('नाम मालिक व एहवाल' / 'Name of the owner and detail'), separated by commas. Never extract cultivators."
    )
    address: Optional[str] = Field(
        default=None,
        description="Address or residence of the property owner if stated"
    )


class PlotArea(BaseModel):
    value: Union[float, str] = Field(
        description="List of distinct sub-plot areas or total area as printed in the Area column, separated by commas. Strip all words like 'irrigated'. If missing, set to 'N/A'"
    )
    unit: str = Field(
        description="Measurement unit as stated in the document (e.g. 'Kanal-Marla', 'Bigha-Biswa', 'Acre', 'Hectare'). Do not include descriptive words"
    )


class OwnershipDetails(BaseModel):
    ownership_type: Optional[str] = Field(
        default=None,
        description="Type of ownership, e.g. individual, joint, government"
    )
    share: Optional[str] = Field(
        default=None,
        description="Share of ownership if stated, e.g. '1/2', '1/18 share, Left equal share 17/18 share'"
    )
    notes: Optional[str] = Field(
        default=None,
        description="Any additional ownership notes"
    )


class FieldConfidences(BaseModel):
    landowner_details: float = Field(default=0.9, description="Confidence score for landowner_details (0.0 to 1.0)")
    survey_number: float = Field(default=0.9, description="Confidence score for survey_number (0.0 to 1.0)")
    khasra_number: float = Field(default=0.9, description="Confidence score for khasra_number (0.0 to 1.0)")
    khata_number: float = Field(default=0.9, description="Confidence score for khata_number (0.0 to 1.0)")
    khatauni_number: float = Field(default=0.9, description="Confidence score for khatauni_number (0.0 to 1.0)")
    plot_area: float = Field(default=0.9, description="Confidence score for plot_area (0.0 to 1.0)")
    village: float = Field(default=0.9, description="Confidence score for village (0.0 to 1.0)")
    tehsil: float = Field(default=0.9, description="Confidence score for tehsil (0.0 to 1.0)")
    district: float = Field(default=0.9, description="Confidence score for district (0.0 to 1.0)")
    ownership_details: float = Field(default=0.9, description="Confidence score for ownership_details (0.0 to 1.0)")


class ExtractedRecordSchema(BaseModel):
    landowner_details: LandownerDetails = Field(
        description="Details of the legal landowner"
    )
    khata_number: str = Field(
        description="Owner account number strictly from Column 1 ('Khevat No.' / 'Khewat No.' / 'खेवट नं'). Do NOT read from Khatauni column."
    )
    khatauni_number: str = Field(
        description="All cultivator holding account numbers strictly from Column 2 ('Khautani No.' / 'Khatauni No.' / 'खतौनी नं'). Extract all numbers listed in Column 2, comma-separated. If missing, set to 'N/A'"
    )
    khasra_number: str = Field(
        description="All Khasra / Survey plot numbers listed in the table, comma-separated. If missing, set to 'N/A'"
    )
    survey_number: Optional[str] = Field(
        default=None,
        description="Survey number or identifier if applicable"
    )
    village: str = Field(
        description="Name of the village / mohal / mauza as written on the document. If missing, set to 'N/A'"
    )
    tehsil: str = Field(
        description="Name of the sub-district / tehsil / taluka as written on the document. If missing, set to 'N/A'"
    )
    district: str = Field(
        description="Name of the district / zilla as written on the document. If missing, set to 'N/A'"
    )
    plot_area: PlotArea = Field(
        description="Plot area size and unit"
    )
    ownership_details: Optional[OwnershipDetails] = Field(
        default=None,
        description="Ownership type and share details if available"
    )
    field_confidences: Optional[FieldConfidences] = Field(
        default_factory=FieldConfidences,
        description="Confidence scores between 0.0 and 1.0 for each extracted field"
    )


class CommitRequest(BaseModel):
    corrections: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Human verification corrections: e.g. {'landowner_details.name': 'मोहोर सिंह'}"
    )

