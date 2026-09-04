import os
from pathlib import Path
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Anchor database file to Backend directory so it is consistent regardless of execution CWD
DB_PATH = Path(__file__).resolve().parent / "bhulekh.db"
DEFAULT_DB_URL = f"sqlite:///{DB_PATH}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Automatically add missing columns if SQLite database was created under an older schema
    try:
        inspector = inspect(engine)
        if "documents" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("documents")]
            with engine.begin() as conn:
                if "region" not in columns:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN region VARCHAR DEFAULT 'north_central'"))
                if "status" not in columns:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN status VARCHAR DEFAULT 'uploaded'"))
                if "image_path" not in columns:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN image_path VARCHAR DEFAULT ''"))
        if "extracted_records" in inspector.get_table_names():
            columns_er = [c["name"] for c in inspector.get_columns("extracted_records")]
            with engine.begin() as conn:
                if "khatauni_number" not in columns_er:
                    conn.execute(text("ALTER TABLE extracted_records ADD COLUMN khatauni_number VARCHAR"))
                if "overall_confidence" not in columns_er:
                    conn.execute(text("ALTER TABLE extracted_records ADD COLUMN overall_confidence FLOAT DEFAULT 0.9"))
                if "land_classification" not in columns_er:
                    conn.execute(text("ALTER TABLE extracted_records ADD COLUMN land_classification VARCHAR"))
                if "ownership_details" not in columns_er:
                    conn.execute(text("ALTER TABLE extracted_records ADD COLUMN ownership_details JSON"))
                if "mutation_records" not in columns_er:
                    conn.execute(text("ALTER TABLE extracted_records ADD COLUMN mutation_records JSON"))
                if "registration_information" not in columns_er:
                    conn.execute(text("ALTER TABLE extracted_records ADD COLUMN registration_information JSON"))
                # Clean up legacy confidence values stored on 1-10 or 1-100 scales
                conn.execute(text("UPDATE extracted_records SET overall_confidence = overall_confidence / 10.0 WHERE overall_confidence > 1.0 AND overall_confidence <= 10.0"))
                conn.execute(text("UPDATE extracted_records SET overall_confidence = overall_confidence / 100.0 WHERE overall_confidence > 10.0"))
        if "correction_examples" in inspector.get_table_names():
            columns_ce = [c["name"] for c in inspector.get_columns("correction_examples")]
            with engine.begin() as conn:
                if "region" not in columns_ce:
                    conn.execute(text("ALTER TABLE correction_examples ADD COLUMN region VARCHAR DEFAULT 'north_central'"))
                if "ocr_snippet" not in columns_ce:
                    conn.execute(text("ALTER TABLE correction_examples ADD COLUMN ocr_snippet TEXT DEFAULT ''"))
    except Exception:
        pass

    # Seed demo few-shot correction examples (Section 9 of Spec)
    try:
        import uuid
        from models import CorrectionExample
        with SessionLocal() as db:
            if db.query(CorrectionExample).count() <= 1:
                db.query(CorrectionExample).delete()
                seed_examples = [
                    CorrectionExample(
                        id=uuid.uuid4(),
                        region="north_central",
                        field_name="landowner_details.name",
                        ocr_snippet="नाम मालिक व एहवाल",
                        wrong_value="मनोहर सिंह नम्बरदार पुत्र निवासी महाल बलेरन माल",
                        corrected_value="लीला प्रकाश, माधविन्द्र, कृष्ण चन्द",
                    ),
                    CorrectionExample(
                        id=uuid.uuid4(),
                        region="north_central",
                        field_name="plot_area.unit",
                        ocr_snippet="रकबा / 5-8 irrigated",
                        wrong_value="irrigated",
                        corrected_value="Kanal-Marla",
                    ),
                    CorrectionExample(
                        id=uuid.uuid4(),
                        region="north_central",
                        field_name="landowner_details.address",
                        ocr_snippet="स्थानिय वासी",
                        wrong_value="None",
                        corrected_value="स्थानिय वासी",
                    ),
                ]
                db.add_all(seed_examples)
                db.commit()
    except Exception:
        pass
