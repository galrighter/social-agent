"""
בדיקת Morning API — שלב 1
שולף token ו-3 לקוחות לדוגמה כדי לראות את מבנה הנתונים

שימוש:
  python test_morning_api.py

משתני סביבה נדרשים:
  MORNING_KEY_ID
  MORNING_KEY_SECRET
"""
import os
import sys
import json
import requests

MORNING_BASE_URL = "https://api.greeninvoice.co.il/api/v1"


def get_token(key_id: str, key_secret: str) -> str:
    """קבלת token מ-Morning API"""
    resp = requests.post(
        f"{MORNING_BASE_URL}/account/token",
        json={"id": key_id, "secret": key_secret},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["token"]


def search_clients(token: str, page: int = 0, page_size: int = 3) -> dict:
    """שליפת לקוחות מ-Morning"""
    resp = requests.post(
        f"{MORNING_BASE_URL}/clients/search",
        json={"page": page, "pageSize": page_size},
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    key_id = os.environ.get("MORNING_KEY_ID", "")
    key_secret = os.environ.get("MORNING_KEY_SECRET", "")

    if not key_id or not key_secret:
        print("חסרים משתני סביבה MORNING_KEY_ID ו-MORNING_KEY_SECRET")
        print("הרצה: MORNING_KEY_ID=xxx MORNING_KEY_SECRET=yyy python test_morning_api.py")
        sys.exit(1)

    # --- שלב 1: קבלת token ---
    print("=== שלב 1: קבלת token ===")
    try:
        token = get_token(key_id, key_secret)
        print(f"Token התקבל בהצלחה (אורך: {len(token)} תווים)")
    except requests.HTTPError as e:
        print(f"שגיאה בקבלת token: {e}")
        print(f"Response: {e.response.text}")
        sys.exit(1)

    # --- שלב 2: שליפת 3 לקוחות ---
    print("\n=== שלב 2: שליפת 3 לקוחות ===")
    try:
        result = search_clients(token, page=0, page_size=3)
    except requests.HTTPError as e:
        print(f"שגיאה בשליפת לקוחות: {e}")
        print(f"Response: {e.response.text}")
        sys.exit(1)

    # --- שלב 3: הצגת המבנה ---
    print(f"\nסה\"כ לקוחות: {result.get('total', '?')}")
    print(f"עמודים: {result.get('pages', '?')}")

    items = result.get("items", [])
    if not items:
        print("לא נמצאו לקוחות!")
        sys.exit(0)

    print(f"\n=== מבנה מלא של לקוח ראשון ===")
    print(json.dumps(items[0], indent=2, ensure_ascii=False))

    print(f"\n=== סיכום שדות זמינים ===")
    first = items[0]
    for key, val in first.items():
        val_type = type(val).__name__
        val_preview = str(val)[:80] if val else "(ריק)"
        print(f"  {key} ({val_type}): {val_preview}")

    # --- שדות קריטיים ---
    print(f"\n=== שדות קריטיים ===")
    critical_fields = ["id", "name", "phone", "emails", "taxId", "contactPerson",
                       "city", "address", "category", "accountingKey"]
    for field in critical_fields:
        val = first.get(field, "❌ לא קיים")
        print(f"  {field}: {val}")

    # --- כל 3 הלקוחות בקצרה ---
    print(f"\n=== 3 לקוחות לדוגמה ===")
    for i, client in enumerate(items):
        print(f"\n--- לקוח {i+1} ---")
        print(f"  id: {client.get('id', '?')}")
        print(f"  name: {client.get('name', '?')}")
        print(f"  phone: {client.get('phone', '?')}")
        print(f"  emails: {client.get('emails', '?')}")
        print(f"  taxId: {client.get('taxId', '?')}")
        print(f"  contactPerson: {client.get('contactPerson', '?')}")


if __name__ == "__main__":
    main()
