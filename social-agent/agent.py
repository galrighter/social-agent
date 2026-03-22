"""
סוכן פרסום אוטומטי — v22 (bank mode + publishing controls)
Airtable → Claude Vision → Telegram approval → save caption → publish later

PREPARE flow: /newpost → generate captions, get approval, save to Airtable
PUBLISH flow: daily at scheduled time (or /publish) → take approved caption, publish to FB+IG
CONTROLS: /pause, /resume, /skip, /next, /bank, /status
"""

import sys
import os
import json
import base64
import logging
import requests
import time
from datetime import datetime

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

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

FLD_APPROVED_CAPTION = "fldVvsn0k69LcSnGz"
PAUSE_FLAG_FILE = "paused.flag"
LOW_BANK_THRESHOLD = 2  # warn when bank drops to this many posts


# ─── Publishing controls ──────────────────────────────────────────────────────

def is_paused():
    return os.path.exists(PAUSE_FLAG_FILE)

def set_paused(paused):
    if paused:
        with open(PAUSE_FLAG_FILE, "w") as f:
            f.write(datetime.now().isoformat())
        log.info("publishing PAUSED")
    else:
        if os.path.exists(PAUSE_FLAG_FILE):
            os.remove(PAUSE_FLAG_FILE)
        log.info("publishing RESUMED")


# ─── Data files ───────────────────────────────────────────────────────────────

def load_json(path, default):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_brand_voice():
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
    log.info(f"feedback saved ({data['unsummarized_count']} unsummarized)")
    if data["unsummarized_count"] >= SUMMARIZE_AFTER_N_FEEDBACKS:
        run_feedback_summary_flow()


# ─── Airtable ─────────────────────────────────────────────────────────────────

def _airtable_get(url, params=None):
    if params is None:
        params = {}
    params["returnFieldsByFieldId"] = "true"
    res = requests.get(url, headers=AIRTABLE_HEADERS, params=params, timeout=15)
    res.raise_for_status()
    return res.json()


def fetch_record_for_preparation():
    log.info("searching for record needing caption...")
    params = {
        "filterByFormula": f"AND({{{CONFIG['FLD_READY']}}}=1, NOT({{{CONFIG['FLD_PUBLISHED']}}}), {{{FLD_APPROVED_CAPTION}}}='')",
        "maxRecords": 1,
        "sort[0][field]": CONFIG["FLD_READY"],
        "sort[0][direction]": "asc"
    }
    data = _airtable_get(AIRTABLE_BASE, params)
    records = data.get("records", [])
    if not records:
        log.info("no records needing captions")
        return None, None, None
    record = records[0]
    log.info(f"found record for preparation: {record['id']}")

    before_atts = _refetch_fresh_attachments(record["id"], CONFIG["FLD_BEFORE_PIC"])
    after_atts  = _refetch_fresh_attachments(record["id"], CONFIG["FLD_AFTER_PIC"])
    log.info(f"before: {len(before_atts)} attachments, after: {len(after_atts)} attachments")

    before_b64 = _download_attachment_b64(before_atts, "before")
    after_b64  = _download_attachment_b64(after_atts,  "after")
    return record, before_b64, after_b64


def fetch_record_for_publishing():
    log.info("searching for record ready to publish...")
    params = {
        "filterByFormula": f"AND({{{FLD_APPROVED_CAPTION}}}!='', {{{FLD_APPROVED_CAPTION}}}!='[דולג]', NOT({{{CONFIG['FLD_PUBLISHED']}}}), {{{CONFIG['FLD_READY']}}}=1)",
        "maxRecords": 1,
        "sort[0][field]": CONFIG["FLD_READY"],
        "sort[0][direction]": "asc"
    }
    data = _airtable_get(AIRTABLE_BASE, params)
    records = data.get("records", [])
    if not records:
        log.info("no approved posts waiting to be published")
        return None
    record = records[0]
    log.info(f"found record for publishing: {record['id']}")
    return record


def count_bank():
    try:
        params = {
            "filterByFormula": f"AND({{{FLD_APPROVED_CAPTION}}}!='', {{{FLD_APPROVED_CAPTION}}}!='[דולג]', NOT({{{CONFIG['FLD_PUBLISHED']}}}), {{{CONFIG['FLD_READY']}}}=1)",
            "returnFieldsByFieldId": "true",
            "pageSize": 100
        }
        res = requests.get(AIRTABLE_BASE, headers=AIRTABLE_HEADERS, params=params, timeout=15)
        res.raise_for_status()
        return len(res.json().get("records", []))
    except Exception:
        return -1


