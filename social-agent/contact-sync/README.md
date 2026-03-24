# מערכת סנכרון אנשי קשר — Rightek

## מבנה הקבצים

```
contact-sync/
├── test_morning_api.py          # שלב 1: בדיקת Morning API
├── setup_airtable.py            # שלב 2: יצירת טבלת אנשי קשר
├── n8n_morning_to_airtable.json # שלב 3: Morning → Airtable (יבוא ל-n8n)
├── n8n_google_to_airtable.json  # שלב 4: Google Contacts → Airtable
├── n8n_airtable_to_google.json  # שלב 5: Airtable → Google Contacts
└── airtable_config.json         # נוצר אוטומטית ע"י setup_airtable.py
```

## שלב 1: בדיקת Morning API

```bash
MORNING_KEY_ID=xxx MORNING_KEY_SECRET=yyy python test_morning_api.py
```

יציג את מבנה הלקוח המלא מ-Morning כולל כל השדות הזמינים.

## שלב 2: יצירת טבלת Airtable

```bash
AIRTABLE_API_KEY=patXXX python setup_airtable.py
```

**דרישות:** Personal Access Token עם הרשאות:
- `data.records:read`
- `data.records:write`
- `schema.bases:read`
- `schema.bases:write`

**יוצר:**
- טבלת "אנשי קשר" עם כל השדות
- שדה "איש קשר" (Linked Record) ביומן עבודה
- שדות Lookup לטלפון ולקוח
- שדה Rollup "עבודה ראשונה"

## שלבים 3-5: n8n Workflows

### ייבוא ל-n8n:
1. פתח n8n
2. לחץ "Import from File"
3. בחר את קובץ ה-JSON המתאים

### לפני ייבוא — החלף:
- `CONTACTS_TABLE_ID` → ה-ID של טבלת אנשי קשר (מתוך `airtable_config.json`)
- הגדר Credentials ב-n8n:
  - **Airtable:** API Key
  - **Google:** OAuth2 עם People API scope
  - **Morning:** Environment variables (`MORNING_KEY_ID`, `MORNING_KEY_SECRET`)

### Flow 1: Morning → Airtable
- **תזמון:** כל יום ב-02:00
- **לוגיקה:** Token → Pagination → Normalize → Upsert
- **Dedup:** לפי מזהה חיצוני (Morning client ID)

### Flow 2: Google Contacts → Airtable
- **תזמון:** כל 15 דקות
- **לוגיקה:** Delta sync עם syncToken → Normalize → Upsert
- **Dedup:** ראשית לפי מזהה חיצוני (resourceName), אח"כ לפי טלפון מנורמל

### Flow 3: Airtable → Google Contacts
- **Trigger:** רשומה חדשה ב-Airtable
- **סינון:** רק מקור Morning/ידני (לא Google — למנוע loop)
- **סינון:** אין מזהה חיצוני שמתחיל ב-"people/"
- **לוגיקה:** Create contact ב-Google → עדכן מזהה חיצוני ב-Airtable

## נרמול טלפון

כל ה-flows משתמשים באותה פונקציית נרמול:
```javascript
function normalizePhone(phone) {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('972')) clean = '0' + clean.slice(3);
  return clean;
}
```

## הערות חשובות

- **Morning token** פג תוקף אחרי ~30 דקות — נוצר מחדש בכל הרצה
- **Google syncToken** — נשמר ב-n8n static data, מתאפס אוטומטית אם פג (410)
- **שמות שדות בעברית** — ב-filterByFormula: `{שם שדה}`
- **בנה flow אחד בכל פעם**, בדוק שהוא עובד, ואז עבור לבא
