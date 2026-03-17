"""
סוכן פרסום אוטומטי
Airtable → Claude Vision → Facebook + Instagram → Telegram לאישור
"""

import json
import base64
import logging
import requests
import time
from datetime import datetime
from config import (CONFIG, FEEDBACK_FILE, BRAND_VOICE_FILE,
                    SUMMARIZE_AFTER_N_FEEDBACKS)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger(__name__)

AIRTABLE_BASE = f"https://api.airtable.com/v0/{CONFIG['AIRTABLE_BASE_ID']}/{CONFIG['AIRTABLE_TABLE_ID']}"
AIRTABLE_HEADERS = {
    "Authorization": f"Bearer {CONFIG['AIRTABLE_API_KEY']}",
    "Content-Type": "application/json"
}


# ─── קבצי נתונים ──────────────────────────────────────────────────────────────

def load_json(path, default):
    import os
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_brand_voice():
    import os
    if os.path.exists(BRAND_VOICE_FILE):
        with open(BRAND_VOICE_FILE, "r", encoding="utf-8") as f:
            return f.read()
    return ""

def load_feedback_for_caption():
    data         = load_json(FEEDBACK_FILE, {"feedbacks": [], "last_summary": "", "unsummarized_count": 0})
    last_summary = data.get("last_summary", "")
    unsummarized = [fb for fb in data.get("feedbacks", []) if not fb.get("summarized")]
    if not last_summary and not unsummarized:
        return ""
    parts = []
    if last_summary:
        parts.append(f"## עקרונות שנלמדו מפידבק קודם:\n{last_summary}")
    if unsummarized:
        parts.append("## פידבקים שטרם סוכמו:")
        for fb in unsummarized:
            parts.append(f"- {fb['date']}: {fb['feedback']}")
    return "\n\n".join(parts)

def save_feedback(text):
    data = load_json(FEEDBACK_FILE, {"feedbacks": [], "last_summary": "", "unsummarized_count": 0})
    data["feedbacks"].append({"date": datetime.now().strftime("%Y-%m-%d"), "feedback": text, "summarized": False})
    data["unsummarized_count"] = data.get("unsummarized_count", 0) + 1
    save_json(FEEDBACK_FILE, data)
    log.info(f"פידבק נשמר ✓ ({data['unsummarized_count']} לא מסוכמים)")
    if data["unsummarized_count"] >= SUMMARIZE_AFTER_N_FEEDBACKS:
        run_feedback_summary_flow()


# ─── Airtable ─────────────────────────────────────────────────────────────────

def fetch_ready_record():
    """
    שולף שורה אחת שמוכנה לפרסום ולא פורסמה עדיין.
    מחזיר את הרשומה, או None אם אין.
    """
    log.info("מחפש שורה מוכנה לפרסום באיירטייבל...")
    params = {
        "filterByFormula": f"AND({{{CONFIG['FLD_READY']}}}=1, {{{CONFIG['FLD_PUBLISHED']}}}=0)",
        "maxRecords": 1,
        "sort[0][field]": "Created",
        "sort[0][direction]": "asc"
    }
    # Airtable REST API - use field names not IDs in filterByFormula
    params = {
        "filterByFormula": "AND({מוכן לפרסום}=1, {פורסם}=0)",
        "maxRecords": 1,
        "sort[0][field]": "Created",
        "sort[0][direction]": "asc"
    }
    res = requests.get(AIRTABLE_BASE, headers=AIRTABLE_HEADERS, params=params)
    res.raise_for_status()
    records = res.json().get("records", [])
    if not records:
        log.info("אין שורות מוכנות לפרסום")
        return None
    record = records[0]
    log.info(f"נמצאה שורה: {record['id']}")
    return record

