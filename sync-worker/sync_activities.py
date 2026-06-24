"""
Aktivitäts-Sync: Details, Splits, HR-Zonen, Gear.
"""
import json
import logging
from datetime import datetime

from garmin_auth import get_db_conn

logger = logging.getLogger(__name__)


def sync_activity(client, user_id: str, activity_summary: dict) -> str:
    """Speichert eine Aktivität mit allen Details. Gibt DB-UUID zurück."""
    act_id = activity_summary["activityId"]

    # Basis-Daten speichern / updaten
    db_id = _upsert_activity(user_id, activity_summary)

    # Detailierte Daten parallel holen
    _sync_splits(client, db_id, act_id)
    _sync_hr_zones(client, db_id, act_id)
    _sync_details(client, db_id, act_id)

    return db_id


def _upsert_activity(user_id: str, act: dict) -> str:
    atype = (act.get("activityType") or {}).get("typeKey", "unknown")
    start_raw = act.get("startTimeLocal") or act.get("beginTimestamp")
    start_dt = None
    if start_raw:
        try:
            start_dt = datetime.fromisoformat(str(start_raw).replace("Z", "+00:00"))
        except Exception:
            pass

    sql = """
        INSERT INTO garmin_activities (
            user_id, garmin_activity_id, activity_date, start_time,
            activity_type, activity_name,
            duration_seconds, distance_meters, calories,
            avg_hr, max_hr, avg_pace_per_km, avg_speed_mps,
            avg_cadence, total_ascent_m, total_descent_m,
            training_effect_aerobic, training_effect_anaerobic,
            gear_name, gear_uuid, garmin_raw
        ) VALUES (
            %s, %s, %s, %s,
            %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s,
            %s, %s, %s
        )
        ON CONFLICT (user_id, garmin_activity_id) DO UPDATE
            SET duration_seconds = EXCLUDED.duration_seconds,
                calories         = EXCLUDED.calories,
                garmin_raw       = EXCLUDED.garmin_raw,
                avg_hr           = EXCLUDED.avg_hr,
                max_hr           = EXCLUDED.max_hr
        RETURNING id
    """

    avg_speed = act.get("averageSpeed")
    avg_pace = round(1000 / avg_speed) if avg_speed and avg_speed > 0 else None

    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, (
            user_id,
            act["activityId"],
            start_dt.date() if start_dt else None,
            start_dt,
            atype,
            act.get("activityName"),
            act.get("duration"),
            act.get("distance"),
            act.get("calories"),
            act.get("averageHR"),
            act.get("maxHR"),
            avg_pace,
            avg_speed,
            act.get("averageRunningCadenceInStepsPerMinute") or act.get("averageBikingCadenceInRevPerMinute"),
            act.get("elevationGain"),
            act.get("elevationLoss"),
            act.get("aerobicTrainingEffect"),
            act.get("anaerobicTrainingEffect"),
            None,   # gear_name – kommt aus get_activity_gear
            None,   # gear_uuid
            json.dumps(act),
        ))
        db_id = cur.fetchone()[0]
        conn.commit()

    return str(db_id)


def _sync_splits(client, db_id: str, garmin_id: int) -> None:
    try:
        splits = client.get_activity_splits(garmin_id)
    except Exception as e:
        logger.warning("Splits für %s nicht verfügbar: %s", garmin_id, e)
        return

    if not splits:
        return

    laps = splits.get("lapDTOs") or splits if isinstance(splits, list) else []

    with get_db_conn() as conn, conn.cursor() as cur:
        for i, lap in enumerate(laps):
            avg_speed = lap.get("averageSpeed")
            avg_pace = round(1000 / avg_speed) if avg_speed and avg_speed > 0 else None

            cur.execute(
                """
                INSERT INTO garmin_activity_splits
                    (activity_id, split_index, split_type,
                     distance_meters, duration_seconds, avg_hr, avg_pace_per_km,
                     avg_speed_mps, elevation_gain, raw_data)
                VALUES (%s, %s, 'lap', %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (activity_id, split_index) DO NOTHING
                """,
                (db_id, i,
                 lap.get("distance"), lap.get("duration"), lap.get("averageHR"),
                 avg_pace, avg_speed, lap.get("elevationGain"), json.dumps(lap)),
            )
        conn.commit()


def _sync_hr_zones(client, db_id: str, garmin_id: int) -> None:
    try:
        zones_data = client.get_activity_hr_in_timezones(garmin_id)
    except Exception as e:
        logger.warning("HR-Zonen für %s nicht verfügbar: %s", garmin_id, e)
        return

    if not zones_data:
        return

    zones = zones_data if isinstance(zones_data, list) else []

    with get_db_conn() as conn, conn.cursor() as cur:
        for zone in zones:
            zone_num = zone.get("zoneNumber") or zone.get("zone")
            if not zone_num:
                continue
            cur.execute(
                """
                INSERT INTO garmin_activity_hr_zones
                    (activity_id, zone_number, zone_name, seconds_in_zone, pct_in_zone, hr_low, hr_high)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (activity_id, zone_number) DO UPDATE
                    SET seconds_in_zone = EXCLUDED.seconds_in_zone,
                        pct_in_zone     = EXCLUDED.pct_in_zone
                """,
                (db_id, zone_num,
                 zone.get("zoneName"), zone.get("secsInZone") or zone.get("secondsInZone"),
                 zone.get("zonePct"), zone.get("minHeartRate"), zone.get("maxHeartRate")),
            )
        conn.commit()


def _sync_details(client, db_id: str, garmin_id: int) -> None:
    try:
        details = client.get_activity_details(garmin_id)
    except Exception as e:
        logger.warning("Details für %s nicht verfügbar: %s", garmin_id, e)
        return

    if not details:
        return

    # Trackpunkte komprimiert speichern
    measurements = details.get("geoPolylineDTO") or {}
    track_raw = details.get("activityDetailMetrics") or []

    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO garmin_activity_details (activity_id, track_points, raw_data)
            VALUES (%s, %s, %s)
            ON CONFLICT (activity_id) DO UPDATE
                SET track_points = EXCLUDED.track_points,
                    raw_data     = EXCLUDED.raw_data
            """,
            (db_id, json.dumps(track_raw[:5000]), json.dumps(measurements)),  # max 5000 Punkte
        )
        conn.commit()
