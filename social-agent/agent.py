"""
׳¡׳•׳›׳ ׳₪׳¨׳¡׳•׳ ׳׳•׳˜׳•׳׳˜׳™
Airtable ג†’ Claude Vision ג†’ Facebook + Instagram ג†’ Telegram ׳׳׳™׳©׳•׳¨
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


# ג”€ג”€ג”€ ׳§׳‘׳¦׳™ ׳ ׳×׳•׳ ׳™׳ ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

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
        parts.append(f"## ׳¢׳§׳¨׳•׳ ׳•׳× ׳©׳ ׳׳׳“׳• ׳׳₪׳™׳“׳‘׳§ ׳§׳•׳“׳:\n{last_summary}")
    if unsummarized:
        parts.append("## ׳₪׳™׳“׳‘׳§׳™׳ ׳©׳˜׳¨׳ ׳¡׳•׳›׳׳•:")
        for fb in unsummarized:
            parts.append(f"- {fb['date']}: {fb['feedback']}")
    return "\n\n".join(parts)

def save_feedback(text):
    data = load_json(FEEDBACK_FILE, {"feedbacks": [], "last_summary": "", "unsummarized_count": 0})
    data["feedbacks"].append({"date": datetime.now().strftime("%Y-%m-%d"), "feedback": text, "summarized": False})
    data["unsummarized_count"] = data.get("unsummarized_count", 0) + 1
    save_json(FEEDBACK_FILE, data)
    log.info(f"׳₪׳™׳“׳‘׳§ ׳ ׳©׳׳¨ ג“ ({data['unsummarized_count']} ׳׳ ׳׳¡׳•׳›׳׳™׳)")
    if data["unsummarized_count"] >= SUMMARIZE_AFTER_N_FEEDBACKS:
        run_feedback_summary_flow()


# ג”€ג”€ג”€ Airtable ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def fetch_ready_record():
    """
    ׳©׳•׳׳£ ׳©׳•׳¨׳” ׳׳•׳›׳ ׳” ׳׳₪׳¨׳¡׳•׳ ׳•׳׳•׳¨׳™׳“ ׳×׳׳•׳ ׳•׳× ׳׳™׳“.
    ׳׳—׳–׳™׳¨ (record, before_b64, after_b64) ג€” ׳”-URLs ׳₪׳•׳§׳¢׳™׳ ׳׳”׳¨.
    """
    log.info("׳׳—׳₪׳© ׳©׳•׳¨׳” ׳׳•׳›׳ ׳” ׳׳₪׳¨׳¡׳•׳ ׳‘׳׳™׳™׳¨׳˜׳™׳™׳‘׳...")
    ready_id     = CONFIG["FLD_READY"]
    published_id = CONFIG["FLD_PUBLISHED"]
    params = {
        "filterByFormula": f"AND({{{ready_id}}}=1, NOT({{{published_id}}}))",
        "maxRecords": 1,
        "sort[0][field]": CONFIG["FLD_READY"],
        "sort[0][direction]": "asc"
    }
    res = requests.get(AIRTABLE_BASE, headers=AIRTABLE_HEADERS, params=params, timeout=15)
    res.raise_for_status()
    records = res.json().get("records", [])
    if not records:
        log.info("׳׳™׳ ׳©׳•׳¨׳•׳× ׳׳•׳›׳ ׳•׳× ׳׳₪׳¨׳¡׳•׳")
        return None, None, None
    record = records[0]
    log.info(f"׳ ׳׳¦׳׳” ׳©׳•׳¨׳”: {record['id']}")

    # ׳”׳•׳¨׳“ ׳×׳׳•׳ ׳•׳× ׳׳™׳“ ׳׳₪׳ ׳™ ׳©׳”-URLs ׳₪׳•׳§׳¢׳™׳
    fields     = record.get("fields", {})
    before_b64 = _download_attachment_b64(fields.get(CONFIG["FLD_BEFORE_PIC"], []), "before")
    after_b64  = _download_attachment_b64(fields.get(CONFIG["FLD_AFTER_PIC"],  []), "after")
    return record, before_b64, after_b64


def _download_attachment_b64(attachments, label):
    """׳׳•׳¨׳™׳“ attachment ׳•׳׳—׳–׳™׳¨ base64"""
    if not attachments:
        return None
    att      = attachments[0]
    att_type = att.get("type", "")
    if "heif" in att_type or "heic" in att_type:
        url = att.get("thumbnails", {}).get("large", {}).get("url") or att.get("url")
        log.info(f"{label}: HEIF ג€” ׳׳©׳×׳׳© ׳‘-thumbnail")
    else:
        url = att.get("url")
    if not url:
        return None
    try:
        r = requests.get(url, timeout=20)
        log.info(f"{label}: status={r.status_code}, type={r.headers.get('Content-Type','?')}, size={len(r.content)}")
        if r.ok and len(r.content) > 1000:
            return base64.standard_b64encode(r.content).decode("utf-8")
        log.warning(f"{label}: ׳”׳•׳¨׳“׳” ׳ ׳›׳©׳׳”")
    except Exception as e:
        log.warning(f"{label}: {e}")
    return None

def mark_as_published(record_id):
    """׳׳¡׳׳ ׳׳× ׳”׳©׳•׳¨׳” ׳›-׳₪׳•׳¨׳¡׳=true ׳‘׳׳™׳™׳¨׳˜׳™׳™׳‘׳"""
    res = requests.patch(
        f"{AIRTABLE_BASE}/{record_id}",
        headers=AIRTABLE_HEADERS,
        json={"fields": {CONFIG["FLD_PUBLISHED"]: True}}
    )
    res.raise_for_status()
    log.info(f"׳©׳•׳¨׳” {record_id} ׳¡׳•׳׳ ׳” ׳›׳₪׳•׳¨׳¡׳ ג“")

def mark_as_skipped(record_id):
    """׳“׳™׳׳•׳’ ג€” ׳׳¡׳׳ ׳₪׳•׳¨׳¡׳=true ׳›׳“׳™ ׳©׳׳ ׳™׳•׳¦׳¢ ׳©׳•׳‘"""
    mark_as_published(record_id)
    log.info(f"׳©׳•׳¨׳” {record_id} ׳“׳•׳׳’׳” ג“")

def get_image_b64_from_attachment(attachments, label="׳×׳׳•׳ ׳”"):
    """
    ׳׳•׳¨׳™׳“ ׳×׳׳•׳ ׳” ׳-attachment ׳•׳׳—׳–׳™׳¨ base64.
    ׳׳¢׳“׳™׳£ thumbnail (׳×׳׳™׳“ JPEG) ׳¢׳ ׳₪׳ ׳™ ׳§׳•׳‘׳¥ ׳׳§׳•׳¨׳™ (׳™׳›׳•׳ ׳׳”׳™׳•׳× HEIF/WebP).
    """
    if not attachments:
        return None
    att = attachments[0]

    # ׳ ׳¡׳” thumbnail ׳’׳“׳•׳ ׳§׳•׳“׳ ג€” ׳×׳׳™׳“ JPEG
    thumb_url = att.get("thumbnails", {}).get("large", {}).get("url")
    full_url  = att.get("url")
    
    for url in [thumb_url, full_url]:
        if not url:
            continue
        try:
            res = requests.get(url, timeout=20)
            ct  = res.headers.get("Content-Type", "")
            log.info(f"{label}: status={res.status_code}, content-type={ct}, size={len(res.content)}")
            if not res.ok:
                log.warning(f"{label}: HTTP {res.status_code}")
                continue
            if "heif" in ct or "heic" in ct:
                log.warning(f"{label}: HEIF ג€” ׳׳ ׳¡׳” thumbnail")
                continue
            if len(res.content) < 1000:
                log.warning(f"{label}: ׳×׳’׳•׳‘׳” ׳§׳¦׳¨׳” ׳׳“׳™ ({len(res.content)} bytes)")
                continue
            log.info(f"׳”׳•׳¨׳“׳×׳™ {label} ג“")
            return base64.standard_b64encode(res.content).decode("utf-8")
        except Exception as e:
            log.warning(f"׳©׳’׳™׳׳× ׳”׳•׳¨׳“׳” {label}: {e}")
    
    log.warning(f"׳׳ ׳ ׳׳¦׳׳” ׳×׳׳•׳ ׳” ׳¢׳‘׳•׳¨ {label}")
    return None


# ג”€ג”€ג”€ Claude AI ג€” Vision + Caption ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def generate_caption(record, extra_instructions="", before_b64=None, after_b64=None):
    """
    ׳›׳•׳×׳‘ ׳§׳₪׳©׳ ׳‘׳”׳×׳‘׳¡׳¡ ׳¢׳ ׳×׳׳•׳ ׳•׳× ׳׳₪׳ ׳™/׳׳—׳¨׳™ + ׳₪׳¨׳˜׳™ ׳”׳¢׳‘׳•׳“׳”.
    ׳׳§׳‘׳ ׳×׳׳•׳ ׳•׳× ׳™׳©׳™׳¨׳•׳× ׳›-base64 (׳”׳•׳¨׳“׳• ׳›׳‘׳¨ ׳‘-fetch_ready_record).
    """
    log.info("׳™׳•׳¦׳¨ ׳§׳₪׳©׳ ׳¢׳ Claude Vision...")

    fields = record.get("fields", {})
    items  = fields.get(CONFIG["FLD_ITEMS"], "")
    color  = fields.get(CONFIG["FLD_COLOR"], "")
    notes  = fields.get(CONFIG["FLD_NOTES"], "")

    brand_voice    = load_brand_voice()
    feedback_notes = load_feedback_for_caption()

    system_ctx = f"{brand_voice}\n\n{feedback_notes}".strip()

    # ׳‘׳ ׳” ׳×׳™׳׳•׳¨ ׳˜׳§׳¡׳˜׳•׳׳׳™ ׳©׳ ׳”׳₪׳¨׳™׳˜
    job_desc = []
    if items:  job_desc.append(f"׳₪׳¨׳™׳˜: {items}")
    if color:  job_desc.append(f"׳¦׳‘׳¢: {color}")
    if notes:  job_desc.append(f"׳”׳¢׳¨׳•׳×: {notes}")
    job_text = " | ".join(job_desc) if job_desc else "׳¢׳‘׳•׳“׳× ׳¦׳‘׳™׳¢׳” ׳‘׳׳‘׳§׳”"

    caption_prompt = f"""׳׳×׳” ׳›׳•׳×׳‘ ׳₪׳•׳¡׳˜ ׳¢׳‘׳•׳¨ Rightek ג€” ׳¢׳¡׳§ ׳׳¦׳‘׳™׳¢׳” ׳‘׳׳‘׳§׳” ׳•׳ ׳™׳§׳•׳™ ׳—׳•׳.

