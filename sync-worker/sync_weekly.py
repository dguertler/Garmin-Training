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
    _compute_zone_distribution(user_id, week_start_str)
    _update_neat_baseline(user_id)

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


def _compute_zone_distribution(user_id: str, week_start: str) -> None:
    """Berechnet wöchentliche Zonenverteilung aus garmin_activity_hr_zones und cached in weekly_zone_distribution."""
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT hz.zone_number, SUM(hz.time_in_zone_seconds) AS secs
            FROM garmin_activity_hr_zones hz
            JOIN garmin_activities ga ON ga.id = hz.activity_id
            WHERE ga.user_id = %s AND ga.start_time::date >= %s
              AND ga.start_time::date < (%s::date + INTERVAL '7 days')::date
            GROUP BY hz.zone_number
            ORDER BY hz.zone_number
            """,
            (user_id, week_start, week_start)
        )
        rows = cur.fetchall()

    zone_secs = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for zone_number, secs in rows:
        if 1 <= zone_number <= 5:
            zone_secs[zone_number] = int(secs)

    total = sum(zone_secs.values())
    if total == 0:
        return  # Keine Aktivitäten diese Woche – nichts cachen

    def pct(s: int) -> float:
        return round(s / total * 100, 1)

    low_pct = pct(zone_secs[1] + zone_secs[2])
    high_pct = pct(zone_secs[4] + zone_secs[5])

    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO weekly_zone_distribution
                (user_id, week_start_date, total_training_seconds,
                 z1_seconds, z2_seconds, z3_seconds, z4_seconds, z5_seconds,
                 z1_pct, z2_pct, z3_pct, z4_pct, z5_pct,
                 low_intensity_pct, high_intensity_pct, polarization_ok)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, week_start_date) DO UPDATE
                SET total_training_seconds = EXCLUDED.total_training_seconds,
                    z1_seconds = EXCLUDED.z1_seconds, z2_seconds = EXCLUDED.z2_seconds,
                    z3_seconds = EXCLUDED.z3_seconds, z4_seconds = EXCLUDED.z4_seconds,
                    z5_seconds = EXCLUDED.z5_seconds,
                    z1_pct = EXCLUDED.z1_pct, z2_pct = EXCLUDED.z2_pct,
                    z3_pct = EXCLUDED.z3_pct, z4_pct = EXCLUDED.z4_pct,
                    z5_pct = EXCLUDED.z5_pct,
                    low_intensity_pct = EXCLUDED.low_intensity_pct,
                    high_intensity_pct = EXCLUDED.high_intensity_pct,
                    polarization_ok = EXCLUDED.polarization_ok,
                    computed_at = NOW()
            """,
            (user_id, week_start, total,
             zone_secs[1], zone_secs[2], zone_secs[3], zone_secs[4], zone_secs[5],
             pct(zone_secs[1]), pct(zone_secs[2]), pct(zone_secs[3]), pct(zone_secs[4]), pct(zone_secs[5]),
             low_pct, high_pct, low_pct >= 75 and high_pct <= 25)
        )
        conn.commit()
    logger.info("Zonenverteilung für Woche %s gespeichert (Total: %ds)", week_start, total)


def _update_neat_baseline(user_id: str) -> None:
    """Berechnet monatlichen NEAT-Basiswert (Ø tägliche Schritte) und cached in neat_baselines."""
    from datetime import date
    today = date.today()
    month_start = today.replace(day=1).isoformat()

    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT ROUND(AVG(steps)) AS avg_steps
            FROM garmin_raw_metrics
            WHERE user_id = %s
              AND metric_date >= %s::date - INTERVAL '30 days'
              AND metric_date < %s::date
              AND steps IS NOT NULL
            """,
            (user_id, month_start, month_start)
        )
        row = cur.fetchone()
        if not row or row[0] is None:
            return

        avg_steps = int(row[0])
        cur.execute(
            """
            INSERT INTO neat_baselines (user_id, month_start, avg_daily_steps)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, month_start) DO UPDATE
                SET avg_daily_steps = EXCLUDED.avg_daily_steps,
                    computed_at = NOW()
            """,
            (user_id, month_start, avg_steps)
        )
        conn.commit()
    logger.info("NEAT-Baseline für %s: Ø %d Schritte/Tag", month_start, avg_steps)
