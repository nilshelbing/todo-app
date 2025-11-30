from datetime import datetime, date
from db import (
    init_db,
    list_tasks,
    add_task,
    mark_done,
    delete_task,
    update_task,
)

# Farben (optional). Wenn colorama nicht installiert ist, fällt es auf "keine Farben" zurück.
try:
    from colorama import init as colorama_init, Fore

    colorama_init(autoreset=True)
except ImportError:  # Fallback ohne Farben
    class _DummyFore:
        RED = ""
        GREEN = ""
        YELLOW = ""

    Fore = _DummyFore()


# ---------------------------------------------------------------------------
# Hilfsfunktionen für Fälligkeit und Darstellung
# ---------------------------------------------------------------------------

def due_status(row):
    """
    Ermittelt den Fälligkeitsstatus einer Aufgabe.

    Rückgabewerte:
      - "none"     : kein Fälligkeitsdatum gesetzt
      - "invalid"  : ungültiges Datumsformat in due_date
      - "overdue"  : Fälligkeitsdatum liegt vor heute
      - "today"    : heute fällig
      - "future"   : Fälligkeitsdatum liegt in der Zukunft
    """
    due_str = row["due_date"]
    if not due_str:
        return "none"

    try:
        d = datetime.strptime(due_str, "%Y-%m-%d").date()
    except ValueError:
        return "invalid"

    today = date.today()
    if d < today:
        return "overdue"
    elif d == today:
        return "today"
    else:
        return "future"


def print_tasks(rows, title="Aktuelle Aufgaben"):
    if not rows:
        print("\nKeine Aufgaben vorhanden.\n")
        return

    total = len(rows)
    open_tasks = sum(1 for r in rows if not r["done"])
    done_tasks = total - open_tasks
    overdue_tasks = sum(
        1 for r in rows if (not r["done"] and due_status(r) == "overdue")
    )
    due_today_tasks = sum(
        1 for r in rows if (not r["done"] and due_status(r) == "today")
    )

    print(f"\n{title}")
    print("-" * 80)
    print(
        f"Gesamt: {total}, offen: {open_tasks}, erledigt: {done_tasks}, "
        f"überfällig: {overdue_tasks}, heute fällig: {due_today_tasks}"
    )
    print("-" * 80)

    for idx, row in enumerate(rows, start=1):
        status_mark = "✔" if row["done"] else " "
        due = row["due_date"] or "-"
        prio = row["priority"]
        ds = due_status(row)

        # Farblogik:
        color = ""
        if row["done"]:
            color = Fore.GREEN
        elif ds == "overdue":
            color = Fore.RED
        elif ds == "today":
            color = Fore.YELLOW

        line = f"{idx:2}. [{status_mark}] (Prio {prio}) [fällig: {due}] {row['title']}"
        print(color + line)

        if row["tags"]:
            print("    Tags: " + row["tags"])
        if row["notes"]:
            print("    Notizen: " + (row["notes"] or ""))

    print("-" * 80 + "\n")


def input_date(prompt):
    s = input(prompt + " (JJJJ-MM-TT oder leer): ").strip()
    if not s:
        return None
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return s
    except ValueError:
        print("Ungültiges Datum, wird ignoriert.")
        return None


def input_priority():
    s = input("Priorität (1=hoch, 5=niedrig, Standard=3): ").strip()
    if not s:
        return 3
    if not s.isdigit():
        print("Ungültige Eingabe, nehme 3.")
        return 3
    prio = int(s)
    if prio < 1 or prio > 5:
        print("Bitte 1–5, nehme 3.")
        return 3
    return prio


# ---------------------------------------------------------------------------
# Menü-Aktionen
# ---------------------------------------------------------------------------

def menu_add():
    title = input("Titel der Aufgabe: ").strip()
    if not title:
        print("Abgebrochen.\n")
        return
    prio = input_priority()
    due = input_date("Fällig am")
    tags_str = input("Tags (kommagetrennt, optional): ").strip()
    tags = tags_str or None
    notes = input("Notizen (optional): ").strip() or None
    task_id = add_task(title, priority=prio, due_date=due, notes=notes, tags=tags)
    print(f"Aufgabe #{task_id} hinzugefügt.\n")


def select_task(rows, action_name):
    if not rows:
        print("Keine Aufgaben.\n")
        return None
    print_tasks(rows)
    choice = input(f"Nummer der Aufgabe zum {action_name}: ").strip()
    if not choice.isdigit():
        print("Bitte eine gültige Zahl eingeben.\n")
        return None
    idx = int(choice) - 1
    if idx < 0 or idx >= len(rows):
        print("Ungültige Nummer.\n")
        return None
    return rows[idx]["id"]


def menu_mark_done():
    rows = list_tasks(show_done=True)
    task_id = select_task(rows, "Markieren")
    if task_id is None:
        return
    mark_done(task_id, True)
    print("Aufgabe als erledigt markiert.\n")


