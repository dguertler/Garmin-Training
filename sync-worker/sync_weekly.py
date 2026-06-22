"""
Wöchentlicher Sync (jeden Montag): Endurance Score, Race Predictions, Gear etc.
"""
import json
import logging
from datetime import date, timedelta

from garmin_auth import get_db_conn

logger = logging.getLogger(__name__)


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs), None
    except Exception as e:
        return None, str(e)


def sync_user_weekly(client, user_id: str) -> dict:
    """Wöchentliche Garmin-Endpunkte synchronisieren."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Montag dieser Woche
    week_start_str = week_start.isoformat()
    last_week_str = (week_start - timedelta(days=7)).isoformat()

    data: dict = {}
    errors: dict = {}

    val, err = _safe(client.get_weekly_steps, week_start_str, today.isoformat())
    if val is not None: data["weekly_steps"] = val
    else: errors["weekly_steps"] = err

    val, err = _safe(client.get_endurance_score, today.isoformat())
    if val is not None: data["endurance_score"] = val
    else: errors["endurance_score"] = err

    val, err = _safe(client.get_hill_score, today.isoformat())
    if val is not None: data["hill_score"] = val
    else: errors["hill_score"] = err

    val, err = _safe(client.get_race_predictions)
    if val is not None: data["race_predictions"] = val
    else: errors["race_predictions"] = err

    val, err = _safe(client.get_personal_records, user_id)
    if val is not None: data["personal_records"] = val
    else: errors["personal_records"] = err

    val, err = _safe(client.get_gear_stats, user_id)
    if val is not None: data["gear_stats"] = val
    else: errors["gear_stats"] = err

    _save_weekly(user_id, week_start_str, data)
    _save_race_predictions(user_id, data.get("race_predictions"), today.isoformat())
    _update_gear(user_id, data.get("gear_stats"))

    if errors:
        logger.warning("Wöchentlicher Sync teilweise fehlgeschlagen: %s", errors)

    return {"success": True, "errors": errors if errors else None}


def _save_weekly(user_id: str, week_start: str, data: dict) -> None:
    es = data.get("endurance_score") or {}
    if isinstance(es, list) and es: es = es[0]

    hs = data.get("hill_score") or {}
    if isinstance(hs, list) and hs: hs = hs[0]

    rp = data.get("race_predictions") or {}
    if isinstance(rp, list) and rp: rp = rp[0]

    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO garmin_weekly_metrics
                (user_id, week_start_date, endurance_score, hill_score,
                 race_prediction_5k_seconds, race_prediction_10k_seconds,
                 race_prediction_hm_seconds, race_prediction_marathon_seconds,
                 raw_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, week_start_date) DO UPDATE
                SET endurance_score             = EXCLUDED.endurance_score,
                    hill_score                  = EXCLUDED.hill_score,
                    race_prediction_5k_seconds  = EXCLUDED.race_prediction_5k_seconds,
                    race_prediction_10k_seconds = EXCLUDED.race_prediction_10k_seconds,
                    race_prediction_hm_seconds  = EXCLUDED.race_prediction_hm_seconds,
                    race_prediction_marathon_seconds = EXCLUDED.race_prediction_marathon_seconds,
                    updated_at                  = NOW()
            """,
            (user_id, week_start,
             es.get("latestEnduranceScore"), hs.get("latestHillScore"),
             _race_sec(rp, "time5K"), _race_sec(rp, "time10K"),
             _race_sec(rp, "timeHalfMarathon"), _race_sec(rp, "timeMarathon"),
             json.dumps(data)),
        )
        conn.commit()


def _race_sec(rp: dict, key: str) -> int | None:
    val = rp.get(key)
    if not val:
        return None
    # Garmin liefert manchmal "HH:MM:SS" strings
    if isinstance(val, str):
        parts = val.split(":")
        try:
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(float(parts[2]))
            if len(parts) == 2:
                return int(parts[0]) * 60 + int(float(parts[1]))
        except Exception:
            return None
    return int(val)


def _save_race_predictions(user_id: str, rp, record_date: str) -> None:
    if not rp:
        return
    if isinstance(rp, list) and rp: rp = rp[0]
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO garmin_race_predictions
                (user_id, recorded_date,
                 pred_5k_seconds, pred_10k_seconds, pred_hm_seconds, pred_marathon_seconds, raw_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, recorded_date) DO UPDATE
                SET pred_5k_seconds       = EXCLUDED.pred_5k_seconds,
                    pred_10k_seconds      = EXCLUDED.pred_10k_seconds,
                    pred_hm_seconds       = EXCLUDED.pred_hm_seconds,
                    pred_marathon_seconds = EXCLUDED.pred_marathon_seconds
            """,
            (user_id, record_date,
             _race_sec(rp, "time5K"), _race_sec(rp, "time10K"),
             _race_sec(rp, "timeHalfMarathon"), _race_sec(rp, "timeMarathon"),
             json.dumps(rp)),
        )
        conn.commit()


def _update_gear(user_id: str, gear_list) -> None:
    if not gear_list:
        return
    if not isinstance(gear_list, list):
        gear_list = [gear_list]

    with get_db_conn() as conn, conn.cursor() as cur:
        for gear in gear_list:
            uuid_val = gear.get("uuid") or gear.get("gearPk")
            if not uuid_val:
                continue
            cur.execute(
                """
                INSERT INTO garmin_gear (user_id, garmin_gear_uuid, gear_type, gear_name, distance_meters, raw_data)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, garmin_gear_uuid) DO UPDATE
                    SET distance_meters = EXCLUDED.distance_meters,
                        gear_name       = EXCLUDED.gear_name,
                        last_synced_at  = NOW(),
                        updated_at      = NOW()
                """,
                (user_id, uuid_val,
                 gear.get("gearTypeName"), gear.get("displayName"),
                 gear.get("totalDistance"), json.dumps(gear)),
            )
        conn.commit()
