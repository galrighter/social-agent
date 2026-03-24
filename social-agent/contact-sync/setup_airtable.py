"""
יצירת טבלת אנשי קשר ב-Airtable + שדות קישור ביומן עבודה — שלב 2

שימוש:
  python setup_airtable.py

משתני סביבה נדרשים:
  AIRTABLE_API_KEY  — Personal Access Token עם הרשאות schema:bases:write
"""
import os
import sys
import json
import time
import requests

BASE_ID = "appOtMp0nXKLtU5Yk"
WORK_LOG_TABLE_ID = "tblPAH6rGPOkKaNsI"
AIRTABLE_API = "https://api.airtable.com/v0"
AIRTABLE_META = f"https://api.airtable.com/v0/meta/bases/{BASE_ID}"


def headers():
    token = os.environ.get("AIRTABLE_API_KEY", "")
    if not token:
        print("חסר AIRTABLE_API_KEY")
        sys.exit(1)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def create_contacts_table():
    """יצירת טבלת אנשי קשר"""
    print("=== יצירת טבלת אנשי קשר ===")

    payload = {
        "name": "אנשי קשר",
        "fields": [
            {
                "name": "תצוגה",
                "type": "formula",
                "options": {
                    "formula": '{שם} & " | " & {טלפון} & " | " & {לקוח}'
                },
            },
            {"name": "שם", "type": "singleLineText"},
            {"name": "טלפון", "type": "phoneNumber"},
            {"name": "לקוח", "type": "singleLineText"},
            {
                "name": "מקור",
                "type": "singleSelect",
                "options": {
                    "choices": [
                        {"name": "Google", "color": "blueLight2"},
                        {"name": "Morning", "color": "greenLight2"},
                        {"name": "ידני", "color": "grayLight2"},
                    ]
                },
            },
            {"name": "מזהה חיצוני", "type": "singleLineText"},
            {"name": "אימייל", "type": "email"},
            {"name": "ח.פ / ע.מ", "type": "singleLineText"},
            {"name": "הערות", "type": "multilineText"},
        ],
    }

    resp = requests.post(
        f"{AIRTABLE_META}/tables",
        headers=headers(),
        json=payload,
        timeout=30,
    )

    if resp.status_code == 200:
        table = resp.json()
        table_id = table["id"]
        print(f"טבלה נוצרה בהצלחה! ID: {table_id}")

        # שמירת field IDs
        field_map = {}
        for f in table.get("fields", []):
            field_map[f["name"]] = f["id"]
            print(f"  {f['name']}: {f['id']}")

        return table_id, field_map
    else:
        print(f"שגיאה ביצירת טבלה: {resp.status_code}")
        print(resp.text)

        # אם הטבלה כבר קיימת, ננסה למצוא אותה
        if resp.status_code == 422:
            print("\nמנסה למצוא טבלה קיימת...")
            return find_existing_table()
        sys.exit(1)


def find_existing_table():
    """חיפוש טבלת אנשי קשר קיימת"""
    resp = requests.get(
        f"{AIRTABLE_META}/tables",
        headers=headers(),
        timeout=30,
    )
    resp.raise_for_status()

    for table in resp.json().get("tables", []):
        if table["name"] == "אנשי קשר":
            table_id = table["id"]
            field_map = {f["name"]: f["id"] for f in table.get("fields", [])}
            print(f"נמצאה טבלה קיימת: {table_id}")
            for name, fid in field_map.items():
                print(f"  {name}: {fid}")
            return table_id, field_map

    print("לא נמצאה טבלת אנשי קשר")
    sys.exit(1)


def add_linked_field_to_work_log(contacts_table_id: str):
    """הוספת שדה Linked Record ליומן עבודה"""
    print("\n=== הוספת שדה 'איש קשר' ליומן עבודה ===")

    payload = {
        "name": "איש קשר",
        "type": "multipleRecordLinks",
        "options": {
            "linkedTableId": contacts_table_id,
            "prefersSingleRecordLink": True,
        },
    }

    resp = requests.post(
        f"{AIRTABLE_META}/tables/{WORK_LOG_TABLE_ID}/fields",
        headers=headers(),
        json=payload,
        timeout=30,
    )

    if resp.status_code == 200:
        field = resp.json()
        print(f"שדה נוצר: {field['id']}")
        return field["id"]
    else:
        print(f"שגיאה: {resp.status_code} — {resp.text}")
        if resp.status_code == 422:
            print("ייתכן שהשדה כבר קיים")
            return find_field_in_table(WORK_LOG_TABLE_ID, "איש קשר")
        return None


def add_lookup_field(table_id: str, field_name: str, linked_field_id: str, lookup_field_id: str):
    """הוספת שדה Lookup"""
    print(f"\n=== הוספת שדה '{field_name}' ===")

    payload = {
        "name": field_name,
        "type": "lookup",
        "options": {
            "fieldIdInLinkedTable": lookup_field_id,
            "recordLinkFieldId": linked_field_id,
        },
    }

    resp = requests.post(
        f"{AIRTABLE_META}/tables/{table_id}/fields",
        headers=headers(),
        json=payload,
        timeout=30,
    )

    if resp.status_code == 200:
        field = resp.json()
        print(f"שדה נוצר: {field['id']}")
        return field["id"]
    else:
        print(f"שגיאה: {resp.status_code} — {resp.text}")
        return None