def menu_delete():
    rows = list_tasks(show_done=True)
    task_id = select_task(rows, "Löschen")
    if task_id is None:
        return
    delete_task(task_id)
    print("Aufgabe gelöscht.\n")


def menu_edit():
    rows = list_tasks(show_done=True)
    task_id = select_task(rows, "Bearbeiten")
    if task_id is None:
        return

    title = input("Neuer Titel (leer = unverändert): ").strip()
    prio = input("Neue Priorität (leer = unverändert): ").strip()
    due = input(
        "Neues Fälligkeitsdatum (JJJJ-MM-TT oder leer = unverändert): "
    ).strip()
    tags_str = input("Neue Tags (kommagetrennt, leer = unverändert): ").strip()
    notes = input("Neue Notizen (leer = unverändert): ").strip()

    kwargs = {}
    if title:
        kwargs["title"] = title
    if prio:
        if prio.isdigit() and 1 <= int(prio) <= 5:
            kwargs["priority"] = int(prio)
        else:
            print("Ungültige Prio, wird ignoriert.")
    if due:
        try:
            datetime.strptime(due, "%Y-%m-%d")
            kwargs["due_date"] = due
        except ValueError:
            print("Ungültiges Datum, wird ignoriert.")
    if tags_str:
        kwargs["tags"] = tags_str
    if notes:
        kwargs["notes"] = notes

    if not kwargs:
        print("Nichts zu ändern.\n")
        return

    update_task(task_id, **kwargs)
    print("Aufgabe aktualisiert.\n")


# --- Suche (Upgrade 1) ------------------------------------------------------

def menu_search():
    term = input("Suchbegriff im Titel: ").strip()
    if not term:
        print("Abgebrochen.\n")
        return
    rows = list_tasks(show_done=True, search=term)
    print_tasks(rows, title=f"Suchergebnisse für '{term}'")


# --- Überfällige & heute fällige Aufgaben (Upgrade 2) ----------------------

def get_overdue_tasks():
    rows = list_tasks(show_done=False)
    today = date.today()
    result = []
    for row in rows:
        due_str = row["due_date"]
        if not due_str:
            continue
        try:
            d = datetime.strptime(due_str, "%Y-%m-%d").date()
        except ValueError:
            continue
        if d < today:
            result.append(row)
    return result


def get_due_today_tasks():
    rows = list_tasks(show_done=False)
    today = date.today()
    result = []
    for row in rows:
        due_str = row["due_date"]
        if not due_str:
            continue
        try:
            d = datetime.strptime(due_str, "%Y-%m-%d").date()
        except ValueError:
            continue
        if d == today:
            result.append(row)
    return result


def menu_show_overdue():
    rows = get_overdue_tasks()
    print_tasks(rows, title="Überfällige Aufgaben")


def menu_show_due_today():
    rows = get_due_today_tasks()
    print_tasks(rows, title="Heute fällige Aufgaben")


# --- Tags (Upgrade 3: Tags & Filter) ---------------------------------------

def menu_filter_by_tag():
    tag = input("Nach welchem Tag filtern? (ein einzelner Tag, z.B. 'arbeit'): ").strip()
    if not tag:
        print("Abgebrochen.\n")
        return
    rows = list_tasks(show_done=True, tag=tag)
    print_tasks(rows, title=f"Aufgaben mit Tag '{tag.lower()}'")


# ---------------------------------------------------------------------------
# Hauptmenü
# ---------------------------------------------------------------------------

def main():
    init_db()
    print("=== To-Do-Liste (SQLite, erweitert + Tags) ===")

    while True:
        print("Menü:")
        print("  1) alle Aufgaben anzeigen")
        print("  2) offene Aufgaben anzeigen")
        print("  3) Aufgabe hinzufügen")
        print("  4) Aufgabe als erledigt markieren")
        print("  5) Aufgabe löschen")
        print("  6) Aufgabe bearbeiten")
        print("  7) Aufgaben durchsuchen")
        print("  8) überfällige Aufgaben anzeigen")
        print("  9) heute fällige Aufgaben anzeigen")
        print(" 10) Aufgaben nach Tag filtern")
        print(" 11) Beenden")

        choice = input("Auswahl (1-11): ").strip()
        if choice == "1":
            rows = list_tasks(show_done=True)
            print_tasks(rows)
        elif choice == "2":
            rows = list_tasks(show_done=False)
            print_tasks(rows, title="Offene Aufgaben")
        elif choice == "3":
            menu_add()
        elif choice == "4":
            menu_mark_done()
        elif choice == "5":
            menu_delete()
        elif choice == "6":
            menu_edit()
        elif choice == "7":
            menu_search()
        elif choice == "8":
            menu_show_overdue()
        elif choice == "9":
            menu_show_due_today()
        elif choice == "10":
            menu_filter_by_tag()
        elif choice == "11":
            print("Tschüss!")
            break
        else:
            print("Ungültige Auswahl.\n")


if __name__ == "__main__":
    main()