׳₪׳¨׳˜׳™ ׳”׳¢׳‘׳•׳“׳”: {job_text}
{f'׳”׳•׳¨׳׳•׳× ׳¡׳₪׳¦׳™׳₪׳™׳•׳×: {extra_instructions}' if extra_instructions else ''}

׳›׳×׳•׳‘ ׳‘׳“׳™׳•׳§ 3 ׳©׳•׳¨׳•׳×, ׳׳₪׳™ ׳”׳׳‘׳ ׳” ׳”׳‘׳ ג€” ׳׳׳ ׳¡׳˜׳™׳™׳”:

׳©׳•׳¨׳” 1: ׳×׳™׳׳•׳¨ ׳¢׳•׳‘׳“׳×׳™ ׳©׳ ׳”׳—׳׳§, ׳”׳×׳”׳׳™׳ ׳•׳”׳’׳•׳•׳. (׳׳“׳•׳’׳׳”: "׳¡׳˜ ׳’׳׳ ׳˜׳™׳ ׳׳—׳¨׳™ ׳ ׳™׳§׳•׳™ ׳—׳•׳ ׳•׳¦׳‘׳¢ ׳‘׳׳‘׳§׳”.")
׳©׳•׳¨׳” 2: ׳™׳×׳¨׳•׳ ׳˜׳›׳ ׳™ ׳׳—׳“ ׳‘׳׳‘׳“ ׳©׳ ׳”׳¦׳‘׳™׳¢׳” ׳׳—׳׳§ ׳–׳”. (׳׳“׳•׳’׳׳”: "׳”׳¦׳‘׳™׳¢׳” ׳¢׳׳™׳“׳” ׳™׳•׳×׳¨ ׳׳©׳¨׳™׳˜׳•׳× ׳׳¦׳‘׳™׳¢׳” ׳¨׳’׳™׳׳”.")
׳©׳•׳¨׳” 3: ׳‘׳“׳™׳•׳§ ׳›׳ ׳׳׳ ׳©׳™׳ ׳•׳™: "׳׳₪׳¨׳˜׳™׳ ׳ ׳™׳×׳ ׳׳™׳¦׳•׳¨ ׳§׳©׳¨ ׳‘׳•׳•׳¦׳׳₪ 054-6500543"

