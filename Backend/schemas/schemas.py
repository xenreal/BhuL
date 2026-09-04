from typing import Any, Dict, Optional, Union
from pydantic import BaseModel, Field


class LandownerDetails(BaseModel):
    name: Optional[str] = Field(
        default=None,
        description="All co-owner names exactly as listed under 'नाम मालिक व एहवाल' / 'Name of Owner', separated by commas"
    )
    address: Optional[str] = Field(
        default=None,
        description="Address or residence of the property owner (e.g. 'स्थानिय वासी')"
    )


class PlotArea(BaseModel):
    value: Union[float, str] = Field(
        description="Comma-separated list of distinct sub-plot areas (e.g. '5-13, 2-0, 2-0, 12-7'). Do NOT sum into a single total. Strip all words like 'irrigated'. If missing, set to 'N/A'"
    )
    unit: str = Field(
        description="Specific measurement unit (e.g. 'Kanal-Marla' or 'बीघा.बि.बि.' or 'Acre'). NEVER include options or parentheses"
    )


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
        description="Details of the landowner"
    )
    khata_number: str = Field(
        description="Owner account number strictly from Column 1 ('Khevat No.' / 'Khewat No.' / 'खेवट नं', e.g. '4' or '1/1'). Do NOT read from Khautani."
    )
    khatauni_number: str = Field(
        description="All cultivator holding account numbers strictly from Column 2 ('Khautani No.' / 'खतौनी नं', e.g. '7, 8, 10, 13'). Extract all numbers listed down Column 2, comma-separated. If missing, set to 'N/A'"
    )
    khasra_number: str = Field(
        description="All Khasra plot numbers listed in the table, comma-separated (e.g. '247// 1, 2, 9/1, 10/1' or '274, 276, 544'). If missing, set to 'N/A'"
    )
    survey_number: Optional[str] = Field(
        default=None,
        description="South/West style identifier (e.g. Survey Number or Gat Number)"
    )
    village: str = Field(
        description="Name of the village / Mohal (e.g. 'Deon' or 'अणु'). If missing, set to 'N/A'"
    )
    tehsil: str = Field(
        description="Name of the sub-district / tehsil / taluka (e.g. 'Bathinda' or 'बल्ह'). If missing, set to 'N/A'"
    )
    district: str = Field(
        description="Name of the district / zilla (e.g. 'Bathinda' or 'मण्डी'). If missing, set to 'N/A'"
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

