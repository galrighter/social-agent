# סיכום מלא — סוכן פרסום אוטומטי לרייטק (v22)
# Handoff document for Claude Code

## מה הסוכן עושה

סוכן Python שרץ 24/7 על Render.com (Background Worker).
שני תהליכים נפרדים:

### PREPARE flow (פקודת /newpost):
1. מחפש שורות ב-Airtable עם `מוכן לפרסום=true` + `קפשן מאושר=ריק` + `פורסם=false`
2. מוריד תמונות before/after מה-attachments
3. שולח תמונות ל-Claude Vision API → מקבל קפשן בעברית לפי brand_voice.txt
4. שולח לאישור בטלגרם (כפתורי ✅/❌ או טקסט חופשי לתיקון)
5. אחרי אישור → שומר קפשן בשדה "קפשן מאושר" באיירטייבל
6. עובר לשורה הבאה עד שאין יותר

### PUBLISH flow (כל יום ב-9:00 ישראל, או פקודת /publish):
1. מחפש שורה עם קפשן מאושר + לא פורסם
2. מפרסם לפייסבוק + אינסטגרם (עדיין לא מחובר — ה-tokens חסרים)
3. מסמן פורסם=true
4. מתריע כשהבנק מתרוקן

### פקודות טלגרם:
- /newpost — הכנת קפשנים
- /publish — פרסום מיידי (עוקף pause)
- /next — תצוגה מקדימה
- /skip — דלג על הבא
- /pause — עצור פרסום יומי
- /resume — חדש פרסום יומי
- /bank — כמה בבנק
- /status — סטטוס מלא
- /summarize — סיכום פידבקים

---

## פרטים טכניים

### Airtable:
- Base ID: `appOtMp0nXKLtU5Yk`
- Table ID: `tblPAH6rGPOkKaNsI`
- Table name: "עד יומן עבודה"
- **חשוב: כל הקריאות חייבות לכלול `returnFieldsByFieldId=true`** (בלי זה Airtable מחזיר שמות שדות במקום IDs והקוד שובר)

Field IDs:
- `fld5gTGADc4y8qjMy` = מוכן לפרסום (checkbox)
- `fldMnPdkg9doBSQEu` = פורסם (checkbox)
- `fldNKgfqHQkFfCipw` = before pic (attachment)
- `fld7cQ5aRrnCqn92G` = after pic (attachment)
- `fld2lxzlsQ8Vibj5U` = שם לקוח
- `fldmw22jvkQiOBv5b` = items
- `fldksCfEsqak9ncRp` = color
- `fldxXkBh1KtrtAIkf` = notes
- `fldVvsn0k69LcSnGz` = קפשן מאושר (multilineText) — חדש

### Render.com:
- Background Worker
- GitHub repo: `social-agent` (PRIVATE)
- Root Directory: `social-agent/`
- Start Command: `python scheduler.py`
- Environment variables:
  - AIRTABLE_API_KEY
  - ANTHROPIC_API_KEY
  - FB_PAGE_ID (ריק — עדיין לא מוגדר)
  - FB_PAGE_TOKEN (ריק — עדיין לא מוגדר)
  - IG_ACCOUNT_ID (ריק — עדיין לא מוגדר)
  - TELEGRAM_BOT_TOKEN
  - TELEGRAM_CHAT_ID = 6874523432
  - PUBLISH_HOUR_UTC = 6
  - PYTHONIOENCODING = utf-8
  - LANG = C.UTF-8
  - LC_ALL = C.UTF-8
  - SUMMARIZE_AFTER_N_FEEDBACKS = 10

### טלגרם:
- Chat ID: 6874523432
- הבוט מאזין ל-long polling (getUpdates)

---

## מה עובד ✅
- Render עולה ורץ
- הסוכן מקבל פקודות טלגרם
- /newpost מוצא שורות, מוריד תמונות, מייצר קפשנים
- Claude Vision API עובד
- אישור/דחייה/תיקון דרך טלגרם עובד
- קפשן מאושר נשמר באיירטייבל
- כפתורי טלגרם מוצגים נכון (עברית)
- לוגים קריאים באנגלית ב-Render
- פקודות שליטה: /pause, /resume, /skip, /next, /bank, /status

## מה לא מחובר עדיין ❌
- **פייסבוק + אינסטגרם** — ה-tokens לא הוגדרו. צריך:
  1. ליצור Meta App ב-developers.facebook.com
  2. ליצור Page Access Token עם הרשאות: pages_manage_posts, pages_read_engagement, pages_manage_engagement, instagram_basic, instagram_content_publish
  3. להפוך לטוקן שלא פוקע (short-lived → long-lived → permanent page token)
  4. לשלוף FB_PAGE_ID ו-IG_ACCOUNT_ID
  5. להגדיר ב-Render env vars

---

## באגים שתוקנו (לידיעה, לא לפתוח מחדש):
1. `returnFieldsByFieldId=true` — בלי זה Airtable מחזיר שמות שדות ולא IDs, מה שגרם לתמונות "להיעלם"
2. Telegram Markdown — `parse_mode: Markdown` הוסר כי שבר הודעות עם תווים מיוחדים
3. `json.dumps(keyboard, ensure_ascii=False)` — בלי ensure_ascii, כפתורי טלגרם בעברית הוצגו כג'יבריש
4. timeout הועלה ל-10 דקות (עכשיו לא רלוונטי כי prepare ו-publish נפרדים)
5. Signed URLs — Airtable attachment URLs פוקעים מהר, הקוד שולף URLs טריים רגע לפני כל הורדה

## כללי הקפשן (brand_voice.txt):
- 3 שורות בדיוק: תיאור עובדתי, יתרון טכני, שורת קשר קבועה
- 5 האשטאגים כולל #Rightek
- ללא מחמאות, סופרלטיבים, אמוג'י
- טון טכני ועובדתי בלבד

## מבנה הקבצים:
```
social-agent/
├── agent.py           # לוגיקה ראשית (v22)
├── scheduler.py       # מתזמן + פקודות טלגרם (v22)
├── config.py          # משתני סביבה + Field IDs
├── brand_voice.txt    # כללי הקפשן
├── feedback_log.json  # פידבקים
├── published.json     # (לא בשימוש יותר — הכל באיירטייבל)
├── requirements.txt   # requests==2.31.0, schedule==1.2.1
└── render.yaml        # הגדרות Render
```

## השלב הבא:
חיבור פייסבוק ואינסטגרם — יצירת Meta App, טוקנים, והגדרת env vars ב-Render.
