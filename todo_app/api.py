from pathlib import Path
from typing import List, Optional

import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from db import (
    ATTACHMENTS_DIR,
    init_db,
    list_tasks,
    add_task,
    mark_done,
    delete_task,
    update_task,
    get_task,
    add_document,
    list_documents_for_task,
    get_document,
    delete_document,
    list_tags,
)

# ---------------------------------------------------------------------------
# FastAPI-Setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Todo API",
    version="1.0.0",
    description="Todo-Liste mit Tags und Dokumentenablage",
)

# CORS für dein React-Frontend
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB initialisieren
init_db()


# ---------------------------------------------------------------------------
# Pydantic-Modelle (Schemas)
# ---------------------------------------------------------------------------

class TaskBase(BaseModel):
    title: str
    priority: int = 3
    due_date: Optional[str] = None  # "YYYY-MM-DD"
    notes: Optional[str] = None
    tags: Optional[List[str]] = None  # Liste von Tags (klein, ohne "#")


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    priority: Optional[int] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    done: Optional[bool] = None


class TaskOut(BaseModel):
    id: int
    title: str
    done: bool
    priority: int
    due_date: Optional[str]
    created_at: str
    updated_at: str
    notes: Optional[str]
    tags: List[str]

    class Config:
        from_attributes = True  # Pydantic v2
        # (in v1 wäre: orm_mode = True)


class DocumentOut(BaseModel):
    id: int
    task_id: int
    original_name: str
    content_type: Optional[str]
    size: Optional[int]
    created_at: str
    download_url: str


class TagSummary(BaseModel):
    name: str
    total: int
    open: int


# ---------------------------------------------------------------------------
# Helper zum Konvertieren DB-Row -> Schema
# ---------------------------------------------------------------------------

def row_to_task(row) -> TaskOut:
    raw_tags = row["tags"] or ""
    tags = [t for t in raw_tags.split(",") if t]
    return TaskOut(
        id=row["id"],
        title=row["title"],
        done=bool(row["done"]),
        priority=row["priority"],
        due_date=row["due_date"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        notes=row["notes"],
        tags=tags,
    )


def row_to_document(row) -> DocumentOut:
    return DocumentOut(
        id=row["id"],
        task_id=row["task_id"],
        original_name=row["original_name"],
        content_type=row["content_type"],
        size=row["size"],
        created_at=row["created_at"],
        download_url=f"/documents/{row['id']}",
    )


# ---------------------------------------------------------------------------
# Task-Endpunkte
# ---------------------------------------------------------------------------

@app.get("/tasks", response_model=List[TaskOut])
def get_tasks(
    show_done: bool = Query(True, description="Erledigte Aufgaben mit anzeigen?"),
    search: Optional[str] = Query(None, description="Suche im Titel"),
    tag: Optional[str] = Query(None, description="Nach einem Tag filtern"),
):
    rows = list_tasks(show_done=show_done, search=search, tag=tag)
    return [row_to_task(r) for r in rows]


@app.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate):
    title = (payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    task_id = add_task(
        title=title,
        priority=payload.priority,
        due_date=payload.due_date or None,
        notes=payload.notes,
        tags=payload.tags,
    )
    row = get_task(task_id)
    return row_to_task(row)


@app.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task_endpoint(task_id: int, payload: TaskUpdate):
    row = get_task(task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")

    kwargs = {}
    if payload.title is not None:
        kwargs["title"] = payload.title
    if payload.priority is not None:
        kwargs["priority"] = payload.priority
    if payload.due_date is not None:
        kwargs["due_date"] = payload.due_date or None
    if payload.notes is not None:
        kwargs["notes"] = payload.notes
    if payload.tags is not None:
        kwargs["tags"] = payload.tags

    if kwargs:
        update_task(task_id, **kwargs)

    if payload.done is not None:
        mark_done(task_id, payload.done)

    row = get_task(task_id)
    return row_to_task(row)


@app.post("/tasks/{task_id}/done", response_model=TaskOut)
def set_done(task_id: int, done: bool = True):
    if get_task(task_id) is None:
        raise HTTPException(status_code=404, detail="Task not found")
    mark_done(task_id, done)
    row = get_task(task_id)
    return row_to_task(row)


@app.delete("/tasks/{task_id}", status_code=204)
def delete_task_endpoint(task_id: int):
    if get_task(task_id) is None:
        raise HTTPException(status_code=404, detail="Task not found")
    delete_task(task_id)
    return None


# ---------------------------------------------------------------------------
# Dokument-Endpunkte
# ---------------------------------------------------------------------------

@app.get("/tasks/{task_id}/documents", response_model=List[DocumentOut])
def get_task_documents(task_id: int):
    if get_task(task_id) is None:
        raise HTTPException(status_code=404, detail="Task not found")
    rows = list_documents_for_task(task_id)
    return [row_to_document(r) for r in rows]


@app.post("/tasks/{task_id}/documents", response_model=DocumentOut, status_code=201)
async def upload_document(task_id: int, file: UploadFile = File(...)):
    if get_task(task_id) is None:
        raise HTTPException(status_code=404, detail="Task not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="empty filename")

    original_name = file.filename
    suffix = Path(original_name).suffix
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    filepath = ATTACHMENTS_DIR / stored_name

    contents = await file.read()
    with filepath.open("wb") as f:
        f.write(contents)
    size = filepath.stat().st_size

    doc_id = add_document(
        task_id=task_id,
        original_name=original_name,
        stored_name=stored_name,
        content_type=file.content_type,
        size=size,
    )
    row = get_document(doc_id)
    return row_to_document(row)


@app.get("/documents/{doc_id}")
def download_document(doc_id: int):
    row = get_document(doc_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")

    path = ATTACHMENTS_DIR / row["stored_name"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on server")

    return FileResponse(
        path,
        media_type=row["content_type"] or "application/octet-stream",
        filename=row["original_name"],
    )


@app.delete("/documents/{doc_id}", status_code=204)
def delete_document_endpoint(doc_id: int):
    row = get_document(doc_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")

    path = ATTACHMENTS_DIR / row["stored_name"]
    if path.exists():
        path.unlink()

    delete_document(doc_id)
    return None


@app.get("/tags", response_model=List[TagSummary])
def get_tags():
    """Aggregierte Übersicht der verfügbaren Tags liefern."""
    return list_tags()
