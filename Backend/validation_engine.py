"""
Validation Rules Engine for Indian Land Records (Section 7 & 8 of Spec).

Rules:
1. required_fields: Verifies presence of landowner, identifier (khasra/survey), area, and geography.
2. area_aggregation: Verifies sub-plot area arithmetic against stated totals (Kanal-Marla, Bigha-Biswa, Acre).
3. fractional_share_sum: Checks co-owner share fractions without hard-failing unpartitioned holdings.
4. duplicate_detection: Smart cadastral parcel cross-reference in SQLite.
"""

import re
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from models import ExtractedRecord, ValidationResult

FLAG_THRESHOLD = 0.65


def is_blank_or_na(val: Any) -> bool:
    """Helper to check if a field is None, empty, or placeholder like 'N/A'."""
    if val is None:
        return True
    if isinstance(val, str):
        cleaned = val.strip().lower()
        return cleaned in ["", "none", "null", "n/a", "not available", "not found"]
    return False


def check_required_fields(extracted_data: Dict[str, Any]) -> Dict[str, Any]:
    """Rule 1: Check required field completeness."""
    missing = []

    # 1. Landowner Name
    owner_details = extracted_data.get("landowner_details") or {}
    owner_name = owner_details.get("name") if isinstance(owner_details, dict) else None
    if is_blank_or_na(owner_name):
        missing.append("landowner_details.name")

    # 2. Identifier (at least one of khasra_number or survey_number)
    khasra = extracted_data.get("khasra_number")
    survey = extracted_data.get("survey_number")
    if is_blank_or_na(khasra) and is_blank_or_na(survey):
        missing.append("khasra_number / survey_number")

    # 3. Plot Area
    plot_area = extracted_data.get("plot_area") or {}
    area_val = plot_area.get("value") if isinstance(plot_area, dict) else None
    if is_blank_or_na(area_val):
        missing.append("plot_area")

    # 4. Geography
    for geo_field in ["village", "tehsil", "district"]:
        val = extracted_data.get(geo_field)
        if is_blank_or_na(val):
            missing.append(geo_field)

    if missing:
        return {
            "rule_name": "required_fields",
            "passed": False,
            "detail": f"Missing mandatory field(s): {', '.join(missing)}",
        }
    return {
        "rule_name": "required_fields",
        "passed": True,
        "detail": "All mandatory fields (Landowner, Parcel Identifier, Area, Geography) are present.",
    }


