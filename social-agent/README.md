# 🤖 סוכן פרסום אוטומטי — צביעה באבקה
**Google Photos → Claude AI → אישור טלגרם → Facebook + Instagram**

---

## איך הסוכן עובד

```
כל יום בשעה שקבעת:
  ↓
בודק האלבום — בוחר את הסרטון הטוב ביותר
  ↓
Claude כותב קפשן מקצועי בעברית
  ↓
שולח לך לטלגרם עם כפתורי ✅ ❌
  ↓
  ├── ✅ אישרת → מפרסם לפייסבוק + אינסטגרם
  │              → שולח לך הכל להעתקה + קישור לטיקטוק
  │
  └── ❌ דחית → שולח לך: "מה לשנות?"
               → כותב גרסה חדשה עם ההערות שלך
               → שולח שוב לאישור (חוזר על זה עד שמאושר)
               → שומר את ההערות לזיכרון לפוסטים הבאים
```

---

## הגדרה — שלב אחר שלב

### שלב 1 — בוט טלגרם (2 דקות)

1. פתח טלגרם → חפש **@BotFather**
2. שלח: `/newbot`
3. תן שם לבוט, למשל: `PowderCoatingBot`
4. שמור את ה-**Token** (נראה כך: `7123456789:AAFxxxxx`)
5. חפש את הבוט ושלח לו הודעה כלשהי (כדי לפתוח שיחה)
6. פתח בדפדפן:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
7. מצא `"chat":{"id":XXXXXXX}` — זה ה-**Chat ID** שלך

---

### שלב 2 — Google Photos

**Access Token** (לניסיון ראשוני):
1. כנס ל: https://developers.google.com/oauthplayground
2. בחר: `Photos Library API v1` → `photoslibrary.readonly`
3. לחץ **Authorize** → **Exchange for tokens**
4. שמור את **Access Token**

> ⚠️ הטוקן הזה תקף שעה בלבד.
> לשימוש קבוע — יש להגדיר Refresh Token:
> https://developers.google.com/identity/protocols/oauth2

**Album ID:**
- פתח האלבום בגוגל פוטוס
- מה-URL: `photos.google.com/album/**ABC123xyz**`
- העתק את החלק המודגש

---

### שלב 3 — Facebook & Instagram

**Facebook Page Token:**
1. https://developers.facebook.com/tools/explorer
2. בחר את הדף שלך
3. הוסף הרשאות: `pages_manage_posts`, `pages_read_engagement`
4. לחץ **Generate Access Token**

**Instagram Business Account ID:**
1. Meta Business Suite → הגדרות → Instagram
2. העתק את המספר מתחת לשם החשבון

---

### שלב 4 — GitHub

```bash
# צור repository חדש ב-github.com, ואז:
git init
git add .
git commit -m "Social media agent"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/social-agent.git
git push -u origin main
```

---

### שלב 5 — Render.com (חינמי)

1. כנס ל: https://render.com → הירשם חינם
2. לחץ **New → Background Worker**
3. חבר את ה-GitHub repo שלך
4. Render יזהה את `render.yaml` אוטומטית
5. כנס ל-**Environment Variables** והזן:

| משתנה | ערך |
|-------|-----|
| `GOOGLE_ACCESS_TOKEN` | הטוקן מגוגל |
| `GOOGLE_ALBUM_ID` | מזהה האלבום |
| `ANTHROPIC_API_KEY` | מ-console.anthropic.com |
| `FB_PAGE_ID` | מזהה הדף |
| `FB_PAGE_TOKEN` | טוקן הדף |
| `IG_ACCOUNT_ID` | מזהה חשבון אינסטגרם |
| `TELEGRAM_BOT_TOKEN` | הטוקן מ-BotFather |
| `TELEGRAM_CHAT_ID` | ה-Chat ID שלך |
| `PUBLISH_HOUR_UTC` | `6` (= 09:00 ישראל) |

6. לחץ **Deploy** 🚀

---

## שינוי שעת הפרסום

ב-Render → Environment Variables → שנה `PUBLISH_HOUR_UTC`:

| שעה ישראל | ערך UTC |
|-----------|---------|
| 08:00 | `5` |
| 09:00 | `6` |
| 12:00 | `9` |
| 18:00 | `15` |
| 20:00 | `17` |

שמור → הסוכן מתעדכן תוך דקה, ללא נגיעה בקוד.

---

## התאמת אופי הכתיבה

ערוך את הקובץ `brand_voice.txt` — שם תוכל:
- לשנות את הטון
- להוסיף מוצרים/שירותים ספציפיים
- להגדיר האשטאגים קבועים
- לתת דוגמאות לקפשנים שאהבת

הסוכן קורא את הקובץ בכל הרצה.

---

## מבנה הקבצים

```
social-agent/
├── agent.py           # לוגיקה ראשית
├── scheduler.py       # מתזמן יומי
├── config.py          # הגדרות
├── brand_voice.txt    # אופי המותג — ערוך לפי הצורך
├── published.json     # זיכרון — מה פורסם
├── feedback_log.json  # זיכרון — פידבקים שנשמרו
├── requirements.txt   # תלויות Python
├── render.yaml        # הגדרות פריסה
└── README.md          # המדריך הזה
```

---

## שאלות נפוצות

**ש: הסוכן לא פרסם — מה עשה?**
ת: בדוק לוגים ב-Render Dashboard → Logs

**ש: רוצה לשנות את הקפשן לגמרי?**
ת: לחץ ❌, כתוב "כתוב מחדש — " + הנחיות ספציפיות

**ש: איך מוסיפים סרטון שלא יפורסם?**
ת: הוסף את ה-ID שלו ל-`published.json` ידנית

**ש: הטוקן של גוגל פג — מה עושים?**
ת: עדכן `GOOGLE_ACCESS_TOKEN` ב-Render Variables. לפתרון קבוע — הגדר Refresh Token.
