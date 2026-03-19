"""
׳¡׳•׳›׳ ׳₪׳¨׳¡׳•׳ ׳׳•׳˜׳•׳׳˜׳™ ג€” v20
Airtable ג†’ Claude Vision ג†’ Facebook + Instagram ג†’ Telegram ׳׳׳™׳©׳•׳¨

׳©׳™׳ ׳•׳™׳™׳ ׳-v19:
- ׳×׳™׳§׳•׳ ׳§׳¨׳™׳˜׳™: returnFieldsByFieldId=true ׳‘׳›׳ ׳§׳¨׳™׳׳•׳× Airtable
- ׳×׳™׳§׳•׳ encoding: LANG/LC_ALL + reconfigure
- ׳ ׳™׳§׳•׳™ ׳§׳•׳“ ׳›׳₪׳•׳ (get_image_b64_from_attachment ׳”׳•׳¡׳¨ ג€” _download_attachment_b64 ׳¢׳•׳©׳” ׳׳× ׳׳•׳×׳• ׳“׳‘׳¨)
"""

import sys
import os
import json
import base64
import logging
import requests
import time
from datetime import datetime

# ג”€ג”€ ׳›׳•׳₪׳” UTF-8 ׳¢׳ stdout/stderr ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
# ׳¢׳•׳‘׳“ ׳‘׳©׳™׳׳•׳‘ ׳¢׳ PYTHONIOENCODING=utf-8 + LANG=C.UTF-8 ׳‘-Render env vars
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass  # ׳׳ reconfigure ׳׳ ׳ ׳×׳׳ ג€” ׳”-env vars ׳™׳¢׳©׳• ׳׳× ׳”׳¢׳‘׳•׳“׳”

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
    log.info(f"feedback saved ({data['unsummarized_count']} unsummarized)")
    if data["unsummarized_count"] >= SUMMARIZE_AFTER_N_FEEDBACKS:
        run_feedback_summary_flow()


# ג”€ג”€ג”€ Airtable ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def fetch_ready_record():
    """
    ׳©׳•׳׳£ ׳©׳•׳¨׳” ׳׳•׳›׳ ׳” ׳׳₪׳¨׳¡׳•׳ ׳•׳׳•׳¨׳™׳“ ׳×׳׳•׳ ׳•׳× ׳׳™׳“.
    ׳׳—׳–׳™׳¨ (record, before_b64, after_b64).
    """
    log.info("searching Airtable for ready record...")
    ready_id     = CONFIG["FLD_READY"]
    published_id = CONFIG["FLD_PUBLISHED"]
    params = {
        "filterByFormula": f"AND({{{ready_id}}}=1, NOT({{{published_id}}}))",
        "maxRecords": 1,
        "sort[0][field]": ready_id,
        "sort[0][direction]": "asc",
        "returnFieldsByFieldId": "true"    # <ג”€ג”€ ׳”׳×׳™׳§׳•׳ ׳”׳§׳¨׳™׳˜׳™
    }
    res = requests.get(AIRTABLE_BASE, headers=AIRTABLE_HEADERS, params=params, timeout=15)
    res.raise_for_status()
    records = res.json().get("records", [])
    if not records:
        log.info("no ready records found")
        return None, None, None
    record = records[0]
    log.info(f"found record: {record['id']}")

    # ׳׳•׳’ ׳©׳“׳•׳× ׳©׳—׳–׳¨׳• ג€” ׳׳׳‘׳—׳•׳
    field_keys = list(record.get("fields", {}).keys())
    log.info(f"record fields: {field_keys}")

    # ׳©׳׳•׳£ URLs ׳˜׳¨׳™׳™׳ ׳™׳©׳¨ ׳׳₪׳ ׳™ ׳”׳•׳¨׳“׳” (signed URLs ׳₪׳•׳§׳¢׳™׳)
    record_id   = record["id"]
    before_atts = _refetch_fresh_attachments(record_id, CONFIG["FLD_BEFORE_PIC"])
    after_atts  = _refetch_fresh_attachments(record_id, CONFIG["FLD_AFTER_PIC"])

    log.info(f"before attachments: {len(before_atts)}, after attachments: {len(after_atts)}")

    before_b64 = _download_attachment_b64(before_atts, "before")
    after_b64  = _download_attachment_b64(after_atts,  "after")
    return record, before_b64, after_b64