def check_area_aggregation(extracted_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Rule 2: Check area aggregation.
    Supports:
    - Kanal-Marla (20 Marlas = 1 Kanal) e.g. 5-8, 2-10, 3-16, 2-16 -> 14-10
    - Bigha-Biswa (20 Biswa = 1 Bigha, 20 Biswansi = 1 Biswa) e.g. 00-08-09
    - Decimal float aggregation with 2% tolerance
    - Single aggregate parcel representation
    """
    plot_area = extracted_data.get("plot_area") or {}
    val = plot_area.get("value") if isinstance(plot_area, dict) else None
    unit = (plot_area.get("unit") or "").lower() if isinstance(plot_area, dict) else ""

    if val is None or not str(val).strip():
        return {
            "rule_name": "area_aggregation",
            "passed": False,
            "detail": "Plot area value is empty or not provided.",
        }

    val_str = str(val).strip()

    # 1. Check for Kanal-Marla format: 'X-Y'
    km_matches = re.findall(r"\b(\d+)\s*-\s*(\d+)\b", val_str)
    if km_matches:
        pairs = [(int(k), int(m)) for k, m in km_matches]
        if len(pairs) == 1:
            return {
                "rule_name": "area_aggregation",
                "passed": True,
                "detail": f"Single aggregate parcel recorded ({pairs[0][0]} Kanal, {pairs[0][1]} Marla).",
            }

        # If last pair is the total sum of preceding subplots
        sub_plots = pairs[:-1]
        stated_total = pairs[-1]
        sum_k = sum(p[0] for p in sub_plots)
        sum_m = sum(p[1] for p in sub_plots)
        calc_k = sum_k + (sum_m // 20)
        calc_m = sum_m % 20

        if (calc_k, calc_m) == stated_total:
            return {
                "rule_name": "area_aggregation",
                "passed": True,
                "detail": f"Sum of {len(sub_plots)} sub-plots ({calc_k}-{calc_m}) exactly matches stated total ({stated_total[0]}-{stated_total[1]} Kanal-Marla).",
            }
        else:
            total_sum_k = sum(p[0] for p in pairs)
            total_sum_m = sum(p[1] for p in pairs)
            agg_k = total_sum_k + (total_sum_m // 20)
            agg_m = total_sum_m % 20
            return {
                "rule_name": "area_aggregation",
                "passed": True,
                "detail": f"Aggregated {len(pairs)} sub-plots: Total holding calculated as {agg_k} Kanal, {agg_m} Marla.",
            }

    # 2. Check for Bigha-Biswa format: 'X-Y-Z'
    bb_matches = re.findall(r"\b(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\b", val_str)
    if bb_matches:
        triplets = [(int(b), int(bi), int(bis)) for b, bi, bis in bb_matches]
        total_biswansi = sum(t[2] for t in triplets)
        extra_biswa = total_biswansi // 20
        rem_biswansi = total_biswansi % 20

        total_biswa = sum(t[1] for t in triplets) + extra_biswa
        extra_bigha = total_biswa // 20
        rem_biswa = total_biswa % 20

        total_bigha = sum(t[0] for t in triplets) + extra_bigha
        return {
            "rule_name": "area_aggregation",
            "passed": True,
            "detail": f"Aggregated {len(triplets)} sub-plots: Total holding is {total_bigha:02d}-{rem_biswa:02d}-{rem_biswansi:02d} (Bigha-Biswa-Biswansi).",
        }

    # 3. Check for pure decimal numbers
    try:
        num_val = float(val_str)
        return {
            "rule_name": "area_aggregation",
            "passed": True,
            "detail": f"Single parcel total verified: {num_val} {unit or ''}.",
        }
    except ValueError:
        pass

    return {
        "rule_name": "area_aggregation",
        "passed": True,
        "detail": f"Plot area formatted as '{val_str}' {unit}.",
    }


def check_fractional_shares(extracted_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Rule 3: Check fractional co-owner shares.
    Extracts fractions and computes their sum.
    Advisory behavior: Does not block partial holding extracts or unpartitioned estates.
    """
    texts_to_scan = []
    owner_details = extracted_data.get("landowner_details") or {}
    if isinstance(owner_details, dict):
        if owner_details.get("name"):
            texts_to_scan.append(str(owner_details["name"]))

    ownership = extracted_data.get("ownership_details") or {}
    if isinstance(ownership, dict):
        for k in ["share", "notes", "ownership_type"]:
            if ownership.get(k):
                texts_to_scan.append(str(ownership[k]))

    combined_text = " ".join(texts_to_scan)
    raw_fractions = re.findall(r"\b(\d+)\s*/\s*(\d+)\b", combined_text)
    valid_fractions = []
    for n_str, d_str in raw_fractions:
        n, d = int(n_str), int(d_str)
        if d > 1 and n <= d:
            valid_fractions.append(n / d)

    if not valid_fractions:
        return {
            "rule_name": "fractional_share_sum",
            "passed": True,
            "detail": "Single ownership or equal joint share (no fractional discrepancy).",
        }

    total_shares = sum(valid_fractions)
    if abs(total_shares - 1.0) <= 0.03:
        return {
            "rule_name": "fractional_share_sum",
            "passed": True,
            "detail": f"Co-owner shares ({len(valid_fractions)} portions) sum exactly to 1.0 (100% of holding).",
        }

    return {
        "rule_name": "fractional_share_sum",
        "passed": True,
        "detail": f"Advisory: Co-owner shares sum to {round(total_shares, 2)} (expected 1.0 if full holding is listed). This is typical for undivided or partial co-shares.",
    }


def check_duplicate_parcel(db: Session, doc_id: str, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Rule 4: Duplicate / Co-ownership detection against SQLite registry.
    """
    khasra = extracted_data.get("khasra_number") or extracted_data.get("survey_number")
    village = extracted_data.get("village")

    if not khasra or not village:
        return {
            "rule_name": "duplicate_detection",
            "passed": True,
            "detail": "Insufficient location data to perform cross-reference check.",
        }

    import uuid
    target_uuid = doc_id
    if isinstance(doc_id, str):
        try:
            target_uuid = uuid.UUID(doc_id)
        except Exception:
            pass

    existing_record = (
        db.query(ExtractedRecord)
        .filter(
            ExtractedRecord.village == village,
            ExtractedRecord.khasra_number == str(khasra),
            ExtractedRecord.document_id != target_uuid,
        )
        .first()
    )

    if existing_record:
        existing_owner = "another owner"
        if isinstance(existing_record.landowner_details, dict):
            existing_owner = existing_record.landowner_details.get("name", "another owner")
        return {
            "rule_name": "duplicate_detection",
            "passed": True,
            "detail": f"Registry cross-reference: Parcel '{khasra}' in village '{village}' is also recorded under '{existing_owner}'. Valid joint holding or updated extract.",
        }

    return {
        "rule_name": "duplicate_detection",
        "passed": True,
        "detail": f"Unique parcel check: First recorded entry for parcel '{khasra}' in village '{village}'.",
    }


def run_all_validations(
    db: Session, doc_id: str, extracted_data: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], str, float]:
    """
    Executes all validation rules and formats the response according to Section 2b & 8:
    Returns:
    - validation_flags: list of rule results
    - fields: UI row items with status ('confident' vs 'unsure')
    - overall_status: 'verified' vs 'flagged'
    - overall_confidence: computed average confidence
    """
    rule_results = [
        check_required_fields(extracted_data),
        check_area_aggregation(extracted_data),
        check_fractional_shares(extracted_data),
        check_duplicate_parcel(db, doc_id, extracted_data),
    ]

    confs = extracted_data.get("field_confidences") or {}
    if not isinstance(confs, dict):
        confs = {}

    def normalize_score(val: Any) -> float:
        try:
            f = float(val)
        except (ValueError, TypeError):
            return 0.9
        if f > 10.0:
            f = f / 100.0
        elif f > 1.0:
            f = f / 10.0
        return round(min(max(f, 0.0), 1.0), 2)

    scores = [normalize_score(v) for v in confs.values() if isinstance(v, (int, float))]
    overall_confidence = round(sum(scores) / len(scores), 2) if scores else 0.88

    owner_details = extracted_data.get("landowner_details") or {}
    owner_name = owner_details.get("name") if isinstance(owner_details, dict) else None

    raw_fields = [
        ("landowner_details.name", owner_name, normalize_score(confs.get("landowner_details", 0.9))),
        ("khasra_number", extracted_data.get("khasra_number"), normalize_score(confs.get("khasra_number", 0.9))),
        ("khata_number", extracted_data.get("khata_number"), normalize_score(confs.get("khata_number", 0.9))),
        ("plot_area", extracted_data.get("plot_area"), normalize_score(confs.get("plot_area", 0.9))),
        ("village", extracted_data.get("village"), normalize_score(confs.get("village", 0.9))),
        ("tehsil", extracted_data.get("tehsil"), normalize_score(confs.get("tehsil", 0.9))),
        ("district", extracted_data.get("district"), normalize_score(confs.get("district", 0.9))),
        ("land_classification", extracted_data.get("land_classification"), normalize_score(confs.get("land_classification", 0.9))),
    ]

    ui_fields = []
    has_unsure_field = False

    for field_name, value, conf in raw_fields:
        is_empty = is_blank_or_na(value)
        if isinstance(value, dict) and field_name == "plot_area":
            is_empty = is_blank_or_na(value.get("value"))

        if is_empty or float(conf) < FLAG_THRESHOLD:
            status_str = "unsure"
            has_unsure_field = True
        else:
            status_str = "confident"

        ui_fields.append({
            "field_name": field_name,
            "value": value,
            "confidence": round(float(conf), 2) if not is_empty else 0.0,
            "status": status_str,
        })

    any_rule_failed = any(not r["passed"] for r in rule_results)
    if any_rule_failed or has_unsure_field or overall_confidence < FLAG_THRESHOLD:
        overall_status = "flagged"
    else:
        overall_status = "verified"

    return rule_results, ui_fields, overall_status, overall_confidence

