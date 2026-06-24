"""
Täglicher Garmin-Sync: alle Kern-Endpunkte für einen User.
Wird vom Scheduler (main.py) aufgerufen.
"""
import json
import logging
import uuid
from datetime import date, datetime, timezone

import psycopg2
import psycopg2.extras

from garmin_auth import get_garmin_client, mark_token_error, get_db_conn

logger = logging.getLogger(__name__)


def _safe(fn, *args, **kwargs):
    """Ruft fn auf, gibt (result, None) oder (None, error_str) zurück."""
    if fn is None:
        return None, "method not available"
    try:
        return fn(*args, **kwargs), None
    except Exception as e:
        return None, str(e)


def _method(client, name):
    """Gibt die Methode zurück oder None falls nicht vorhanden."""
    return getattr(client, name, None)


def sync_user_daily(user_id: str, garmin_email: str, garmin_password: str | None = None) -> dict:
    """
    Synchronisiert alle täglichen Garmin-Endpunkte für einen User.
    Gibt Sync-Ergebnis zurück: {success: bool, endpoints: {name: 'ok'|'error'}, errors: {...}}
    """
    job_id = str(uuid.uuid4())
    today = date.today().isoformat()
    results: dict[str, str] = {}
    errors: dict[str, str] = {}

    # Sync-Job starten
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sync_jobs (id, user_id, job_type, status)
            VALUES (%s, %s, 'daily', 'running')
            """,
            (job_id, user_id),
        )
        conn.commit()

    try:
        client = get_garmin_client(user_id, garmin_email, garmin_password)
    except Exception as e:
        mark_token_error(user_id, str(e))
        _finish_job(job_id, "error", 0, 0, {"auth": str(e)})
        return {"success": False, "job_id": job_id, "error": str(e)}

    data: dict = {}

    # ── Tägliche Endpunkte ──────────────────────────────────────────────────

    for key, method_name, args in [
        ("training_readiness",  "get_training_readiness",    (today,)),
        ("training_status",     "get_training_status",       (today,)),
        ("hrv",                 "get_hrv_data",              (today,)),
        ("sleep",               "get_sleep_data",            (today,)),
        ("body_battery",        "get_body_battery",          (today, today)),
        ("user_summary",        "get_user_summary",          (today,)),
        ("heart_rates",         "get_heart_rates",           (today,)),
        ("resting_hr",          "get_rhr_day",               (today,)),
        ("stress",              "get_all_day_stress",        (today,)),
        ("steps",               "get_steps_data",            (today,)),
        ("max_metrics",         "get_max_metrics",           (today,)),
        ("intensity_minutes",   "get_intensity_minutes_data",(today,)),
        ("respiration",         "get_respiration_data",      (today,)),
        ("spo2",                "get_spo2_data",             (today,)),
        ("body_composition",    "get_body_composition",      (today, today)),
        ("weigh_ins",           "get_daily_weigh_ins",       (today, today)),
        ("hydration",           "get_hydration_data",        (today,)),
        ("stats_and_body",      "get_stats_and_body",        (today,)),
        ("lactate_threshold",   "get_lactate_threshold",     ()),
        ("morning_readiness",   "get_morning_training_readiness", (today,)),
    ]:
        val, err = _safe(_method(client, method_name), *args)
        if val is not None:
            data[key] = val; results[key] = "ok"
        else:
            errors[key] = err; results[key] = "error"

    # ── Parsed speichern ──────────────────────────────────────────────────

    parsed = _parse_daily(data, today)
    _upsert_raw_metrics(user_id, today, parsed)

    # ── Delta-Check: neue Aktivitäten ─────────────────────────────────────

    last_activity_id = _sync_new_activities(client, user_id, job_id)

    # ── Post-Workout-Analysen ──────────────────────────────────────────────
    try:
        from post_workout_analysis import analyze_recent_unanalyzed
        analyze_recent_unanalyzed(user_id, limit=10)
    except Exception as e:
        logger.warning("Post-Workout-Analyse übersprungen: %s", e)

    # ── Readiness cachen ───────────────────────────────────────────────────
    try:
        from compute_readiness import compute_and_cache_readiness
        compute_and_cache_readiness(user_id)
    except Exception as e:
        logger.warning("Readiness-Cache übersprungen: %s", e)

    # ── Garmin Index: Körpergewicht auto-importieren ────────────────────────
    _import_garmin_body_weight(user_id, parsed, today)

    success_count = sum(1 for v in results.values() if v == "ok")
    _finish_job(job_id, "success" if not errors else "partial",
                len(results), success_count, errors if errors else None, last_activity_id)

    logger.info(
        "Sync abgeschlossen für user %s: %d/%d Endpunkte OK, %d Fehler",
        user_id, success_count, len(results), len(errors),
    )
    return {
        "success": True,
        "job_id": job_id,
        "endpoints": results,
        "errors": errors if errors else None,
    }


def _parse_daily(data: dict, today: str) -> dict:
    """Extrahiert relevante Felder aus Garmin-Rohdaten für die DB-Spalten."""
    p: dict = {}

    # Training Readiness
    tr = data.get("training_readiness") or {}
    if isinstance(tr, list) and tr:
        tr = tr[0]
    p["training_readiness_score"]   = tr.get("score") or tr.get("overallReadinessScore")
    p["training_readiness_factors"] = json.dumps(tr)
    p["training_status_raw"]        = json.dumps(data.get("training_status") or {})
    ts = data.get("training_status") or {}
    if isinstance(ts, list) and ts: ts = ts[0]
    p["training_status"] = ts.get("trainingStatusPhrase") or ts.get("latestTrainingStatusPhrase")

    # HRV
    hrv = data.get("hrv") or {}
    p["hrv_weekly_average"]  = _nested(hrv, "hrvSummary", "weeklyAvg")
    p["hrv_last_night"]      = _nested(hrv, "hrvSummary", "lastNight")
    p["hrv_5night_average"]  = _nested(hrv, "hrvSummary", "lastNightAvg")
    p["hrv_baseline_low"]    = _nested(hrv, "hrvSummary", "baselineLowUpper")
    p["hrv_baseline_high"]   = _nested(hrv, "hrvSummary", "baselineBalancedUpper")
    p["hrv_status"]          = _nested(hrv, "hrvSummary", "status")
    p["hrv_raw"]             = json.dumps(hrv)

    # Schlaf
    sleep = data.get("sleep") or {}
    sd = sleep.get("dailySleepDTO") or sleep
    p["sleep_score"]           = _nested(sd, "sleepScores", "overall") or sd.get("sleepScorePersonalRecord")
    p["sleep_duration_seconds"] = sd.get("sleepTimeSeconds")
    p["sleep_deep_seconds"]    = sd.get("deepSleepSeconds")
    p["sleep_rem_seconds"]     = sd.get("remSleepSeconds")
    p["sleep_light_seconds"]   = sd.get("lightSleepSeconds")
    p["sleep_awake_seconds"]   = sd.get("awakeSleepSeconds")
    p["sleep_raw"]             = json.dumps(sleep)

    # Body Battery – Kurve extrahieren
    bb_raw = data.get("body_battery") or []
    if isinstance(bb_raw, list) and bb_raw:
        values = bb_raw[0].get("bodyBatteryValuesArray") or []
        p["body_battery_curve"] = json.dumps(values)
        if values:
            p["body_battery_morning"] = values[0][1] if values[0] else None
            p["body_battery_evening"] = values[-1][1] if values[-1] else None
    p["body_battery_raw"] = json.dumps(bb_raw)

    # User Summary
    us = data.get("user_summary") or {}
    p["steps_total"]            = us.get("totalSteps")
    p["steps_goal"]             = us.get("stepGoal")
    p["calories_total"]         = us.get("totalKilocalories")
    p["calories_active"]        = us.get("activeKilocalories")
    p["calories_bmr"]           = us.get("bmrKilocalories")
    p["distance_meters"]        = us.get("totalDistanceMeters")
    p["active_minutes_moderate"] = us.get("moderateIntensityMinutes")
    p["active_minutes_vigorous"] = us.get("vigorousIntensityMinutes")
    p["floors_climbed"]          = us.get("floorsAscended")
    p["user_summary_raw"]        = json.dumps(us)

    # Resting HR
    rhr = data.get("resting_hr") or {}
    p["resting_heart_rate"] = rhr.get("value") or rhr.get("restingHeartRate")
    p["heart_rates_raw"]    = json.dumps(data.get("heart_rates") or {})

    # Stress
    stress = data.get("stress") or {}
    if isinstance(stress, dict):
        p["stress_average"] = stress.get("overallStressLevel")
        p["stress_curve"]   = json.dumps(stress.get("stressValuesArray") or [])
    p["stress_raw"] = json.dumps(stress)

    # VO2max
    mm = data.get("max_metrics") or {}
    if isinstance(mm, list) and mm: mm = mm[0]
    p["vo2max"]     = _nested(mm, "generic", "vo2MaxValue")
    p["fitness_age"] = _nested(mm, "generic", "fitnessAge")
    p["max_metrics_raw"] = json.dumps(mm)

    # Respiration
    resp = data.get("respiration") or {}
    p["respiration_average"] = resp.get("averageWakingRespirationValue")
    p["respiration_raw"]     = json.dumps(resp)

    # SpO2
    spo2 = data.get("spo2") or {}
    p["spo2_average"] = spo2.get("averageSPO2")
    p["spo2_raw"]     = json.dumps(spo2)

    # Body Composition
    bc = data.get("body_composition") or {}
    if isinstance(bc, list) and bc: bc = bc[0]
    p["body_weight_garmin"]     = bc.get("weight")
    p["body_fat_percent_garmin"] = bc.get("bodyFatPercentage")
    p["bmi_garmin"]             = bc.get("bmi")
    p["body_composition_raw"]   = json.dumps(bc)
    p["daily_weigh_ins_raw"]    = json.dumps(data.get("weigh_ins") or [])

    # Hydration
    hyd = data.get("hydration") or {}
    p["hydration_goal_ml"]   = hyd.get("goalValueInML")
    p["hydration_intake_ml"] = hyd.get("valueInML")
    p["hydration_raw"]       = json.dumps(hyd)

    # Lactate Threshold
    lt = data.get("lactate_threshold") or {}
    if isinstance(lt, dict):
        p["lactate_threshold_hr"]   = lt.get("heartRate")
        p["lactate_threshold_raw"]  = json.dumps(lt)

    p["stats_and_body_raw"] = json.dumps(data.get("stats_and_body") or {})

    return p


def _import_garmin_body_weight(user_id: str, parsed: dict, today: str) -> None:
    """
    Importiert Garmin Index Scale Daten automatisch in daily_input,
    sofern noch kein manueller Eintrag für heute existiert.
    Garmin Index liefert Gewicht + KFA über body_composition / daily_weigh_ins.
    """
    weight_garmin = parsed.get("body_weight_garmin")
    fat_garmin = parsed.get("body_fat_percent_garmin")

    if not weight_garmin:
        return  # Keine Garmin Waage vorhanden oder kein Eintrag heute

    # Nur wenn noch kein manueller Eintrag
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM daily_input WHERE user_id = %s AND entry_date = %s",
            (user_id, today)
        )
        if cur.fetchone():
            return  # Manueller Eintrag hat Vorrang

        # Gewicht in kg umrechnen (Garmin liefert Gramm)
        weight_kg = float(weight_garmin) / 1000 if float(weight_garmin) > 500 else float(weight_garmin)
        body_fat = float(fat_garmin) if fat_garmin else None

        try:
            cur.execute(
                """INSERT INTO daily_input (user_id, entry_date, weight_kg, body_fat_pct, source)
                   VALUES (%s, %s, %s, %s, 'garmin_index')
                   ON CONFLICT (user_id, entry_date) DO NOTHING""",
                (user_id, today, round(weight_kg, 2), round(body_fat, 1) if body_fat else None)
            )
            conn.commit()
            logger.info("Garmin Index: %.1f kg (%.1f%% KFA) für %s importiert",
                        weight_kg, body_fat or 0, today)
        except Exception as e:
            logger.warning("Garmin Index Import fehlgeschlagen: %s", e)
            conn.rollback()


def _nested(obj, *keys):
    for k in keys:
        if not isinstance(obj, dict):
            return None
        obj = obj.get(k)
    return obj


def _upsert_raw_metrics(user_id: str, metric_date: str, p: dict) -> None:
    cols = list(p.keys())
    vals = [p[c] for c in cols]
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)

    sql = f"""
        INSERT INTO garmin_raw_metrics
            (user_id, metric_date, {', '.join(cols)})
        VALUES
            (%s, %s, {', '.join(['%s'] * len(cols))})
        ON CONFLICT (user_id, metric_date) DO UPDATE
            SET {set_clause}, updated_at = NOW()
    """

    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, [user_id, metric_date] + vals)
        conn.commit()


def _sync_new_activities(client, user_id: str, job_id: str) -> int | None:
    """Delta-Check: holt neue Aktivitäten seit letztem bekannten Eintrag."""
    from sync_activities import sync_activity

    # Letzte bekannte Aktivitäts-ID aus DB
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT MAX(garmin_activity_id) FROM garmin_activities WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        last_known_id = row[0] if row else None

    try:
        activities = client.get_activities(0, 10)  # Letzte 10
    except Exception as e:
        logger.warning("Aktivitätsliste konnte nicht geholt werden: %s", e)
        return None

    last_synced_id = None
    for act in activities:
        act_id = act.get("activityId")
        if not act_id:
            continue
        if last_known_id and act_id <= last_known_id:
            break
        # Neue Aktivität → Details holen
        try:
            sync_activity(client, user_id, act)
            last_synced_id = act_id
            logger.info("Neue Aktivität gespeichert: %s (%s)", act_id, act.get("activityName"))
        except Exception as e:
            logger.error("Fehler beim Sync von Aktivität %s: %s", act_id, e)

    return last_synced_id


def _finish_job(job_id, status, total, success, errors=None, last_activity_id=None):
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE sync_jobs
               SET status            = %s,
                   finished_at       = NOW(),
                   endpoints_total   = %s,
                   endpoints_success = %s,
                   error_details     = %s,
                   last_activity_id  = %s
             WHERE id = %s
            """,
            (status, total, success,
             json.dumps(errors) if errors else None,
             last_activity_id, job_id),
        )
        conn.commit()