def _refetch_fresh_attachments(record_id, field_id):
    """׳©׳•׳׳£ attachment URLs ׳˜׳¨׳™׳™׳ ׳™׳©׳™׳¨׳•׳× ׳׳₪׳ ׳™ ׳”׳•׳¨׳“׳”"""
    try:
        res = requests.get(
            f"{AIRTABLE_BASE}/{record_id}",
            headers=AIRTABLE_HEADERS,
            params={"returnFieldsByFieldId": "true"},    # <ג”€ג”€ ׳”׳×׳™׳§׳•׳ ׳”׳§׳¨׳™׳˜׳™
            timeout=10
        )
        if res.ok:
            atts = res.json().get("fields", {}).get(field_id, [])
            if atts:
                log.info(f"refetch {field_id}: got {len(atts)} attachment(s), type={atts[0].get('type','?')}")
            else:
                log.warning(f"refetch {field_id}: empty ג€” field not found or no attachments")
            return atts
        else:
            log.warning(f"refetch failed: HTTP {res.status_code}")
    except Exception as e:
        log.warning(f"refetch error: {e}")
    return []


def _download_attachment_b64(attachments, label):
    """׳׳•׳¨׳™׳“ attachment ׳•׳׳—׳–׳™׳¨ base64. ׳׳ ׳¡׳” thumbnail ׳§׳•׳“׳ (׳×׳׳™׳“ JPEG)."""
    if not attachments:
        return None
    att      = attachments[0]
    att_type = att.get("type", "")
    att_name = att.get("filename", "?")

    # ׳‘׳ ׳” ׳¨׳©׳™׳׳× URLs ׳׳ ׳¡׳•׳× ג€” thumbnail ׳§׳•׳“׳ (׳×׳׳™׳“ JPEG), ׳׳—"׳› ׳׳§׳•׳¨׳™
    urls_to_try = []
    thumb_url = att.get("thumbnails", {}).get("large", {}).get("url")
    full_url  = att.get("url")

    if "heif" in att_type or "heic" in att_type:
        # HEIF ג€” ׳—׳™׳™׳‘׳™׳ thumbnail
        if thumb_url:
            urls_to_try.append(("thumbnail", thumb_url))
        if full_url:
            urls_to_try.append(("original", full_url))
        log.info(f"{label}: HEIF detected ({att_name}), preferring thumbnail")
    else:
        # JPEG/PNG ג€” ׳ ׳¡׳” ׳׳§׳•׳¨׳™ ׳§׳•׳“׳, thumbnail ׳›-fallback
        if full_url:
            urls_to_try.append(("original", full_url))
        if thumb_url:
            urls_to_try.append(("thumbnail", thumb_url))

    headers = {"User-Agent": "Mozilla/5.0 (compatible; SocialAgent/1.0)"}

    for source, url in urls_to_try:
        try:
            r = requests.get(url, timeout=20, headers=headers)
            ct   = r.headers.get("Content-Type", "?")
            size = len(r.content)
            log.info(f"{label} [{source}]: status={r.status_code}, type={ct}, size={size}")

            if not r.ok:
                log.warning(f"{label} [{source}]: HTTP {r.status_code} ג€” {r.text[:200]}")
                continue

            if "heif" in ct or "heic" in ct:
                log.warning(f"{label} [{source}]: got HEIF content-type, skipping")
                continue

            if size < 1000:
                log.warning(f"{label} [{source}]: response too small ({size} bytes)")
                continue

            log.info(f"{label}: downloaded OK from {source} ({size} bytes)")
            return base64.standard_b64encode(r.content).decode("utf-8")

        except Exception as e:
            log.warning(f"{label} [{source}]: error ג€” {e}")

    log.warning(f"{label}: all download attempts failed")
    return None


def mark_as_published(record_id):
    """׳׳¡׳׳ ׳׳× ׳”׳©׳•׳¨׳” ׳›-׳₪׳•׳¨׳¡׳=true ׳‘׳׳™׳™׳¨׳˜׳™׳™׳‘׳"""
    res = requests.patch(
        f"{AIRTABLE_BASE}/{record_id}",
        headers=AIRTABLE_HEADERS,
        json={"fields": {CONFIG["FLD_PUBLISHED"]: True}}
    )
    res.raise_for_status()
    log.info(f"record {record_id} marked as published")

def mark_as_skipped(record_id):
    mark_as_published(record_id)
    log.info(f"record {record_id} skipped")


