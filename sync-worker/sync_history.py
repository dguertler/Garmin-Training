"""
Historischer Garmin-Sync: fehlende Tages-Metriken der letzten N Tage nachholen.
Überspringt Tage die bereits aussagekräftige Daten haben.
"""
import logging
import time
from datetime import date, timedelta

from garmin_auth import get_db_conn, get_garmin_client
from sync_daily import _parse_daily, _upsert_raw_metrics, _safe, _method

logger = logging.getLogger(__name__)

HISTORY_ENDPOINTS = [
    ("training_readiness", "get_training_readiness",   False),
    ("training_status",    "get_training_status",      False),
    ("hrv",                "get_hrv_data",             False),
    ("sleep",              "get_sleep_data",           False),
    ("user_summary",       "get_user_summary",         False),
    ("heart_rates",        "get_heart_rates",          False),
    ("resting_hr",         "get_rhr_day",              False),
    ("stress",             "get_all_day_stress",       False),
    ("steps",              "get_steps_data",           False),
    ("max_metrics",        "get_max_metrics",          False),
    ("body_battery",       "get_body_battery",         True),   # range-Endpunkt: (date, date)
]


def _get_missing_dates(user_id: str, days: int) -> list[str]:
    """Gibt fehlende oder unvollständige Datumsstrings zurück.

    Ein Tag gilt als vollständig nur wenn er Basis-Daten UND resting_heart_rate hat.
    Tage mit Teilwerten (z.B. nach Parsing-Bug-Fixes) werden damit erneut geholt.
    """
    end = date.today()
    start = end - timedelta(days=days - 1)

    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT metric_date::date::text FROM garmin_raw_metrics
               WHERE user_id = %s AND metric_date >= %s AND metric_date <= %s
               AND (training_readiness_score IS NOT NULL
                    OR sleep_score IS NOT NULL
                    OR steps_total IS NOT NULL)
               AND resting_heart_rate IS NOT NULL""",
            (user_id, start.isoformat(), end.isoformat()),
        )
        existing = {row[0] for row in cur.fetchall()}

    missing = []
    d = start
    while d <= end:
        ds = d.isoformat()
        if ds not in existing:
            missing.append(ds)
        d += timedelta(days=1)

    return missing  # chronologisch aufsteigend


def sync_user_history(
    user_id: str,
    garmin_email: str,
    garmin_password: str | None = None,
    days: int = 60,
    delay_seconds: float = 0.5,
) -> dict:
    """
    Holt fehlende historische Garmin-Daten für die letzten `days` Tage.
    Schreibt garmin_raw_metrics und berechnet daily_readiness für jeden Tag.
    """
    missing = _get_missing_dates(user_id, days)
    if not missing:
        logger.info("History-Sync user %s: alle %d Tage vorhanden – übersprungen", user_id, days)
        return {"synced": 0, "skipped": days, "errors": {}}

    logger.info("History-Sync user %s: %d fehlende Tage werden nachgeladen", user_id, len(missing))

    try:
        client = get_garmin_client(user_id, garmin_email, garmin_password)
    except Exception as e:
        logger.error("Auth fehlgeschlagen für History-Sync: %s", e)
        return {"synced": 0, "errors": {"auth": str(e)}}

    synced = 0
    errors: dict[str, str] = {}

    for day_str in missing:
        data: dict = {}

        for key, method_name, is_range in HISTORY_ENDPOINTS:
            method = _method(client, method_name)
            args = (day_str, day_str) if is_range else (day_str,)
            val, err = _safe(method, *args)
            if err is None:
                data[key] = val

        parsed = _parse_daily(data, day_str)
        try:
            _upsert_raw_metrics(user_id, day_str, parsed)
            synced += 1
        except Exception as e:
            errors[day_str] = str(e)
            logger.error("DB-Fehler History %s: %s", day_str, e)
            continue

        # Readiness-Cache für diesen Tag berechnen
        try:
            from compute_readiness import compute_and_cache_readiness
            compute_and_cache_readiness(user_id, for_date=day_str)
        except Exception as e:
            logger.warning("Readiness-Calc übersprungen für %s: %s", day_str, e)

        time.sleep(delay_seconds)

    # Aktivitäten der letzten `days` Tage nachholen
    try:
        _sync_history_activities(client, user_id, days)
    except Exception as e:
        logger.warning("Aktivitäts-History übersprungen: %s", e)

    logger.info(
        "History-Sync abgeschlossen user %s: %d/%d Tage OK, %d Fehler",
        user_id, synced, len(missing), len(errors),
    )
    return {"synced": synced, "total": len(missing), "errors": errors}


def _sync_history_activities(client, user_id: str, days: int) -> None:
    """Holt Aktivitäten der letzten `days` Tage und speichert neue."""
    from sync_daily import _sync_new_activities
    from sync_activities import sync_activity

    cutoff = (date.today() - timedelta(days=days)).isoformat()

    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT MAX(garmin_activity_id) FROM garmin_activities WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        last_known_id = row[0] if row else None

    try:
        # Letzte 200 Aktivitäten holen (ausreichend für 60 Tage)
        activities = client.get_activities(0, 200)
    except Exception as e:
        logger.warning("Aktivitätsliste für History konnte nicht geholt werden: %s", e)
        return

    new_count = 0
    for act in activities:
        act_id = act.get("activityId")
        if not act_id:
            continue
        # Aktivitäten außerhalb des Zeitfensters überspringen
        start_local = act.get("startTimeLocal", "")
        if start_local and start_local[:10] < cutoff:
            break
        if last_known_id and act_id <= last_known_id:
            continue
        try:
            sync_activity(client, user_id, act)
            new_count += 1
            time.sleep(0.3)
        except Exception as e:
            logger.error("Fehler beim Sync von Aktivität %s: %s", act_id, e)

    if new_count:
        logger.info("History-Aktivitäten: %d neue Einträge für user %s", new_count, user_id)