׳©׳•׳¨׳” ׳¨׳™׳§׳”.
5 ׳”׳׳©׳˜׳׳’׳™׳ ׳”׳¨׳׳•׳•׳ ׳˜׳™׳™׳ ׳׳—׳׳§ ׳•׳׳×׳”׳׳™׳, ׳›׳•׳׳ #Rightek ׳×׳׳™׳“.

׳׳¡׳•׳¨: ׳׳—׳׳׳•׳×, ׳¡׳•׳₪׳¨׳׳˜׳™׳‘׳™׳, ׳”׳׳™׳׳™׳ "׳׳“׳”׳™׳/׳׳•׳©׳׳/׳•׳•׳׳•/׳׳”׳₪׳", ׳׳׳•׳’'׳™, ׳™׳•׳×׳¨ ׳-3 ׳©׳•׳¨׳•׳×.
׳”׳—׳–׳¨ ׳¨׳§ ׳׳× ׳”׳₪׳•׳¡׳˜ ׳”׳׳•׳›׳."""

    # ׳”׳•׳¨׳“ ׳×׳׳•׳ ׳•׳×
    before_b64 = get_image_b64_from_attachment(before_pics, "before")
    after_b64  = get_image_b64_from_attachment(after_pics,  "after")

    # ׳‘׳ ׳” content ׳¢׳ ׳”׳×׳׳•׳ ׳•׳× ׳”׳–׳׳™׳ ׳•׳×
    content = []
    if before_b64:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": before_b64}})
    if after_b64:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": after_b64}})
    content.append({"type": "text", "text": caption_prompt})

    if not before_b64 and not after_b64:
        log.warning("׳׳™׳ ׳×׳׳•׳ ׳•׳× ג€” ׳׳“׳׳’, ׳׳ ׳׳‘׳–׳‘׳– ׳˜׳•׳§׳ ׳™׳")
        raise ValueError("NO_IMAGES")
    log.info(f"׳©׳•׳׳— {'2 ׳×׳׳•׳ ׳•׳×' if before_b64 and after_b64 else '׳×׳׳•׳ ׳” ׳׳—׳×'} ׳-Claude Vision")

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
    log.info("׳§׳₪׳©׳ ׳ ׳•׳¦׳¨ ג“")
    return caption


# ג”€ג”€ג”€ ׳¡׳™׳›׳•׳ ׳₪׳™׳“׳‘׳§׳™׳ ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def run_feedback_summary_flow():
    log.info("׳׳×׳—׳™׳ ׳¡׳™׳›׳•׳ ׳₪׳™׳“׳‘׳§׳™׳...")
    data          = load_json(FEEDBACK_FILE, {"feedbacks": [], "last_summary": "", "unsummarized_count": 0})
    all_feedbacks = data.get("feedbacks", [])
    brand_voice   = load_brand_voice()
    if not all_feedbacks:
        return

    all_lines = []
    for fb in all_feedbacks:
        marker = "נ†•" if not fb.get("summarized") else "  "
        all_lines.append(f"{marker} {fb['date']}: {fb['feedback']}")
    all_text = "\n".join(all_lines)

    prompt = f"""׳§׳•׳‘׳¥ brand_voice ׳ ׳•׳›׳—׳™:\n---\n{brand_voice}\n---\n