# ג”€ג”€ג”€ Claude AI ג€” Vision + Caption ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def generate_caption(record, extra_instructions="", before_b64=None, after_b64=None):
    """׳›׳•׳×׳‘ ׳§׳₪׳©׳ ׳‘׳”׳×׳‘׳¡׳¡ ׳¢׳ ׳×׳׳•׳ ׳•׳× ׳׳₪׳ ׳™/׳׳—׳¨׳™ + ׳₪׳¨׳˜׳™ ׳”׳¢׳‘׳•׳“׳”."""
    log.info("generating caption with Claude Vision...")

    fields = record.get("fields", {})
    items  = fields.get(CONFIG["FLD_ITEMS"], "")
    color  = fields.get(CONFIG["FLD_COLOR"], "")
    notes  = fields.get(CONFIG["FLD_NOTES"], "")

    brand_voice    = load_brand_voice()
    feedback_notes = load_feedback_for_caption()

    system_ctx = f"{brand_voice}\n\n{feedback_notes}".strip()

    # ׳×׳™׳׳•׳¨ ׳˜׳§׳¡׳˜׳•׳׳׳™
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

    # ׳‘׳ ׳” content ׳¢׳ ׳×׳׳•׳ ׳•׳×
    content = []
    if before_b64:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": before_b64}})
    if after_b64:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": after_b64}})
    content.append({"type": "text", "text": caption_prompt})

    if not before_b64 and not after_b64:
        log.warning("no images ג€” skipping caption generation")
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


