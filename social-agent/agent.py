"""
הגדרות הסוכן
"""
import os

CONFIG = {
    # ── Airtable ───────────────────────────────────────────────
    "AIRTABLE_API_KEY":     os.environ.get("AIRTABLE_API_KEY", ""),
    "AIRTABLE_BASE_ID":     os.environ.get("AIRTABLE_BASE_ID", "appOtMp0nXKLtU5Yk"),
    "AIRTABLE_TABLE_ID":    os.environ.get("AIRTABLE_TABLE_ID", "tblPAH6rGPOkKaNsI"),

    # ── Airtable Field IDs ─────────────────────────────────────
    "FLD_READY":            "fld5gTGADc4y8qjMy",   # מוכן לפרסום (checkbox)
    "FLD_PUBLISHED":        "fldMnPdkg9doBSQEu",   # פורסם (checkbox)
    "FLD_BEFORE_PIC":       "fldNKgfqHQkFfCipw",   # before pic
    "FLD_AFTER_PIC":        "fld7cQ5aRrnCqn92G",    # after pic
    "FLD_CLIENT":           "fld2lxzlsQ8Vibj5U",   # שם לקוח
    "FLD_ITEMS":            "fldmw22jvkQiOBv5b",   # items
    "FLD_COLOR":            "fldksCfEsqak9ncRp",   # color
    "FLD_NOTES":            "fldxXkBh1KtrtAIkf",   # notes

    # ── Anthropic ──────────────────────────────────────────────
    "ANTHROPIC_API_KEY":    os.environ.get("ANTHROPIC_API_KEY", ""),

    # ── Facebook ───────────────────────────────────────────────
    "FB_PAGE_ID":           os.environ.get("FB_PAGE_ID", ""),
    "FB_PAGE_TOKEN":        os.environ.get("FB_PAGE_TOKEN", ""),

    # ── Instagram ──────────────────────────────────────────────
    "IG_ACCOUNT_ID":        os.environ.get("IG_ACCOUNT_ID", ""),

    # ── Telegram ───────────────────────────────────────────────
    "TELEGRAM_BOT_TOKEN":   os.environ.get("TELEGRAM_BOT_TOKEN", ""),
    "TELEGRAM_CHAT_ID":     os.environ.get("TELEGRAM_CHAT_ID", ""),
}

# ── שעת פרסום יומית (UTC) ──────────────────────────────────────
PUBLISH_HOUR_UTC                = int(os.environ.get("PUBLISH_HOUR_UTC", "6"))

# ── קבצי נתונים ────────────────────────────────────────────────
FEEDBACK_FILE                   = "feedback_log.json"
BRAND_VOICE_FILE                = "brand_voice.txt"

# ── סיכום פידבקים ──────────────────────────────────────────────
SUMMARIZE_AFTER_N_FEEDBACKS     = int(os.environ.get("SUMMARIZE_AFTER_N_FEEDBACKS", "10"))