׳›׳ ׳”׳₪׳™׳“׳‘׳§׳™׳ (נ†• = ׳—׳“׳©׳™׳):\n---\n{all_text}\n---\n
1. ׳›׳×׳•׳‘ ׳¡׳™׳›׳•׳ ׳×׳׳¦׳™׳×׳™ (5-8 ׳ ׳§׳•׳“׳•׳×) ׳©׳ ׳׳” ׳©׳ ׳׳׳“.
2. ׳›׳×׳•׳‘ ׳’׳¨׳¡׳” ׳׳¢׳•׳“׳›׳ ׳× ׳©׳ brand_voice ׳”׳׳©׳׳‘׳× ׳׳× ׳”׳׳׳™׳“׳”.
׳”׳—׳–׳¨ JSON ׳‘׳׳‘׳“:
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
        f"נ§  *׳¡׳™׳›׳•׳ ׳₪׳™׳“׳‘׳§׳™׳*\n\n׳›׳ ׳”׳₪׳™׳“׳‘׳§׳™׳:\nג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”\n{all_text}\nג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”"
    )
    keyboard = {"inline_keyboard": [[
        {"text": "ג… ׳׳©׳¨ ׳•׳¢׳“׳›׳", "callback_data": "summary_approve"},
        {"text": "ג ׳“׳—׳”",       "callback_data": "summary_reject"}
    ]]}
    _send_telegram_message(
        f"נ“ *׳”׳¡׳™׳›׳•׳:*\nג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”\n{new_summary}\nג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”\n\n"
        f"נ“„ *brand\\_voice ׳׳•׳¦׳¢:*\nג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”\n{new_brand_voice}\nג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”\n\n"
        f"ג… ׳׳©׳¨ | ג ׳“׳—׳” | ׳׳• ׳©׳׳— ׳’׳¨׳¡׳” ׳¢׳¨׳•׳›׳” ׳›׳˜׳§׳¡׳˜",
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
        _send_telegram_message("ג… *brand\\_voice ׳¢׳•׳“׳›׳ ׳‘׳”׳¦׳׳—׳”!*")
    else:
        _send_telegram_message("ג­ ׳”׳¡׳™׳›׳•׳ ׳ ׳“׳—׳”.")

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
                        _send_telegram_message("גן¸ ׳§׳™׳‘׳׳×׳™ ׳’׳¨׳¡׳” ׳¢׳¨׳•׳›׳”. ׳׳¢׳“׳›׳...")
                        return "approve", text
        except Exception as e:
            log.warning(f"polling ׳¡׳™׳›׳•׳: {e}")
            time.sleep(5)


# ג”€ג”€ג”€ Telegram ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def _send_telegram_photo(photo_url, caption, keyboard=None):
    """׳׳•׳¨׳™׳“ ׳×׳׳•׳ ׳” ׳•׳©׳•׳׳— ׳׳•׳×׳” ׳׳˜׳׳’׳¨׳ ׳›-bytes"""
    try:
        # ׳”׳•׳¨׳“ ׳׳× ׳”׳×׳׳•׳ ׳”
        img_res = requests.get(photo_url, timeout=15)
        if not img_res.ok:
            log.error(f"׳׳ ׳”׳¦׳׳—׳×׳™ ׳׳”׳•׳¨׳™׳“ ׳×׳׳•׳ ׳” ׳׳˜׳׳’׳¨׳: {img_res.status_code}")
            _send_telegram_message(caption, keyboard)
            return

        # ׳©׳׳— ׳›-multipart
        files = {"photo": ("image.jpg", img_res.content, "image/jpeg")}
        data  = {
            "chat_id": CONFIG["TELEGRAM_CHAT_ID"],
            "caption": caption,
        }
        if keyboard:
            import json as _json
            data["reply_markup"] = _json.dumps(keyboard)

        res = requests.post(
            f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/sendPhoto",
            data=data,
            files=files
        )
        if not res.ok:
            log.error(f"׳©׳’׳™׳׳× ׳©׳׳™׳—׳× ׳×׳׳•׳ ׳” {res.status_code}: {res.text}")
            _send_telegram_message(caption, keyboard)
        else:
            log.info("׳×׳׳•׳ ׳” ׳ ׳©׳׳—׳” ׳׳˜׳׳’׳¨׳ ג“")
    except Exception as e:
        log.error(f"׳©׳’׳™׳׳× ׳©׳׳™׳—׳× ׳×׳׳•׳ ׳”: {e}")
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
            log.error(f"׳©׳’׳™׳׳× ׳˜׳׳’׳¨׳ {res.status_code}: {res.text}")
        else:
            log.info("׳”׳•׳“׳¢׳× ׳˜׳׳’׳¨׳ ׳ ׳©׳׳—׳” ג“")
    except Exception as e:
        log.error(f"׳©׳’׳™׳׳× ׳˜׳׳’׳¨׳: {e}")

def send_approval_request(record, caption, attempt=1):
    fields      = record.get("fields", {})
    items       = fields.get(CONFIG["FLD_ITEMS"], "")
    color       = fields.get(CONFIG["FLD_COLOR"], "")
    attempt_txt = f" (׳ ׳™׳¡׳™׳•׳ #{attempt})" if attempt > 1 else ""

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
        {"text": "ג… ׳׳©׳¨ ׳•׳₪׳¨׳¡׳",   "callback_data": f"approve_{record['id']}"},
        {"text": "ג ׳“׳׳’ ׳¢׳ ׳₪׳•׳¡׳˜", "callback_data": f"skip_{record['id']}"}
    ]]}

    text = (
        f"׳§׳₪׳©׳ ׳׳׳™׳©׳•׳¨{attempt_txt}\n"
        f"{items} | {color}\n\n"
        f"---\n{caption}\n---\n\n"
        f"ג… ׳׳©׳¨ ׳•׳₪׳¨׳¡׳  |  ג ׳“׳׳’\n"
        f"׳׳• ׳›׳×׳•׳‘ ׳”׳•׳¨׳׳•׳× ׳׳×׳™׳§׳•׳ ׳”׳§׳₪׳©׳"
    )

    # ׳©׳׳— ׳×׳׳•׳ ׳” ׳¢׳ ׳”׳§׳₪׳©׳ ׳›-caption
    if image_url:
        _send_telegram_photo(image_url, text, keyboard)
    else:
        _send_telegram_message(text, keyboard)

