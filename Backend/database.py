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
    except Exception:
        pass