def mark_as_published(record_id):
    """מסמן את השורה כ-פורסם=true באיירטייבל"""
    res = requests.patch(
        f"{AIRTABLE_BASE}/{record_id}",
        headers=AIRTABLE_HEADERS,
        json={"fields": {CONFIG["FLD_PUBLISHED"]: True}}
    )
    res.raise_for_status()
    log.info(f"שורה {record_id} סומנה כפורסם ✓")

def mark_as_skipped(record_id):
    """דילוג — מסמן פורסם=true כדי שלא יוצע שוב"""
    mark_as_published(record_id)
    log.info(f"שורה {record_id} דולגה ✓")

def get_image_b64_from_attachment(attachments, label="תמונה"):
    """
    מוריד תמונה מ-attachment ומחזיר base64.
    מעדיף thumbnail (תמיד JPEG) על פני קובץ מקורי (יכול להיות HEIF/WebP).
    """
    if not attachments:
        return None
    att = attachments[0]

    # נסה thumbnail גדול קודם — תמיד JPEG
    thumb_url = att.get("thumbnails", {}).get("large", {}).get("url")
    full_url  = att.get("url")
    
    for url in [thumb_url, full_url]:
        if not url:
            continue
        try:
            res = requests.get(url, timeout=20)
            ct  = res.headers.get("Content-Type", "")
            if res.ok and "image" in ct and "heif" not in ct and "heic" not in ct:
                log.info(f"הורדתי {label} ✓ ({ct})")
                return base64.standard_b64encode(res.content).decode("utf-8")
            elif res.ok and ("heif" in ct or "heic" in ct):
                log.warning(f"{label}: פורמט HEIF לא נתמך, מנסה thumbnail")
        except Exception as e:
            log.warning(f"לא הצלחתי להוריד {label} מ-{url}: {e}")
    
    log.warning(f"לא נמצאה תמונה תואמת עבור {label}")
    return None


# ─── Claude AI — Vision + Caption ─────────────────────────────────────────────

def generate_caption(record, extra_instructions=""):
    """
    כותב קפשן בהתבסס על תמונות לפני/אחרי + פרטי העבודה.
    """
    log.info("יוצר קפשן עם Claude Vision...")

    fields        = record.get("fields", {})
    client        = fields.get(CONFIG["FLD_CLIENT"], "")
    items         = fields.get(CONFIG["FLD_ITEMS"], "")
    color         = fields.get(CONFIG["FLD_COLOR"], "")
    notes         = fields.get(CONFIG["FLD_NOTES"], "")
    before_pics   = fields.get(CONFIG["FLD_BEFORE_PIC"], [])
    after_pics    = fields.get(CONFIG["FLD_AFTER_PIC"], [])

    brand_voice    = load_brand_voice()
    feedback_notes = load_feedback_for_caption()

    system_ctx = f"{brand_voice}\n\n{feedback_notes}".strip()

    # בנה תיאור טקסטואלי של הפריט
    job_desc = []
    if items:  job_desc.append(f"פריט: {items}")
    if color:  job_desc.append(f"צבע: {color}")
    if notes:  job_desc.append(f"הערות: {notes}")
    job_text = " | ".join(job_desc) if job_desc else "עבודת צביעה באבקה"

    caption_prompt = f"""אתה רואה תמונות לפני ואחרי של עבודת צביעה באבקה.

פרטי העבודה: {job_text}
{f'הוראות ספציפיות לפוסט זה: {extra_instructions}' if extra_instructions else ''}

כתוב קפשן בעברית לפוסט בפייסבוק/אינסטגרם.

חוקים מחייבים:
✓ אורך: 60-100 מילים בדיוק — לא יותר, לא פחות
✓ פתיחה: משפט אחד חזק שמתאר את התוצאה שנראית בתמונה
✓ גוף: 2-3 משפטים על האיכות, העמידות, המקצועיות
✓ סיום: קריאה לפעולה אחת ברורה (פנו אלינו / צרו קשר)
✓ שורה נפרדת בסוף עם בדיוק 5 האשטאגים: #צביעהבאבקה #powdercoating #ציפוימתכות #גימורמקצועי #איכות
✓ לא יותר מ-2 אמוג'י בכל הפוסט
✓ טון מקצועי — לא קזואלי, לא מוגזם

החזר רק את הקפשן המוכן לפרסום, ללא הסברים."""

    # הורד תמונות
    before_b64 = get_image_b64_from_attachment(before_pics, "before")
    after_b64  = get_image_b64_from_attachment(after_pics,  "after")

    # בנה content עם התמונות הזמינות
    content = []
    if before_b64:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": before_b64}})
    if after_b64:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": after_b64}})
    content.append({"type": "text", "text": caption_prompt})

    if before_b64 or after_b64:
        log.info(f"שולח {'2 תמונות' if before_b64 and after_b64 else 'תמונה אחת'} ל-Claude Vision")
    else:
        log.warning("אין תמונות — כותב קפשן לפי פרטים טקסטואליים בלבד")

    res = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
                "Content-Type": "application/json",
                "x-api-key": CONFIG["ANTHROPIC_API_KEY"],
                "anthropic-version": "2023-06-01"
            },
        json={
            "model":      "claude-sonnet-4-20250514",
            "max_tokens": 1000,
            "system":     system_ctx,
            "messages":   [{"role": "user", "content": content}]
        }
    )
    res.raise_for_status()
    caption = res.json()["content"][0]["text"].strip()
    log.info("קפשן נוצר ✓")
    return caption