def poll_for_decision(record_id):
    """׳׳—׳–׳™׳¨: ('approve', None) | ('skip', None) | ('reject', feedback_text)"""
    log.info("׳׳׳×׳™׳ ׳׳”׳—׳׳˜׳”...")
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
                        _send_telegram_message("ג­ *׳”׳₪׳•׳¡׳˜ ׳“׳•׳׳’.* ׳׳ ׳™׳•׳¦׳¢ ׳©׳•׳‘.")
                        return "skip", None

                if "message" in u:
                    text = u["message"].get("text","")
                    if text and not text.startswith("/"):
                        _send_telegram_message(
                            "גן¸ *׳§׳™׳‘׳׳×׳™ ׳”׳•׳¨׳׳•׳× ׳×׳™׳§׳•׳.* ׳›׳•׳×׳‘ ׳’׳¨׳¡׳” ׳—׳“׳©׳”...\n\n"
                            "ג€¢ ׳”׳¢׳¨׳” ׳¨׳’׳™׳׳” ג€” ׳×׳™׳©׳׳¨ ׳׳›׳ ׳”׳₪׳•׳¡׳˜׳™׳ ׳”׳‘׳׳™׳\n"
                            "ג€¢ ׳”׳×׳—׳ ׳‘ *׳¢׳›׳©׳™׳•:* ג€” ׳¨׳§ ׳׳₪׳•׳¡׳˜ ׳”׳–׳”, ׳׳ ׳ ׳©׳׳¨"
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
        f"ג… *׳₪׳•׳¨׳¡׳ ׳‘׳”׳¦׳׳—׳”!* ג€” {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
        f"נ”§ {items} | {color}\n\n"
        f"ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”\nנ“‹ *׳”׳§׳₪׳©׳ ג€” ׳”׳¢׳×׳§ ׳•׳”׳“׳‘׳§:*\nג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”\n"
        f"{caption}\nג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”ג”\n\n"
        f"נ”— *׳₪׳•׳¨׳¡׳ ׳‘:*\nנ“˜ [׳₪׳™׳™׳¡׳‘׳•׳§]({fb_url})\nנ“¸ [׳׳™׳ ׳¡׳˜׳’׳¨׳]({ig_url})\n\n"
        f"נ“ *׳”׳©׳׳‘׳™׳ ׳”׳‘׳׳™׳:*\n"
        f"1ן¸גƒ£ ׳₪׳¨׳•׳₪׳™׳ ׳₪׳™׳™׳¡׳‘׳•׳§ ג†’ ׳©׳×׳£ ׳׳”׳“׳£\n"
        f"2ן¸גƒ£ ׳˜׳™׳§׳˜׳•׳§ ג†’ ׳”׳•׳¨׳“ ׳×׳׳•׳ ׳” ג†’ ׳”׳¢׳×׳§ ׳§׳₪׳©׳"
    )