def _refetch_fresh_attachments(record_id, field_id):
    try:
        data = _airtable_get(f"{AIRTABLE_BASE}/{record_id}")
        atts = data.get("fields", {}).get(field_id, [])
        if atts:
            log.info(f"refetch {field_id}: {len(atts)} attachment(s), type={atts[0].get('type','?')}")
        else:
            log.warning(f"refetch {field_id}: empty")
        return atts
    except Exception as e:
        log.warning(f"refetch error: {e}")
    return []


def _download_attachment_b64(attachments, label):
    if not attachments:
        return None
    att      = attachments[0]
    att_type = att.get("type", "")
    att_name = att.get("filename", "?")

    urls_to_try = []
    thumb_url = att.get("thumbnails", {}).get("large", {}).get("url")
    full_url  = att.get("url")

    if "heif" in att_type or "heic" in att_type:
        if thumb_url: urls_to_try.append(("thumbnail", thumb_url))
        if full_url:  urls_to_try.append(("original", full_url))
        log.info(f"{label}: HEIF detected ({att_name}), preferring thumbnail")
    else:
        if full_url:  urls_to_try.append(("original", full_url))
        if thumb_url: urls_to_try.append(("thumbnail", thumb_url))

    headers = {"User-Agent": "Mozilla/5.0 (compatible; SocialAgent/1.0)"}

    for source, url in urls_to_try:
        try:
            r = requests.get(url, timeout=20, headers=headers)
            ct   = r.headers.get("Content-Type", "?")
            size = len(r.content)
            log.info(f"{label} [{source}]: status={r.status_code}, type={ct}, size={size}")

            if not r.ok:
                log.warning(f"{label} [{source}]: HTTP {r.status_code} — {r.text[:200]}")
                continue
            if "heif" in ct or "heic" in ct:
                log.warning(f"{label} [{source}]: HEIF content-type, skipping")
                continue
            if size < 1000:
                log.warning(f"{label} [{source}]: too small ({size} bytes)")
                continue

            log.info(f"{label}: downloaded OK from {source} ({size} bytes)")
            return base64.standard_b64encode(r.content).decode("utf-8")
        except Exception as e:
            log.warning(f"{label} [{source}]: error — {e}")

    log.warning(f"{label}: all download attempts failed")
    return None


def save_approved_caption(record_id, caption):
    res = requests.patch(
        f"{AIRTABLE_BASE}/{record_id}",
        headers=AIRTABLE_HEADERS,
        json={"fields": {FLD_APPROVED_CAPTION: caption}}
    )
    res.raise_for_status()
    log.info(f"caption saved to Airtable for {record_id}")


def mark_as_published(record_id):
    res = requests.patch(
        f"{AIRTABLE_BASE}/{record_id}",
        headers=AIRTABLE_HEADERS,
        json={"fields": {CONFIG["FLD_PUBLISHED"]: True}}
    )
    res.raise_for_status()
    log.info(f"record {record_id} marked as published")


def mark_as_skipped(record_id):
    res = requests.patch(
        f"{AIRTABLE_BASE}/{record_id}",
        headers=AIRTABLE_HEADERS,
        json={"fields": {FLD_APPROVED_CAPTION: "[דולג]"}}
    )
    res.raise_for_status()
    log.info(f"record {record_id} skipped")


# ─── Claude AI ────────────────────────────────────────────────────────────────