# ─── סיכום פידבקים ────────────────────────────────────────────────────────────

def run_feedback_summary_flow():
    log.info("מתחיל סיכום פידבקים...")
    data          = load_json(FEEDBACK_FILE, {"feedbacks": [], "last_summary": "", "unsummarized_count": 0})
    all_feedbacks = data.get("feedbacks", [])
    brand_voice   = load_brand_voice()
    if not all_feedbacks:
        return

    all_lines = []
    for fb in all_feedbacks:
        marker = "🆕" if not fb.get("summarized") else "  "
        all_lines.append(f"{marker} {fb['date']}: {fb['feedback']}")
    all_text = "\n".join(all_lines)

    prompt = f"""קובץ brand_voice נוכחי:\n---\n{brand_voice}\n---\n
כל הפידבקים (🆕 = חדשים):\n---\n{all_text}\n---\n
1. כתוב סיכום תמציתי (5-8 נקודות) של מה שנלמד.
2. כתוב גרסה מעודכנת של brand_voice המשלבת את הלמידה.
החזר JSON בלבד:
{{"summary": "...", "updated_brand_voice": "..."}}"""

    res = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
                "Content-Type": "application/json",
                "x-api-key": CONFIG["ANTHROPIC_API_KEY"],
                "anthropic-version": "2023-06-01"
            },
        json={"model": "claude-sonnet-4-20250514", "max_tokens": 2000,
              "messages": [{"role": "user", "content": prompt}]}
    )
    res.raise_for_status()
    raw    = res.json()["content"][0]["text"].strip()
    result = json.loads(raw.replace("```json","").replace("```","").strip())

    new_summary     = result["summary"]
    new_brand_voice = result["updated_brand_voice"]

    _send_telegram_message(
        f"🧠 *סיכום פידבקים*\n\nכל הפידבקים:\n━━━━━━━━━━━━━━━━━━━━\n{all_text}\n━━━━━━━━━━━━━━━━━━━━"
    )
    keyboard = {"inline_keyboard": [[
        {"text": "✅ אשר ועדכן", "callback_data": "summary_approve"},
        {"text": "❌ דחה",       "callback_data": "summary_reject"}
    ]]}
    _send_telegram_message(
        f"📝 *הסיכום:*\n━━━━━━━━━━━━━━━━━━━━\n{new_summary}\n━━━━━━━━━━━━━━━━━━━━\n\n"
        f"📄 *brand\\_voice מוצע:*\n━━━━━━━━━━━━━━━━━━━━\n{new_brand_voice}\n━━━━━━━━━━━━━━━━━━━━\n\n"
        f"✅ אשר | ❌ דחה | או שלח גרסה ערוכה כטקסט",
        keyboard=keyboard
    )

    decision, edited = _poll_for_summary_decision(new_brand_voice)
    if decision == "approve":
        with open(BRAND_VOICE_FILE, "w", encoding="utf-8") as f:
            f.write(edited or new_brand_voice)
        for fb in data["feedbacks"]:
            fb["summarized"] = True
        data["last_summary"]       = new_summary
        data["unsummarized_count"] = 0
        save_json(FEEDBACK_FILE, data)
        _send_telegram_message("✅ *brand\\_voice עודכן בהצלחה!*")
    else:
        _send_telegram_message("⏭ הסיכום נדחה.")

