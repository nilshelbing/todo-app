from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import uuid

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
)

app = Flask(__name__)
CORS(app)  # erlaubt Zugriffe vom React-Frontend (http://localhost:3000)
init_db()


def row_to_dict(row):
    """Task-Row -> JSON-Format für das Frontend."""
    raw_tags = row["tags"] or ""
    tags = [t for t in raw_tags.split(",") if t]

    return {
        "id": row["id"],
        "title": row["title"],
        "done": bool(row["done"]),
        "priority": row["priority"],
        "due_date": row["due_date"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "notes": row["notes"],
        "tags": tags,
    }


def doc_to_dict(row):
    """Document-Row -> JSON-Format für das Frontend."""
    return {
        "id": row["id"],
        "task_id": row["task_id"],
        "original_name": row["original_name"],
        "content_type": row["content_type"],
        "size": row["size"],
        "created_at": row["created_at"],
        "download_url": f"/documents/{row['id']}",
    }


# ---------------------------------------------------------------------------
# Task-Endpunkte
# ---------------------------------------------------------------------------

@app.get("/tasks")
def get_tasks():
    show_done_param = request.args.get("show_done", "true").lower()
    show_done = show_done_param != "false"
    search = request.args.get("search")
    tag = request.args.get("tag")

    rows = list_tasks(show_done=show_done, search=search, tag=tag)
    return jsonify([row_to_dict(r) for r in rows])


@app.post("/tasks")
def create_task():
    data = request.get_json(force=True, silent=True) or {}

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    try:
        priority = int(data.get("priority", 3))
    except (TypeError, ValueError):
        priority = 3

    due_date = data.get("due_date") or None
    if isinstance(due_date, str) and due_date.strip() == "":
        due_date = None

    notes = data.get("notes")
    tags = data.get("tags")  # darf String oder Liste sein, db.normalize_tags kümmert sich

    task_id = add_task(
        title=title,
        priority=priority,
        due_date=due_date,
        notes=notes,
        tags=tags,
    )
    row = get_task(task_id)
    return jsonify(row_to_dict(row)), 201


@app.patch("/tasks/<int:task_id>")
def patch_task(task_id):
    data = request.get_json(force=True, silent=True) or {}
    kwargs = {}

    if "title" in data:
        kwargs["title"] = data["title"]

    if "priority" in data:
        try:
            kwargs["priority"] = int(data["priority"])
        except (TypeError, ValueError):
            pass

    if "due_date" in data:
        due_date = data["due_date"] or None
        if isinstance(due_date, str) and due_date.strip() == "":
            due_date = None
        kwargs["due_date"] = due_date

    if "notes" in data:
        kwargs["notes"] = data["notes"]

    if "tags" in data:
        kwargs["tags"] = data["tags"]

    if "done" in data:
        done_val = bool(data["done"])
        mark_done(task_id, done_val)

    if kwargs:
        update_task(task_id, **kwargs)

    row = get_task(task_id)
    if row is None:
        return jsonify({"error": "not found"}), 404

    return jsonify(row_to_dict(row))


@app.post("/tasks/<int:task_id>/done")
def set_done(task_id):
    data = request.get_json(force=True, silent=True) or {}
    done_val = data.get("done", True)
    mark_done(task_id, bool(done_val))

    row = get_task(task_id)
    if row is None:
        return jsonify({"error": "not found"}), 404

    return jsonify(row_to_dict(row))


@app.delete("/tasks/<int:task_id>")
def delete_task_endpoint(task_id):
    delete_task(task_id)
    return jsonify({"status": "deleted"})


# ---------------------------------------------------------------------------
# Dokument-Endpunkte
# ---------------------------------------------------------------------------

@app.get("/tasks/<int:task_id>/documents")
def get_task_documents(task_id):
    if get_task(task_id) is None:
        return jsonify({"error": "task not found"}), 404

    rows = list_documents_for_task(task_id)
    return jsonify([doc_to_dict(r) for r in rows])


@app.post("/tasks/<int:task_id>/documents")
def upload_document(task_id):
    if get_task(task_id) is None:
        return jsonify({"error": "task not found"}), 404

    if "file" not in request.files:
        return jsonify({"error": "file is required"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "empty filename"}), 400

    original_name = file.filename
    suffix = Path(original_name).suffix
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    content_type = file.mimetype
    filepath = ATTACHMENTS_DIR / stored_name

    file.save(filepath)
    size = filepath.stat().st_size

    doc_id = add_document(
        task_id=task_id,
        original_name=original_name,
        stored_name=stored_name,
        content_type=content_type,
        size=size,
    )
    row = get_document(doc_id)
    return jsonify(doc_to_dict(row)), 201


@app.get("/documents/<int:doc_id>")
def download_document(doc_id):
    row = get_document(doc_id)
    if row is None:
        return jsonify({"error": "not found"}), 404

    return send_from_directory(
        ATTACHMENTS_DIR,
        row["stored_name"],
        as_attachment=True,
        download_name=row["original_name"],
    )


@app.delete("/documents/<int:doc_id>")
def delete_document_endpoint(doc_id):
    row = get_document(doc_id)
    if row is None:
        return jsonify({"error": "not found"}), 404

    filepath = ATTACHMENTS_DIR / row["stored_name"]
    if filepath.exists():
        filepath.unlink()

    delete_document(doc_id)
    return jsonify({"status": "deleted"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
