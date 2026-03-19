"""
Scheduler - daily publish + Telegram command listener
Commands: /newpost | /summarize | /status
"""
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

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
            json={"chat_id": CONFIG["TELEGRAM_CHAT_ID"], "text": text}
        )
    except Exception as e:
        log.warning(f"tg_send: {e}")

def listen_for_commands():
    last_id = None
    log.info("listening for telegram commands: /newpost | /summarize | /status")

    while True:
        try:
            params = {"timeout": 30, "allowed_updates": ["message"]}
            if last_id:
                params["offset"] = last_id + 1
            res = requests.get(
                f"https://api.telegram.org/bot{CONFIG['TELEGRAM_BOT_TOKEN']}/getUpdates",
                params=params, timeout=35
            )
            updates = res.json().get("result", [])

            for u in updates:
                last_id = u["update_id"]
                text    = u.get("message", {}).get("text", "").strip()

                if text == "/newpost":
                    log.info("command: /newpost")
                    tg_send("Creating post on demand...")
                    threading.Thread(target=run_publish_flow, daemon=True).start()

                elif text == "/summarize":
                    log.info("command: /summarize")
                    tg_send("Starting feedback summary...")
                    threading.Thread(target=run_feedback_summary_flow, daemon=True).start()

                elif text == "/status":
                    data         = load_json(FEEDBACK_FILE, {"feedbacks": [], "unsummarized_count": 0})
                    total        = len(data.get("feedbacks", []))
                    unsummarized = data.get("unsummarized_count", 0)
                    has_summary  = bool(data.get("last_summary", ""))
                    tg_send(
                        f"Agent status\n\n"
                        f"Total feedbacks: {total}\n"
                        f"Pending summary: {unsummarized}\n"
                        f"Has summary: {'yes' if has_summary else 'no'}\n\n"
                        f"Commands: /newpost | /summarize | /status"
                    )

        except Exception as e:
            log.warning(f"listen_for_commands: {e}")
            time.sleep(5)


if __name__ == "__main__":
    publish_time = f"{PUBLISH_HOUR_UTC:02d}:00"
    israel_hour  = (PUBLISH_HOUR_UTC + 3) % 24
    log.info(f"agent active - publishing daily at {publish_time} UTC ({israel_hour:02d}:00 Israel)")

    schedule.every().day.at(publish_time).do(run)

    cmd_thread = threading.Thread(target=listen_for_commands, daemon=True)
    cmd_thread.start()

    while True:
        schedule.run_pending()
        time.sleep(60)