def _poll_for_summary_decision(proposed):
    last_id = None
    while True:
        try:
            params = {"timeout": 30, "allowed_updates": ["callback_query", "message"]}
            if last_id:
                params["offset"] = last_id + 1
            res     = requests.get(f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/getUpdates",
                                   params=params, timeout=35)
            updates = res.json().get("result", [])
            for u in updates:
                last_id = u["update_id"]
                if "callback_query" in u:
                    cb = u["callback_query"]
                    requests.post(f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/answerCallbackQuery",
                                  json={"callback_query_id": cb["id"]})
                    if cb.get("data") == "summary_approve": return "approve", proposed
                    if cb.get("data") == "summary_reject":  return "reject", None
                if "message" in u:
                    text = u["message"].get("text","")
                    if text and not text.startswith("/"):
                        _send_telegram_message("✏️ קיבלתי גרסה ערוכה. מעדכן...")
                        return "approve", text
        except Exception as e:
            log.warning(f"polling סיכום: {e}")
            time.sleep(5)


# ─── Telegram ─────────────────────────────────────────────────────────────────

def _send_telegram_photo(photo_url, caption, keyboard=None):
    """שולח תמונה עם טקסט לטלגרם"""
    payload = {
        "chat_id": CONFIG["TELEGRAM_CHAT_ID"],
        "photo":   photo_url,
        "caption": caption,
        "disable_notification": False
    }
    if keyboard:
        payload["reply_markup"] = keyboard
    try:
        res = requests.post(
            f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/sendPhoto",
            json=payload
        )
        if not res.ok:
            log.error(f"שגיאת שליחת תמונה {res.status_code}: {res.text}")
            # fallback להודעת טקסט
            _send_telegram_message(caption, keyboard)
        else:
            log.info("תמונה נשלחה לטלגרם ✓")
    except Exception as e:
        log.error(f"שגיאת טלגרם: {e}")


