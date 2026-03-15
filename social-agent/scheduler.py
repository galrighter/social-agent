"""
מתזמן — פרסום יומי + האזנה לפקודות טלגרם
פקודות: /newpost | /summarize | /status
"""
import schedule
import time
import threading
import logging
import requests
from datetime import datetime
from config import PUBLISH_HOUR_UTC, CONFIG, FEEDBACK_FILE
from agent import run, run_publish_flow, run_feedback_summary_flow, load_json

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger(__name__)

def tg_send(text):
    try:
        requests.post(
            f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/sendMessage",
            json={"chat_id": CONFIG["TELEGRAM_CHAT_ID"], "text": text, "parse_mode": "Markdown"}
        )
    except Exception as e:
        log.warning(f"tg_send: {e}")

def listen_for_commands():
    last_id = None
    log.info("מאזין לפקודות טלגרם: /newpost | /summarize | /status")

    while True:
        try:
            params = {"timeout": 30, "allowed_updates": ["message"]}
            if last_id:
                params["offset"] = last_id + 1
            res     = requests.get(
                f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/getUpdates",
                params=params, timeout=35
            )
            updates = res.json().get("result", [])

            for u in updates:
                last_id = u["update_id"]
                text    = u.get("message", {}).get("text", "").strip()

                if text == "/newpost":
                    log.info("פקודת /newpost")
                    tg_send("🎬 *יוצר פוסט לפי דרישה...*")
                    threading.Thread(target=run_publish_flow, daemon=True).start()

                elif text == "/summarize":
                    log.info("פקודת /summarize")
                    tg_send("🔄 *מתחיל סיכום פידבקים...*")
                    threading.Thread(target=run_feedback_summary_flow, daemon=True).start()

                elif text == "/status":
                    data         = load_json(FEEDBACK_FILE, {"feedbacks": [], "unsummarized_count": 0})
                    total        = len(data.get("feedbacks", []))
                    unsummarized = data.get("unsummarized_count", 0)
                    has_summary  = bool(data.get("last_summary", ""))
                    tg_send(
                        f"📊 *סטטוס סוכן*\n\n"
                        f"פידבקים כולל: {total}\n"
                        f"ממתינים לסיכום: {unsummarized}\n"
                        f"יש סיכום קיים: {'כן ✓' if has_summary else 'לא'}\n\n"
                        f"פקודות: /newpost | /summarize | /status"
                    )

        except Exception as e:
            log.warning(f"listen_for_commands: {e}")
            time.sleep(5)


if __name__ == "__main__":
    publish_time = f"{PUBLISH_HOUR_UTC:02d}:00"
    israel_hour  = (PUBLISH_HOUR_UTC + 3) % 24
    log.info(f"סוכן פעיל — יפרסם כל יום ב-{publish_time} UTC ({israel_hour:02d}:00 ישראל)")

    schedule.every().day.at(publish_time).do(run)

    cmd_thread = threading.Thread(target=listen_for_commands, daemon=True)
    cmd_thread.start()

    while True:
        schedule.run_pending()
        time.sleep(60)