def generate_caption(record, extra_instructions="", before_b64=None, after_b64=None):
    log.info("generating caption with Claude Vision...")

    fields = record.get("fields", {})
    items  = fields.get(CONFIG["FLD_ITEMS"], "")
    color  = fields.get(CONFIG["FLD_COLOR"], "")
    notes  = fields.get(CONFIG["FLD_NOTES"], "")

    brand_voice    = load_brand_voice()
    feedback_notes = load_feedback_for_caption()
    system_ctx = f"{brand_voice}\n\n{feedback_notes}".strip()

    job_desc = []
    if items:  job_desc.append(f"פריט: {items}")
    if color:  job_desc.append(f"צבע: {color}")
    if notes:  job_desc.append(f"הערות: {notes}")
    job_text = " | ".join(job_desc) if job_desc else "עבודת צביעה באבקה"

    caption_prompt = f"""אתה כותב פוסט עבור Rightek — עסק לצביעה באבקה וניקוי חול.

פרטי העבודה: {job_text}
{f'הוראות ספציפיות: {extra_instructions}' if extra_instructions else ''}

כתוב בדיוק 3 שורות, לפי המבנה הבא — ללא סטייה:

שורה 1: תיאור עובדתי של החלק, התהליך והגוון. (לדוגמה: "סט גאנטים אחרי ניקוי חול וצבע באבקה.")
שורה 2: יתרון טכני אחד בלבד של הצביעה לחלק זה. (לדוגמה: "הצביעה עמידה יותר לשריטות מצביעה רגילה.")
שורה 3: בדיוק כך ללא שינוי: "לפרטים ניתן ליצור קשר בווצאפ 054-6500543"

שורה ריקה.
5 האשטאגים הרלוונטיים לחלק ולתהליך, כולל #Rightek תמיד.

אסור: מחמאות, סופרלטיבים, המילים "מדהים/מושלם/וואו/מהפך", אמוג'י, יותר מ-3 שורות.
החזר רק את הפוסט המוכן."""

    content = []
    if before_b64:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": before_b64}})
    if after_b64:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": after_b64}})
    content.append({"type": "text", "text": caption_prompt})

    if not before_b64 and not after_b64:
        log.warning("no images — skipping")
        raise ValueError("NO_IMAGES")

    img_count = sum(1 for x in [before_b64, after_b64] if x)
    log.info(f"sending {img_count} image(s) to Claude Vision")

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
    log.info("caption generated OK")
    return caption


# ─── Feedback summary ─────────────────────────────────────────────────────────

