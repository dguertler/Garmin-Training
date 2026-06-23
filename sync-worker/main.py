"""
Sync-Worker Hauptprozess.

Zeitplan:
  - Täglich 09:00 MEZ / CEST (DST-sicher via pytz)
  - Montags zusätzlich: wöchentlicher Sync

DST-Entscheidung: pytz mit Europe/Berlin.
APScheduler mit 'cron' trigger und timezone='Europe/Berlin'.
→ Railway läuft in UTC, der Scheduler rechnet die korrekte UTC-Zeit selbst aus.
→ Kein hardcoded UTC-Offset nötig.
"""
import logging
import os
import sys

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv

from garmin_auth import get_db_conn, get_garmin_client
from sync_daily import sync_user_daily
from sync_weekly import sync_user_weekly
from web_server import start_web_server

load_dotenv()

logging.basicConfig(

    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


def get_all_users() -> list[dict]:
    """Alle aktiven User mit Garmin-Credentials aus DB holen."""
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.email, up.garmin_username
              FROM users u
              JOIN user_profiles up ON up.user_id = u.id
              JOIN garmin_tokens gt ON gt.user_id = u.id
             WHERE gt.status = 'active'
            """
        )
        rows = cur.fetchall()
    return [{"id": str(r[0]), "email": r[1], "garmin_username": r[2]} for r in rows]


def run_daily_sync():
    logger.info("=== Täglicher Sync startet ===")
    users = get_all_users()
    if not users:
        logger.warning("Keine aktiven User mit Garmin-Token gefunden.")
        return

    for user in users:
        logger.info("Sync für User: %s", user["email"])
        result = sync_user_daily(user["id"], user["garmin_username"])
        if not result["success"]:
            logger.error("Sync fehlgeschlagen für %s: %s", user["email"], result.get("error"))
        else:
            errors = result.get("errors") or {}
            logger.info(
                "Sync abgeschlossen: %d Endpunkte, %d Fehler",
                len(result.get("endpoints", {})), len(errors)
            )


def run_weekly_sync():
    logger.info("=== Wöchentlicher Sync startet ===")
    users = get_all_users()
    for user in users:
        try:
            client = get_garmin_client(user["id"], user["garmin_username"])
            result = sync_user_weekly(client, user["id"])
            if result.get("errors"):
                logger.warning("Wöchentlicher Sync für %s: %s", user["email"], result["errors"])
        except Exception as e:
            logger.error("Wöchentlicher Sync fehlgeschlagen für %s: %s", user["email"], e)


def main():
    scheduler = BlockingScheduler()

    # Täglich 09:00 Europe/Berlin (DST-sicher, APScheduler rechnet UTC um)
    scheduler.add_job(
        run_daily_sync,
        CronTrigger(hour=9, minute=0, timezone="Europe/Berlin"),
        id="daily_sync",
        name="Täglicher Garmin-Sync",
        misfire_grace_time=600,   # 10 Minuten Toleranz bei verspätetem Start
        coalesce=True,
    )

    # Montags zusätzlich 09:30: wöchentlicher Sync (nach daily_sync)
    scheduler.add_job(
        run_weekly_sync,
        CronTrigger(day_of_week="mon", hour=9, minute=30, timezone="Europe/Berlin"),
        id="weekly_sync",
        name="Wöchentlicher Garmin-Sync",
        misfire_grace_time=600,
        coalesce=True,
    )

    # HTTP-Server für manuellen Trigger (Next.js → POST /sync/trigger)
    start_web_server(port=int(os.environ.get("PORT", "8001")))

    logger.info(
        "Scheduler gestartet. Täglich 09:00 Europe/Berlin, Montags zusätzlich 09:30."
    )

    # Einmaliger Sync beim Start (falls --run-now Flag gesetzt)
    if "--run-now" in sys.argv:
        logger.info("--run-now: Sofortiger Sync")
        run_daily_sync()
        return

    scheduler.start()


if __name__ == "__main__":
    main()