def add_rollup_field(contacts_table_id: str):
    """הוספת שדה Rollup לעבודה ראשונה בטבלת אנשי קשר"""
    print("\n=== הוספת שדה 'עבודה ראשונה' לטבלת אנשי קשר ===")

    # מצא את שדה הקישור ההפוך (שנוצר אוטומטית כשהוספנו linked record)
    resp = requests.get(
        f"{AIRTABLE_META}/tables",
        headers=headers(),
        timeout=30,
    )
    resp.raise_for_status()

    # מצא את שדה הקישור בטבלת אנשי קשר
    link_field_id = None
    date_field_id = None
    for table in resp.json().get("tables", []):
        if table["id"] == contacts_table_id:
            for f in table.get("fields", []):
                if f["type"] == "multipleRecordLinks":
                    link_field_id = f["id"]
                    print(f"  שדה קישור נמצא: {f['name']} ({f['id']})")
        if table["id"] == WORK_LOG_TABLE_ID:
            for f in table.get("fields", []):
                # חפש שדה תאריך ביומן עבודה
                if f["type"] in ("date", "dateTime") or "תאריך" in f.get("name", ""):
                    date_field_id = f["id"]
                    print(f"  שדה תאריך נמצא: {f['name']} ({f['id']})")

    if not link_field_id:
        print("  לא נמצא שדה קישור בטבלת אנשי קשר — דלג")
        return None

    if not date_field_id:
        print("  לא נמצא שדה תאריך ביומן עבודה — דלג")
        print("  תצטרך להוסיף שדה Rollup ידנית")
        return None

    payload = {
        "name": "עבודה ראשונה",
        "type": "rollup",
        "options": {
            "fieldIdInLinkedTable": date_field_id,
            "recordLinkFieldId": link_field_id,
            "result": {
                "type": "date",
                "options": {"dateFormat": {"name": "iso"}},
            },
            # MIN function to get earliest date
            "referencedFieldIds": [date_field_id],
            "formula": "MIN(values)",
        },
    }

    # Note: Rollup API can be tricky - may need manual setup
    resp = requests.post(
        f"{AIRTABLE_META}/tables/{contacts_table_id}/fields",
        headers=headers(),
        json=payload,
        timeout=30,
    )

    if resp.status_code == 200:
        field = resp.json()
        print(f"שדה נוצר: {field['id']}")
        return field["id"]
    else:
        print(f"שגיאה: {resp.status_code} — {resp.text}")
        print("ייתכן שתצטרך להוסיף את שדה ה-Rollup ידנית ב-Airtable")
        return None


def find_field_in_table(table_id: str, field_name: str):
    """מצא field ID לפי שם"""
    resp = requests.get(
        f"{AIRTABLE_META}/tables",
        headers=headers(),
        timeout=30,
    )
    resp.raise_for_status()

    for table in resp.json().get("tables", []):
        if table["id"] == table_id:
            for f in table.get("fields", []):
                if f["name"] == field_name:
                    print(f"  נמצא: {f['id']}")
                    return f["id"]
    return None


def main():
    print("=" * 50)
    print("  הקמת טבלת אנשי קשר — Rightek")
    print("=" * 50)

    # שלב 1: יצירת טבלת אנשי קשר
    contacts_table_id, field_map = create_contacts_table()
    time.sleep(1)  # Rate limit

    # שלב 2: הוספת שדה linked record ליומן עבודה
    linked_field_id = add_linked_field_to_work_log(contacts_table_id)
    time.sleep(1)

    if linked_field_id and field_map:
        # שלב 3: הוספת lookups ליומן עבודה
        phone_field_id = field_map.get("טלפון")
        client_field_id = field_map.get("לקוח")

        if phone_field_id:
            add_lookup_field(
                WORK_LOG_TABLE_ID,
                "טלפון (lookup)",
                linked_field_id,
                phone_field_id,
            )
            time.sleep(1)

        if client_field_id:
            add_lookup_field(
                WORK_LOG_TABLE_ID,
                "לקוח (lookup)",
                linked_field_id,
                client_field_id,
            )
            time.sleep(1)

        # שלב 4: הוספת rollup לטבלת אנשי קשר
        add_rollup_field(contacts_table_id)

    # סיכום
    print("\n" + "=" * 50)
    print("  סיכום")
    print("=" * 50)
    print(f"  טבלת אנשי קשר: {contacts_table_id}")
    print(f"  שדות:")
    for name, fid in field_map.items():
        print(f"    {name}: {fid}")

    # שמירת config
    config = {
        "contacts_table_id": contacts_table_id,
        "field_map": field_map,
        "linked_field_id": linked_field_id,
    }
    config_path = os.path.join(os.path.dirname(__file__), "airtable_config.json")
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print(f"\n  Config נשמר ל: {config_path}")


if __name__ == "__main__":
    main()