def run_feedback_summary_flow():
    log.info("starting feedback summary...")
    data          = load_json(FEEDBACK_FILE, {"feedbacks": [], "last_summary": "", "unsummarized_count": 0})
    all_feedbacks = data.get("feedbacks", [])
    brand_voice   = load_brand_voice()
    if not all_feedbacks:
        return

    all_lines = []
    for fb in all_feedbacks:
        marker = "NEW" if not fb.get("summarized") else "   "
        all_lines.append(f"{marker} {fb['date']}: {fb['feedback']}")
    all_text = "\n".join(all_lines)

    prompt = f"""קובץ brand_voice נוכחי:\n---\n{brand_voice}\n---\n
כל הפידבקים (NEW = חדשים):\n---\n{all_text}\n---\n
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
        f"Feedback summary\n\nAll feedbacks:\n{'=' * 20}\n{all_text}\n{'=' * 20}"
    )
    keyboard = {"inline_keyboard": [[
        {"text": "✅ אשר ועדכן", "callback_data": "summary_approve"},
        {"text": "❌ דחה",       "callback_data": "summary_reject"}
    ]]}
    _send_telegram_message(
        f"Summary:\n{'=' * 20}\n{new_summary}\n{'=' * 20}\n\n"
        f"Proposed brand_voice:\n{'=' * 20}\n{new_brand_voice}\n{'=' * 20}\n\n"
        f"approve / reject / or send edited text",
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
        _send_telegram_message("brand_voice updated!")
    else:
        _send_telegram_message("summary rejected.")

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
                        _send_telegram_message("got edited version, updating...")
                        return "approve", text
        except Exception as e:
            log.warning(f"summary polling: {e}")
            time.sleep(5)


# ─── Telegram ─────────────────────────────────────────────────────────────────

def _send_telegram_photo(photo_url, caption, keyboard=None):
    try:
        img_res = requests.get(photo_url, timeout=15,
                               headers={"User-Agent": "Mozilla/5.0 (compatible; SocialAgent/1.0)"})
        if not img_res.ok:
            log.error(f"telegram photo download failed: {img_res.status_code}")
            _send_telegram_message(caption, keyboard)
            return

        files = {"photo": ("image.jpg", img_res.content, "image/jpeg")}
        data  = {
            "chat_id": CONFIG["TELEGRAM_CHAT_ID"],
            "caption": caption,
        }
        if keyboard:
            data["reply_markup"] = json.dumps(keyboard, ensure_ascii=False)

        res = requests.post(
            f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/sendPhoto",
            data=data,
            files=files
        )
        if not res.ok:
            log.error(f"telegram sendPhoto error {res.status_code}: {res.text}")
            _send_telegram_message(caption, keyboard)
        else:
            log.info("telegram photo sent OK")
    except Exception as e:
        log.error(f"telegram photo error: {e}")
        _send_telegram_message(caption, keyboard)


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
            log.error(f"telegram error {res.status_code}: {res.text}")
        else:
            log.info("telegram message sent OK")
    except Exception as e:
        log.error(f"telegram error: {e}")


def _get_image_url_from_record(record):
    after_atts  = _refetch_fresh_attachments(record["id"], CONFIG["FLD_AFTER_PIC"])
    before_atts = _refetch_fresh_attachments(record["id"], CONFIG["FLD_BEFORE_PIC"])
    primary = after_atts or before_atts
    if not primary:
        return ""
    att = primary[0]
    att_type = att.get("type", "")
    if "heif" in att_type or "heic" in att_type:
        return att.get("thumbnails", {}).get("large", {}).get("url") or att.get("url", "")
    return att.get("url", "")


def send_approval_request(record, caption, attempt=1):
    fields      = record.get("fields", {})
    items       = fields.get(CONFIG["FLD_ITEMS"], "")
    color       = fields.get(CONFIG["FLD_COLOR"], "")
    attempt_txt = f" (attempt #{attempt})" if attempt > 1 else ""

    image_url = _get_image_url_from_record(record)

    keyboard = {"inline_keyboard": [[
        {"text": "✅ אשר",  "callback_data": f"approve_{record['id']}"},
        {"text": "❌ דלג",  "callback_data": f"skip_{record['id']}"}
    ]]}

    text = (
        f"caption for approval{attempt_txt}\n"
        f"{items} | {color}\n\n"
        f"---\n{caption}\n---\n\n"
        f"✅ approve  |  ❌ skip\n"
        f"or write correction instructions"
    )

    if image_url:
        _send_telegram_photo(image_url, text, keyboard)
    else:
        _send_telegram_message(text, keyboard)


def poll_for_decision(record_id):
    log.info("waiting for decision...")
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
                        _send_telegram_message("post skipped.")
                        return "skip", None
                if "message" in u:
                    text = u["message"].get("text","")
                    if text and not text.startswith("/"):
                        _send_telegram_message("got correction instructions, writing new version...")
                        return "reject", text
        except Exception as e:
            log.warning(f"polling: {e}")
            time.sleep(5)


def send_error_notification(msg):
    _send_telegram_message(f"agent error:\n\n{msg}")


# ─── Facebook ─────────────────────────────────────────────────────────────────

def publish_photo_to_facebook(image_url, caption):
    log.info("publishing to Facebook...")
    res = requests.post(
        f"https://graph.facebook.com/v19.0/{CONFIG['FB_PAGE_ID']}/photos",
        json={"url": image_url, "caption": caption, "access_token": CONFIG["FB_PAGE_TOKEN"]}
    )
    res.raise_for_status()
    post_id = res.json().get("post_id") or res.json().get("id")
    log.info(f"Facebook OK: {post_id}")
    return post_id, f"https://www.facebook.com/{CONFIG['FB_PAGE_ID']}/posts/{post_id}"


# ─── Instagram ────────────────────────────────────────────────────────────────

def publish_photo_to_instagram(image_url, caption):
    log.info("publishing to Instagram...")
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
    log.info(f"Instagram OK: {post_id}")
    return post_id, f"https://www.instagram.com/p/{post_id}/"


# ═══════════════════════════════════════════════════════════════════════════════
# FLOW 1: PREPARE
# ═══════════════════════════════════════════════════════════════════════════════

def run_prepare_flow():
    log.info("=" * 50)
    log.info("PREPARE FLOW")
    log.info("=" * 50)

    count = 0
    while True:
        record, before_b64, after_b64 = fetch_record_for_preparation()

        if not record:
            if count == 0:
                _send_telegram_message("no records need captions. mark rows as ready in Airtable and add photos.")
            else:
                bank = count_bank()
                _send_telegram_message(f"done — {count} caption(s) saved to bank.\nBank total: {bank} post(s) ready.")
            return

        if not before_b64 and not after_b64:
            fields = record.get("fields", {})
            items  = fields.get(CONFIG["FLD_ITEMS"], "?")
            _send_telegram_message(f"record {items} has no downloadable images — skipping.")
            mark_as_skipped(record["id"])
            continue

        try:
            caption = generate_caption(record, "", before_b64, after_b64)
        except ValueError as e:
            if "NO_IMAGES" in str(e):
                _send_telegram_message("no images — skipping this record.")
                mark_as_skipped(record["id"])
                continue
            raise

        attempt     = 1
        extra_notes = ""
        while True:
            send_approval_request(record, caption, attempt)
            decision, feedback = poll_for_decision(record["id"])

            if decision == "approve":
                save_approved_caption(record["id"], caption)
                count += 1
                _send_telegram_message(f"caption #{count} saved to bank. checking for more...")
                break

            if decision == "skip":
                mark_as_skipped(record["id"])
                break

            if decision == "reject":
                if feedback.strip().startswith("עכשיו:"):
                    extra_notes = feedback.strip()[len("עכשיו:"):].strip()
                    _send_telegram_message("one-time feedback — not saved.")
                else:
                    save_feedback(feedback)
                    extra_notes = feedback
                try:
                    caption = generate_caption(record, extra_notes, before_b64, after_b64)
                except ValueError:
                    _send_telegram_message("no images — cannot rewrite.")
                    mark_as_skipped(record["id"])
                    break
                attempt += 1


# ═══════════════════════════════════════════════════════════════════════════════
# FLOW 2: PUBLISH
# ═══════════════════════════════════════════════════════════════════════════════

def run_publish_flow(force=False):
    log.info("=" * 50)
    log.info("PUBLISH FLOW")
    log.info("=" * 50)

    if is_paused() and not force:
        log.info("publishing is PAUSED — skipping")
        return

    record = fetch_record_for_publishing()
    if not record:
        log.info("nothing to publish")
        return

    fields  = record.get("fields", {})
    caption = fields.get(FLD_APPROVED_CAPTION, "")
    items   = fields.get(CONFIG["FLD_ITEMS"], "")
    color   = fields.get(CONFIG["FLD_COLOR"], "")

    if not caption or caption == "[דולג]":
        log.warning("record has no valid caption — skipping")
        return

    image_url = _get_image_url_from_record(record)
    if not image_url:
        send_error_notification(f"no image URL for publishing ({items})")
        return

    try:
        fb_id,  fb_url  = publish_photo_to_facebook(image_url, caption)
        ig_id,  ig_url  = publish_photo_to_instagram(image_url, caption)
    except Exception as e:
        send_error_notification(f"publish failed: {e}")
        raise

    _send_telegram_message(
        f"published! — {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
        f"{items} | {color}\n\n"
        f"{'=' * 20}\n{caption}\n{'=' * 20}\n\n"
        f"FB: {fb_url}\nIG: {ig_url}\n\n"
        f"1. share from FB page to personal profile\n"
        f"2. TikTok: download image + copy caption"
    )

    mark_as_published(record["id"])
    log.info("published successfully!")

    # Low bank warning
    remaining = count_bank()
    if 0 < remaining <= LOW_BANK_THRESHOLD:
        _send_telegram_message(
            f"heads up: only {remaining} post(s) left in bank.\n"
            f"send /newpost to prepare more."
        )
    elif remaining == 0:
        _send_telegram_message(
            "bank is empty! no posts for tomorrow.\n"
            "send /newpost to prepare more."
        )


def run_skip_next():
    """Skip the next post in the bank without publishing it."""
    record = fetch_record_for_publishing()
    if not record:
        _send_telegram_message("nothing to skip — bank is empty.")
        return
    fields = record.get("fields", {})
    items  = fields.get(CONFIG["FLD_ITEMS"], "?")
    caption = fields.get(FLD_APPROVED_CAPTION, "?")
    mark_as_published(record["id"])
    remaining = count_bank()
    _send_telegram_message(
        f"skipped: {items}\n"
        f"caption was:\n---\n{caption[:200]}\n---\n\n"
        f"Bank: {remaining} post(s) remaining."
    )


def run_preview_next():
    """Preview the next post that would be published."""
    record = fetch_record_for_publishing()
    if not record:
        _send_telegram_message("bank is empty — nothing to preview.")
        return
    fields  = record.get("fields", {})
    items   = fields.get(CONFIG["FLD_ITEMS"], "")
    color   = fields.get(CONFIG["FLD_COLOR"], "")
    caption = fields.get(FLD_APPROVED_CAPTION, "")

    image_url = _get_image_url_from_record(record)

    text = (
        f"next post to be published:\n\n"
        f"{items} | {color}\n\n"
        f"---\n{caption}\n---"
    )

    if image_url:
        _send_telegram_photo(image_url, text)
    else:
        _send_telegram_message(text)


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRY POINTS
# ═══════════════════════════════════════════════════════════════════════════════

def run():
    """Daily scheduled run."""
    try:
        run_publish_flow()
    except Exception as e:
        log.error(f"publish error: {e}", exc_info=True)
        send_error_notification(str(e))

def run_prepare():
    """On-demand caption preparation."""
    try:
        run_prepare_flow()
    except Exception as e:
        log.error(f"prepare error: {e}", exc_info=True)
        send_error_notification(str(e))

if __name__ == "__main__":
    run_prepare()