# ג”€ג”€ג”€ ׳¡׳™׳›׳•׳ ׳₪׳™׳“׳‘׳§׳™׳ ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def run_feedback_summary_flow():
    log.info("starting feedback summary...")
    data          = load_json(FEEDBACK_FILE, {"feedbacks": [], "last_summary": "", "unsummarized_count": 0})
    all_feedbacks = data.get("feedbacks", [])
    brand_voice   = load_brand_voice()
    if not all_feedbacks:
        return

    all_lines = []
    for fb in all_feedbacks:
        marker = "NEW" if not fb.get("summarized") else "  "
        all_lines.append(f"{marker} {fb['date']}: {fb['feedback']}")
    all_text = "\n".join(all_lines)

    prompt = f"""׳§׳•׳‘׳¥ brand_voice ׳ ׳•׳›׳—׳™:\n---\n{brand_voice}\n---\n
׳›׳ ׳”׳₪׳™׳“׳‘׳§׳™׳ (NEW = ׳—׳“׳©׳™׳):\n---\n{all_text}\n---\n
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
        f"feedback summary\n\nAll feedbacks:\n{'=' * 20}\n{all_text}\n{'=' * 20}"
    )
    keyboard = {"inline_keyboard": [[
        {"text": "ג… ׳׳©׳¨ ׳•׳¢׳“׳›׳", "callback_data": "summary_approve"},
        {"text": "ג ׳“׳—׳”",       "callback_data": "summary_reject"}
    ]]}
    _send_telegram_message(
        f"Summary:\n{'=' * 20}\n{new_summary}\n{'=' * 20}\n\n"
        f"Proposed brand_voice:\n{'=' * 20}\n{new_brand_voice}\n{'=' * 20}\n\n"
        f"ג… approve | ג reject | or send edited version as text",
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


# ג”€ג”€ג”€ Telegram ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def _send_telegram_photo(photo_url, caption, keyboard=None):
    """׳׳•׳¨׳™׳“ ׳×׳׳•׳ ׳” ׳•׳©׳•׳׳— ׳׳•׳×׳” ׳׳˜׳׳’׳¨׳ ׳›-bytes"""
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
            data["reply_markup"] = json.dumps(keyboard)

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

def send_approval_request(record, caption, attempt=1):
    fields      = record.get("fields", {})
    items       = fields.get(CONFIG["FLD_ITEMS"], "")
    color       = fields.get(CONFIG["FLD_COLOR"], "")
    attempt_txt = f" (attempt #{attempt})" if attempt > 1 else ""

    # ׳©׳׳•׳£ URL ׳˜׳¨׳™ ׳׳×׳׳•׳ ׳” (signed URLs ׳₪׳•׳§׳¢׳™׳)
    after_atts  = _refetch_fresh_attachments(record["id"], CONFIG["FLD_AFTER_PIC"])
    before_atts = _refetch_fresh_attachments(record["id"], CONFIG["FLD_BEFORE_PIC"])
    primary     = after_atts or before_atts

    image_url = ""
    if primary:
        att = primary[0]
        att_type = att.get("type", "")
        if "heif" in att_type or "heic" in att_type:
            image_url = att.get("thumbnails", {}).get("large", {}).get("url") or att.get("url", "")
        else:
            image_url = att.get("url", "")

    keyboard = {"inline_keyboard": [[
        {"text": "ג… ׳׳©׳¨ ׳•׳₪׳¨׳¡׳",   "callback_data": f"approve_{record['id']}"},
        {"text": "ג ׳“׳׳’ ׳¢׳ ׳₪׳•׳¡׳˜", "callback_data": f"skip_{record['id']}"}
    ]]}

    text = (
        f"caption for approval{attempt_txt}\n"
        f"{items} | {color}\n\n"
        f"---\n{caption}\n---\n\n"
        f"ג… approve & publish  |  ג skip\n"
        f"or write correction instructions"
    )

    if image_url:
        _send_telegram_photo(image_url, text, keyboard)
    else:
        _send_telegram_message(text, keyboard)

def poll_for_decision(record_id):
    """׳׳—׳–׳™׳¨: ('approve', None) | ('skip', None) | ('reject', feedback_text)"""
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
                        _send_telegram_message(
                            "got correction instructions, writing new version..."
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
        f"published! ג€” {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
        f"{items} | {color}\n\n"
        f"{'=' * 20}\ncaption:\n{'=' * 20}\n"
        f"{caption}\n{'=' * 20}\n\n"
        f"FB: {fb_url}\nIG: {ig_url}\n\n"
        f"next steps:\n"
        f"1. share from FB page to personal profile\n"
        f"2. TikTok: download image + copy caption"
    )

def send_error_notification(msg):
    _send_telegram_message(f"agent error:\n\n{msg}")


# ג”€ג”€ג”€ Facebook ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

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


# ג”€ג”€ג”€ Instagram ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

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


# ג”€ג”€ג”€ ׳׳•׳’׳™׳§׳” ׳׳¨׳›׳–׳™׳× ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

def run_publish_flow():
    import threading
    error = [None]

    def _inner():
        try:
            _run_publish_flow_inner()
        except Exception as e:
            error[0] = e

    t = threading.Thread(target=_inner, daemon=True)
    t.start()
    t.join(timeout=120)
    if t.is_alive():
        log.error("timeout ג€” process stuck for 2+ minutes")
        _send_telegram_message("error: process stuck for 2+ minutes. check Render logs.")
        return
    if error[0]:
        raise error[0]


def _run_publish_flow_inner():
    record, before_b64, after_b64 = fetch_ready_record()

    if not record:
        _send_telegram_message("no ready posts. mark a row as ready in Airtable.")
        return

    if not before_b64 and not after_b64:
        _send_telegram_message(
            "found record but no images downloaded.\n"
            f"record: {record['id']}\n"
            f"fields: {list(record.get('fields', {}).keys())}\n"
            "check that before/after pic fields have attachments."
        )
        return

    # ׳׳•׳׳׳× ׳׳™׳©׳•׳¨
    attempt     = 1
    extra_notes = ""
    try:
        caption = generate_caption(record, extra_notes, before_b64, after_b64)
    except ValueError as e:
        if "NO_IMAGES" in str(e):
            _send_telegram_message("no images in record ג€” add an image in Airtable and retry.")
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
                _send_telegram_message("one-time feedback ג€” not saved.")
            else:
                save_feedback(feedback)
                extra_notes = feedback
            try:
                caption = generate_caption(record, extra_notes, before_b64, after_b64)
            except ValueError as e:
                if "NO_IMAGES" in str(e):
                    _send_telegram_message("no images ג€” cannot write post.")
                    return
                raise
            attempt += 1

    # ׳₪׳¨׳¡׳•׳ ג€” ׳©׳׳•׳£ URL ׳˜׳¨׳™ (׳”׳™׳©׳ ׳›׳‘׳¨ ׳₪׳’ ׳‘׳–׳׳ ׳©׳—׳™׳›׳™׳× ׳׳׳™׳©׳•׳¨)
    after_atts  = _refetch_fresh_attachments(record["id"], CONFIG["FLD_AFTER_PIC"])
    before_atts = _refetch_fresh_attachments(record["id"], CONFIG["FLD_BEFORE_PIC"])
    primary_atts = after_atts or before_atts

    image_url = None
    if primary_atts:
        att = primary_atts[0]
        att_type = att.get("type", "")
        if "heif" in att_type or "heic" in att_type:
            image_url = att.get("thumbnails", {}).get("large", {}).get("url") or att.get("url")
            log.info("using thumbnail for publish (HEIF original)")
        else:
            image_url = att.get("url")

    if not image_url:
        send_error_notification("no image URL for publishing")
        return

    fb_id,  fb_url  = publish_photo_to_facebook(image_url, caption)
    ig_id,  ig_url  = publish_photo_to_instagram(image_url, caption)

    send_publish_notification(record, caption, fb_url, ig_url)
    mark_as_published(record["id"])
    log.info("published successfully!")


def run():
    log.info("=" * 50)
    log.info("social agent ג€” daily run")
    log.info("=" * 50)
    try:
        run_publish_flow()
    except Exception as e:
        log.error(f"error: {e}", exc_info=True)
        send_error_notification(str(e))
        raise


if __name__ == "__main__":
    run()