def send_error_notification(msg):
    _send_telegram_message(f"ג ן¸ *׳©׳’׳™׳׳” ׳‘׳¡׳•׳›׳*\n\n`{msg}`")


# ג”€ג”€ג”€ Facebook ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def publish_photo_to_facebook(image_url, caption):
    log.info("׳׳₪׳¨׳¡׳ ׳׳₪׳™׳™׳¡׳‘׳•׳§...")
    res = requests.post(
        f"https://graph.facebook.com/v19.0/{CONFIG['FB_PAGE_ID']}/photos",
        json={"url": image_url, "caption": caption, "access_token": CONFIG["FB_PAGE_TOKEN"]}
    )
    res.raise_for_status()
    post_id = res.json().get("post_id") or res.json().get("id")
    log.info(f"׳₪׳™׳™׳¡׳‘׳•׳§ ג“ {post_id}")
    return post_id, f"https://www.facebook.com/{CONFIG['FB_PAGE_ID']}/posts/{post_id}"


# ג”€ג”€ג”€ Instagram ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def publish_photo_to_instagram(image_url, caption):
    log.info("׳׳₪׳¨׳¡׳ ׳׳׳™׳ ׳¡׳˜׳’׳¨׳...")
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
    log.info(f"׳׳™׳ ׳¡׳˜׳’׳¨׳ ג“ {post_id}")
    return post_id, f"https://www.instagram.com/p/{post_id}/"


