import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from database import init_db

# Ensure upload directory exists
UPLOAD_DIR = Path(__file__).resolve().parent / "uploaded_images"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="BhuLekh Land Record Digitization API", lifespan=lifespan)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    region: str = Form(default="north_central"),
):
    # Generate unique UUID filename while preserving original extension
    file_ext = Path(file.filename).suffix if file.filename else ".jpg"
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename

    # Save file safely to disk via streaming
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "status": "file saved",
        "path": str(file_path),
    }
