"""Tiny built-in scheduler: sends the daily applications roundup at APPLICATION_DIGEST_HOUR (Lagos time).

Safe to run in several server processes at once: the roundup claims the waiting applications under a database
lock (see notify._alert_on_waiting_applications), so only one of them ever sends it.
If your host puts the server to sleep, trigger the roundup from an outside cron instead (routers/internal.py).
"""
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from core import config

logger = logging.getLogger("scheduler")
LAGOS = timezone(timedelta(hours=1))


def _loop() -> None:
    from core.notify import send_application_digest

    last_run_day = None
    while True:
        try:
            now = datetime.now(LAGOS)
            if now.hour == config.APPLICATION_DIGEST_HOUR and last_run_day != now.date():
                last_run_day = now.date()
                sent = send_application_digest()
                logger.info("Daily applications roundup ran (%d applications announced).", sent)
        except Exception:
            logger.exception("Scheduler tick failed")
        time.sleep(60)


def _mailbox_loop() -> None:
    from core import mailbox

    time.sleep(20)  # let the app finish starting
    while True:
        mailbox.poll_in_background()
        time.sleep(max(60, config.IMAP_POLL_SECONDS))


def start_scheduler() -> None:
    if config.DISABLE_SCHEDULER:
        logger.info("Scheduler disabled (DISABLE_SCHEDULER=true).")
        return
    threading.Thread(target=_loop, name="digest-scheduler", daemon=True).start()
    from core import mailbox

    if mailbox.configured():
        threading.Thread(target=_mailbox_loop, name="mailbox-poller", daemon=True).start()
        logger.info("Mailbox poller started: checking for applicant replies every %ds.", config.IMAP_POLL_SECONDS)
    logger.info("Scheduler started: applications roundup daily at %02d:00 Lagos time.", config.APPLICATION_DIGEST_HOUR)