# ג”€ג”€ג”€ ׳׳•׳’׳™׳§׳” ׳׳¨׳›׳–׳™׳× ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def run_publish_flow():
    import threading
    result = [None]
    error  = [None]

    def _inner():
        try:
            _run_publish_flow_inner()
        except Exception as e:
            error[0] = e

    t = threading.Thread(target=_inner, daemon=True)
    t.start()
    t.join(timeout=120)  # 2 ׳“׳§׳•׳× ׳׳§׳¡׳™׳׳•׳
    if t.is_alive():
        log.error("timeout ג€” ׳”׳×׳”׳׳™׳ ׳×׳§׳•׳¢ ׳׳¢׳ 2 ׳“׳§׳•׳×")
        _send_telegram_message("׳©׳’׳™׳׳”: ׳”׳×׳”׳׳™׳ ׳×׳§׳•׳¢ ׳•׳׳ ׳”׳¡׳×׳™׳™׳ ׳×׳•׳ 2 ׳“׳§׳•׳×. ׳‘׳“׳•׳§ ׳׳× ׳”׳׳•׳’׳™׳ ׳‘-Render.")
        return
    if error[0]:
        raise error[0]


def _run_publish_flow_inner():
    record, before_b64, after_b64 = fetch_ready_record()

    if not record:
        _send_telegram_message("׳׳™׳ ׳₪׳•׳¡׳˜׳™׳ ׳׳•׳›׳ ׳™׳ ׳׳₪׳¨׳¡׳•׳. ׳¡׳׳ ׳©׳•׳¨׳” ׳›׳׳•׳›׳ ׳׳₪׳¨׳¡׳•׳ ׳‘׳׳™׳™׳¨׳˜׳™׳™׳‘׳.")
        return

    if not before_b64 and not after_b64:
        _send_telegram_message("׳׳™׳ ׳×׳׳•׳ ׳•׳× ׳‘׳©׳•׳¨׳” ג€” ׳”׳•׳¡׳£ ׳×׳׳•׳ ׳× ׳׳₪׳ ׳™/׳׳—׳¨׳™ ׳‘׳׳™׳™׳¨׳˜׳™׳™׳‘׳ ׳•׳ ׳¡׳” ׳©׳•׳‘.")
        return

    # ׳׳•׳׳׳× ׳׳™׳©׳•׳¨
    attempt     = 1
    extra_notes = ""
    try:
        caption = generate_caption(record, extra_notes, before_b64, after_b64)
    except ValueError as e:
        if "NO_IMAGES" in str(e):
            _send_telegram_message("׳׳™׳ ׳×׳׳•׳ ׳•׳× ׳‘׳©׳•׳¨׳” ג€” ׳”׳•׳¡׳£ ׳×׳׳•׳ ׳” ׳‘׳׳™׳™׳¨׳˜׳™׳™׳‘׳ ׳•׳ ׳¡׳” ׳©׳•׳‘.")
            return
        raise

    while True:
        send_approval_request(record, caption, attempt)
        decision, feedback = poll_for_decision(record["id"])

        if decision == "approve":
            break

        if decision == "skip":
            mark_as_skipped(record["id"])
            return

        if decision == "reject":
            if feedback.strip().startswith("׳¢׳›׳©׳™׳•:"):
                extra_notes = feedback.strip()[len("׳¢׳›׳©׳™׳•:"):].strip()
                _send_telegram_message("ג¡ *׳₪׳™׳“׳‘׳§ ׳ ׳§׳•׳“׳×׳™* ג€” ׳׳ ׳ ׳©׳׳¨.")
            else:
                save_feedback(feedback)
                extra_notes = feedback
            try:
                caption = generate_caption(record, extra_notes, before_b64, after_b64)
            except ValueError as e:
                if "NO_IMAGES" in str(e):
                    _send_telegram_message("׳׳™׳ ׳×׳׳•׳ ׳•׳× ג€” ׳׳ ׳ ׳™׳×׳ ׳׳›׳×׳•׳‘ ׳₪׳•׳¡׳˜.")
                    return
                raise
            attempt += 1

    # ׳₪׳¨׳¡׳•׳ ג€” ׳©׳™׳׳•׳© ׳‘-after pic ׳›׳×׳׳•׳ ׳” ׳”׳¨׳׳©׳™׳×
    fields      = record.get("fields", {})
    after_pics  = fields.get(CONFIG["FLD_AFTER_PIC"], [])
    before_pics = fields.get(CONFIG["FLD_BEFORE_PIC"], [])
    primary_pics = after_pics or before_pics
    if primary_pics:
        att = primary_pics[0]
        att_type = att.get("type", "")
        # ׳׳ HEIF ג€” ׳”׳©׳×׳׳© ׳‘-thumbnail
        if "heif" in att_type or "heic" in att_type:
            image_url = att.get("thumbnails", {}).get("large", {}).get("url") or att.get("url")
            log.info("׳©׳™׳׳•׳© ׳‘-thumbnail (׳§׳•׳‘׳¥ ׳׳§׳•׳¨׳™ HEIF)")
        else:
            image_url = att.get("url")
    else:
        image_url = None

    if not image_url:
        send_error_notification("׳׳ ׳ ׳׳¦׳׳” ׳×׳׳•׳ ׳” ׳׳₪׳¨׳¡׳•׳ ׳‘׳©׳•׳¨׳” ׳”׳–׳•")
        return

    fb_id,  fb_url  = publish_photo_to_facebook(image_url, caption)
    ig_id,  ig_url  = publish_photo_to_instagram(image_url, caption)

    send_publish_notification(record, caption, fb_url, ig_url)
    mark_as_published(record["id"])
    log.info("ג… ׳₪׳•׳¨׳¡׳ ׳‘׳”׳¦׳׳—׳”!")


def run():
    log.info("=" * 50)
    log.info("׳¡׳•׳›׳ ׳₪׳¨׳¡׳•׳ ג€” ׳”׳¨׳¦׳” ׳™׳•׳׳™׳×")
    log.info("=" * 50)
    try:
        run_publish_flow()
    except Exception as e:
        log.error(f"׳©׳’׳™׳׳”: {e}", exc_info=True)
        send_error_notification(str(e))
        raise


if __name__ == "__main__":
    run()
