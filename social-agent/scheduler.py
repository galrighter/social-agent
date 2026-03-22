"""
Scheduler — v22 (bank mode + publishing controls)

Commands:
  /newpost   — prepare captions (generate + approve + save)
  /publish   — force-publish one approved post now
  /pause     — stop daily auto-publishing
  /resume    — resume daily auto-publishing
  /skip      — skip next post in bank (mark as published without publishing)
  /next      — preview next post to be published
  /bank      — how many approved posts waiting
  /status    — full agent status
  /summarize — summarize feedbacks and update brand_voice
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
from agent import (run, run_prepare, run_publish_flow, run_skip_next,
                   run_preview_next, run_feedback_summary_flow,
                   load_json, count_bank, is_paused, set_paused,
                   _send_telegram_message, FLD_APPROVED_CAPTION)

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
    log.info("listening for telegram commands")

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
                    tg_send("starting caption preparation...")
                    threading.Thread(target=run_prepare, daemon=True).start()

                elif text == "/publish":
                    log.info("command: /publish")
                    tg_send("publishing one approved post now...")
                    def _force_publish():
                        try:
                            run_publish_flow(force=True)
                        except Exception as e:
                            log.error(f"force publish error: {e}")
                    threading.Thread(target=_force_publish, daemon=True).start()

                elif text == "/pause":
                    log.info("command: /pause")
                    set_paused(True)
                    tg_send("daily publishing PAUSED.\nsend /resume to restart.")

                elif text == "/resume":
                    log.info("command: /resume")
                    set_paused(False)
                    bank = count_bank()
                    tg_send(f"daily publishing RESUMED.\nBank: {bank} post(s) ready.")

                elif text == "/skip":
                    log.info("command: /skip")
                    threading.Thread(target=run_skip_next, daemon=True).start()

                elif text == "/next":
                    log.info("command: /next")
                    threading.Thread(target=run_preview_next, daemon=True).start()

                elif text == "/bank":
                    n = count_bank()
                    if n >= 0:
                        tg_send(f"Bank: {n} approved post(s) waiting.")
                    else:
                        tg_send("could not check bank — Airtable error.")

                elif text == "/summarize":
                    log.info("command: /summarize")
                    tg_send("starting feedback summary...")
                    threading.Thread(target=run_feedback_summary_flow, daemon=True).start()

                elif text == "/status":
                    data         = load_json(FEEDBACK_FILE, {"feedbacks": [], "unsummarized_count": 0})
                    total        = len(data.get("feedbacks", []))
                    unsummarized = data.get("unsummarized_count", 0)
                    has_summary  = bool(data.get("last_summary", ""))
                    bank_count   = count_bank()
                    israel_hour  = (PUBLISH_HOUR_UTC + 3) % 24
                    paused       = is_paused()
                    tg_send(
                        f"Agent status\n\n"
                        f"Publishing: {'PAUSED' if paused else 'ACTIVE'}\n"
                        f"Publish time: {israel_hour:02d}:00 Israel\n"
                        f"Bank: {bank_count} post(s) ready\n"
                        f"Feedbacks: {total} ({unsummarized} pending)\n"
                        f"Has summary: {'yes' if has_summary else 'no'}\n\n"
                        f"Commands:\n"
                        f"/newpost — prepare captions\n"
                        f"/publish — publish one now\n"
                        f"/next — preview next post\n"
                        f"/skip — skip next post\n"
                        f"/bank — check bank\n"
                        f"/pause — stop publishing\n"
                        f"/resume — resume publishing\n"
                        f"/summarize — summarize feedbacks"
                    )

        except Exception as e:
            log.warning(f"listen_for_commands: {e}")
            time.sleep(5)


if __name__ == "__main__":
    publish_time = f"{PUBLISH_HOUR_UTC:02d}:00"
    israel_hour  = (PUBLISH_HOUR_UTC + 3) % 24
    paused_str   = " (PAUSED)" if is_paused() else ""
    log.info(f"agent active — auto-publish daily at {publish_time} UTC ({israel_hour:02d}:00 Israel){paused_str}")

    schedule.every().day.at(publish_time).do(run)

    cmd_thread = threading.Thread(target=listen_for_commands, daemon=True)
    cmd_thread.start()

    while True:
        schedule.run_pending()
        time.sleep(60)
