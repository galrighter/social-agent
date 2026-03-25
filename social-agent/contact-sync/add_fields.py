"""
הוספת שדות לטבלת אנשי קשר קיימת ב-Airtable

שימוש:
  AIRTABLE_API_KEY=patXXX python add_fields.py
"""
import os
import sys
import time
import requests

BASE_ID = "appOtMp0nXKLtU5Yk"
TABLE_ID = "tbljmeJryHQjKX99I"
API_URL = f"https://api.airtable.com/v0/meta/bases/{BASE_ID}/tables/{TABLE_ID}/fields"


def get_headers():
    token = os.environ.get("AIRTABLE_API_KEY", "")
    if not token:
        print("חסר AIRTABLE_API_KEY")
        sys.exit(1)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


FIELDS = [
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
]


def main():
    headers = get_headers()
    success = 0
    failed = 0

    for field in FIELDS:
        print(f"יוצר שדה: {field['name']}...", end=" ")
        resp = requests.post(API_URL, headers=headers, json=field, timeout=30)

        if resp.status_code == 200:
            fid = resp.json().get("id", "?")
            print(f"OK ({fid})")
            success += 1
        elif resp.status_code == 422:
            print("כבר קיים — דילוג")
            success += 1
        else:
            print(f"שגיאה {resp.status_code}: {resp.text}")
            failed += 1

        time.sleep(0.3)

    print(f"\nסיום: {success} הצליחו, {failed} נכשלו")
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