def _send_telegram_message(text, keyboard=None):
    payload = {
        "chat_id": CONFIG["TELEGRAM_CHAT_ID"],
        "text": text,
        "disable_web_page_preview": True
    }
    if keyboard:
        payload["reply_markup"] = keyboard
    try:
        res = requests.post(f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/sendMessage", json=payload)
        if not res.ok:
            log.error(f"שגיאת טלגרם {res.status_code}: {res.text}")
        else:
            log.info("הודעת טלגרם נשלחה ✓")
    except Exception as e:
        log.error(f"שגיאת טלגרם: {e}")

def send_approval_request(record, caption, attempt=1):
    fields      = record.get("fields", {})
    items       = fields.get(CONFIG["FLD_ITEMS"], "")
    color       = fields.get(CONFIG["FLD_COLOR"], "")
    attempt_txt = f" (ניסיון #{attempt})" if attempt > 1 else ""

    after_pics  = fields.get(CONFIG["FLD_AFTER_PIC"], [])
    before_pics = fields.get(CONFIG["FLD_BEFORE_PIC"], [])
    primary     = after_pics or before_pics
    if primary:
        att = primary[0]
        att_type = att.get("type", "")
        if "heif" in att_type or "heic" in att_type:
            image_url = att.get("thumbnails", {}).get("large", {}).get("url") or att.get("url", "")
        else:
            image_url = att.get("url", "")
    else:
        image_url = ""

    keyboard = {"inline_keyboard": [[
        {"text": "✅ אשר ופרסם",   "callback_data": f"approve_{record['id']}"},
        {"text": "❌ דלג על פוסט", "callback_data": f"skip_{record['id']}"}
    ]]}

    text = (
        f"קפשן לאישור{attempt_txt}\n"
        f"{items} | {color}\n\n"
        f"---\n{caption}\n---\n\n"
        f"✅ אשר ופרסם  |  ❌ דלג\n"
        f"או כתוב הוראות לתיקון הקפשן"
    )

    # שלח תמונה עם הקפשן כ-caption
    if image_url:
        _send_telegram_photo(image_url, text, keyboard)
    else:
        _send_telegram_message(text, keyboard)

def poll_for_decision(record_id):
    """מחזיר: ('approve', None) | ('skip', None) | ('reject', feedback_text)"""
    log.info("ממתין להחלטה...")
    last_id = None
    while True:
        try:
            params = {"timeout": 30, "allowed_updates": ["callback_query", "message"]}
            if last_id:
                params["offset"] = last_id + 1
            res     = requests.get(f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/getUpdates",
                                   params=params, timeout=35)
            updates = res.json().get("result", [])
            for u in updates:
                last_id = u["update_id"]
                if "callback_query" in u:
                    cb   = u["callback_query"]
                    data = cb.get("data","")
                    requests.post(f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/answerCallbackQuery",
                                  json={"callback_query_id": cb["id"]})
                    if data == f"approve_{record_id}":
                        return "approve", None
                    if data == f"skip_{record_id}":
                        _send_telegram_message("⏭ *הפוסט דולג.* לא יוצע שוב.")
                        return "skip", None

                if "message" in u:
                    text = u["message"].get("text","")
                    if text and not text.startswith("/"):
                        _send_telegram_message(
                            "✏️ *קיבלתי הוראות תיקון.* כותב גרסה חדשה...\n\n"
                            "• הערה רגילה — תישמר לכל הפוסטים הבאים\n"
                            "• התחל ב *עכשיו:* — רק לפוסט הזה, לא נשמר"
                        )
                        return "reject", text
        except Exception as e:
            log.warning(f"polling: {e}")
            time.sleep(5)

def send_publish_notification(record, caption, fb_url, ig_url):
    fields = record.get("fields", {})
    items  = fields.get(CONFIG["FLD_ITEMS"], "")
    color  = fields.get(CONFIG["FLD_COLOR"], "")
    _send_telegram_message(
        f"✅ *פורסם בהצלחה!* — {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
        f"🔧 {items} | {color}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━\n📋 *הקפשן — העתק והדבק:*\n━━━━━━━━━━━━━━━━━━━━\n"
        f"{caption}\n━━━━━━━━━━━━━━━━━━━━\n\n"
        f"🔗 *פורסם ב:*\n📘 [פייסבוק]({fb_url})\n📸 [אינסטגרם]({ig_url})\n\n"
        f"📌 *השלבים הבאים:*\n"
        f"1️⃣ פרופיל פייסבוק → שתף מהדף\n"
        f"2️⃣ טיקטוק → הורד תמונה → העתק קפשן"
    )

def send_error_notification(msg):
    _send_telegram_message(f"⚠️ *שגיאה בסוכן*\n\n`{msg}`")


# ─── Facebook ─────────────────────────────────────────────────────────────────

def publish_photo_to_facebook(image_url, caption):
    log.info("מפרסם לפייסבוק...")
    res = requests.post(
        f"https://graph.facebook.com/v19.0/{CONFIG['FB_PAGE_ID']}/photos",
        json={"url": image_url, "caption": caption, "access_token": CONFIG["FB_PAGE_TOKEN"]}
    )
    res.raise_for_status()
    post_id = res.json().get("post_id") or res.json().get("id")
    log.info(f"פייסבוק ✓ {post_id}")
    return post_id, f"https://www.facebook.com/{CONFIG['FB_PAGE_ID']}/posts/{post_id}"


# ─── Instagram ────────────────────────────────────────────────────────────────

def publish_photo_to_instagram(image_url, caption):
    log.info("מפרסם לאינסטגרם...")
    res = requests.post(
        f"https://graph.facebook.com/v19.0/{CONFIG['IG_ACCOUNT_ID']}/media",
        json={"image_url": image_url, "caption": caption, "access_token": CONFIG["FB_PAGE_TOKEN"]}
    )
    res.raise_for_status()
    container_id = res.json()["id"]
    time.sleep(10)
    res2 = requests.post(
        f"https://graph.facebook.com/v19.0/{CONFIG['IG_ACCOUNT_ID']}/media_publish",
        json={"creation_id": container_id, "access_token": CONFIG["FB_PAGE_TOKEN"]}
    )
    res2.raise_for_status()
    post_id = res2.json()["id"]
    log.info(f"אינסטגרם ✓ {post_id}")
    return post_id, f"https://www.instagram.com/p/{post_id}/"


# ─── לוגיקה מרכזית ────────────────────────────────────────────────────────────

def run_publish_flow():
    record = fetch_ready_record()

    if not record:
        _send_telegram_message(
            "📭 *אין פוסטים מוכנים לפרסום*\n\n"
            "סמן שורה כ-'מוכן לפרסום' באיירטייבל כדי להתחיל."
        )
        return

    # לולאת אישור
    attempt     = 1
    extra_notes = ""
    caption     = generate_caption(record, extra_notes)

    while True:
        send_approval_request(record, caption, attempt)
        decision, feedback = poll_for_decision(record["id"])

        if decision == "approve":
            break

        if decision == "skip":
            mark_as_skipped(record["id"])
            return

        if decision == "reject":
            if feedback.strip().startswith("עכשיו:"):
                extra_notes = feedback.strip()[len("עכשיו:"):].strip()
                _send_telegram_message("⚡ *פידבק נקודתי* — לא נשמר.")
            else:
                save_feedback(feedback)
                extra_notes = feedback
            caption = generate_caption(record, extra_notes)
            attempt += 1

    # פרסום — שימוש ב-after pic כתמונה הראשית
    fields      = record.get("fields", {})
    after_pics  = fields.get(CONFIG["FLD_AFTER_PIC"], [])
    before_pics = fields.get(CONFIG["FLD_BEFORE_PIC"], [])
    primary_pics = after_pics or before_pics
    if primary_pics:
        att = primary_pics[0]
        att_type = att.get("type", "")
        # אם HEIF — השתמש ב-thumbnail
        if "heif" in att_type or "heic" in att_type:
            image_url = att.get("thumbnails", {}).get("large", {}).get("url") or att.get("url")
            log.info("שימוש ב-thumbnail (קובץ מקורי HEIF)")
        else:
            image_url = att.get("url")
    else:
        image_url = None

    if not image_url:
        send_error_notification("לא נמצאה תמונה לפרסום בשורה הזו")
        return

    fb_id,  fb_url  = publish_photo_to_facebook(image_url, caption)
    ig_id,  ig_url  = publish_photo_to_instagram(image_url, caption)

    send_publish_notification(record, caption, fb_url, ig_url)
    mark_as_published(record["id"])
    log.info("✅ פורסם בהצלחה!")


def run():
    log.info("=" * 50)
    log.info("סוכן פרסום — הרצה יומית")
    log.info("=" * 50)
    try:
        run_publish_flow()
    except Exception as e:
        log.error(f"שגיאה: {e}", exc_info=True)
        send_error_notification(str(e))
        raise


if __name__ == "__main__":
    run()
