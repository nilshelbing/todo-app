from pathlib import Path
from datetime import datetime
import sqlite3
import uuid
import os

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "tasks.db"
ATTACHMENTS_DIR = BASE_DIR / "attachments"
ATTACHMENTS_DIR.mkdir(exist_ok=True)


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def str_to_tags(tag_str):
    """Wandelt den gespeicherten String in eine Liste von Tags um."""
    if not tag_str:
        return []
    return [t for t in tag_str.split(",") if t]


def normalize_tags(tags):
    """
    Nimmt entweder einen String ("work, privat") oder eine Liste
    und gibt einen normalisierten, sortierten String zurück: "privat,work".
    """
    if not tags:
        return None

    parts = []

    if isinstance(tags, str):
        # ; wird ebenfalls als Trenner akzeptiert
        parts = tags.replace(";", ",").split(",")
    else:
        for t in tags:
            if t is None:
                continue
            s = str(t)
            parts.extend(s.replace(";", ",").split(","))

    cleaned = [p.strip().lower() for p in parts if p.strip()]
    if not cleaned:
        return None

    # Duplikate entfernen, sortiert
    unique = sorted(set(cleaned))
    return ",".join(unique)


def init_db():
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                done INTEGER NOT NULL DEFAULT 0,
                priority INTEGER NOT NULL DEFAULT 3,
                due_date TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                notes TEXT,
                tags TEXT
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                content_type TEXT,
                size INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
            """
        )

        conn.commit()



def add_task(title, priority=3, due_date=None, notes=None, tags=None):
    """Neue Aufgabe anlegen und ID zurückgeben."""
    now = datetime.utcnow().isoformat()
    tags_str = normalize_tags(tags)

    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO tasks (title, done, priority, due_date, created_at, updated_at, notes, tags)
            VALUES (?, 0, ?, ?, ?, ?, ?, ?)
            """,
            (title, priority, due_date, now, now, notes, tags_str),
        )
        conn.commit()
        return cur.lastrowid


def get_task(task_id):
    with get_conn() as conn:
        cur = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        return cur.fetchone()


def list_tasks(
    show_done=True,
    search=None,
    tag=None,
    order_by="priority, due_date IS NULL, due_date, created_at",
):
    """Aufgabenliste (optional gefiltert nach Status, Suchbegriff und Tag)."""
    query = "SELECT * FROM tasks"
    conditions = []
    params = []

    if not show_done:
        conditions.append("done = 0")
    if search:
        conditions.append("title LIKE ?")
        params.append(f"%{search}%")
    if tag:
        # tags werden als "tag1,tag2,tag3" gespeichert
        # wir suchen nach ",tag," in ",tags,"
        conditions.append("(',' || IFNULL(tags, '') || ',') LIKE ?")
        params.append(f"%,{tag.lower()},%")

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY " + order_by

    with get_conn() as conn:
        cur = conn.execute(query, params)
        return cur.fetchall()


def mark_done(task_id, done=True):
    now = datetime.utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            "UPDATE tasks SET done = ?, updated_at = ? WHERE id = ?",
            (1 if done else 0, now, task_id),
        )
        conn.commit()


def delete_task(task_id):
    with get_conn() as conn:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()


def update_task(task_id, title=None, priority=None, due_date=None, notes=None, tags=None):
    """Beliebige Felder einer Aufgabe aktualisieren."""
    fields = []
    params = []

    if title is not None:
        fields.append("title = ?")
        params.append(title)
    if priority is not None:
        fields.append("priority = ?")
        params.append(priority)
    if due_date is not None:
        fields.append("due_date = ?")
        params.append(due_date)
    if notes is not None:
        fields.append("notes = ?")
        params.append(notes)
    if tags is not None:
        fields.append("tags = ?")
        params.append(normalize_tags(tags))

    if not fields:
        return

    fields.append("updated_at = ?")
    params.append(datetime.utcnow().isoformat())
    params.append(task_id)
    set_clause = ", ".join(fields)

    with get_conn() as conn:
        conn.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?", params)
        conn.commit()
def add_document(task_id, original_name, stored_name, content_type, size):
    """Legt einen Dokument-Datensatz zu einer Aufgabe an und gibt die neue ID zurück."""
    now = datetime.utcnow().isoformat()
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO documents (task_id, original_name, stored_name, content_type, size, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (task_id, original_name, stored_name, content_type, size, now),
        )
        conn.commit()
        return cur.lastrowid


def list_documents_for_task(task_id):
    """Liefert alle Dokumente zu einer Aufgabe (neueste zuerst)."""
    with get_conn() as conn:
        cur = conn.execute(
            "SELECT * FROM documents WHERE task_id = ? ORDER BY created_at DESC",
            (task_id,),
        )
        return cur.fetchall()


def get_document(doc_id):
    """Liest ein einzelnes Dokument per ID."""
    with get_conn() as conn:
        cur = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        return cur.fetchone()


def delete_document(doc_id):
    """Löscht einen Dokument-Datensatz (Datei selbst löschen wir im server.py)."""
    with get_conn() as conn:
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()

