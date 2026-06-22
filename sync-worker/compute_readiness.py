"""
Berechnet und cached daily_readiness für alle User.
Wird nach dem täglichen Garmin-Sync aufgerufen.

Logik:
  1. Garmin Training Readiness Score (falls vorhanden) verwenden
  2. Fallback: aus HRV, Schlaf und Body Battery selbst berechnen
  3. Readiness-Level: prime >= 73, moderate 34-72, low < 34
  4. Workout-Empfehlung basierend auf Level + Wochentag
  5. Eintrag in daily_readiness upserten
"""
import logging
from datetime import date, datetime

from garmin_auth import get_db_conn

logger = logging.getLogger(__name__)

WEEKLY_SKELETON = {
    0: 'push_strength',      # Mo
    1: 'zone2_run',          # Di
    2: 'pull_strength',      # Mi
    3: 'mobility',           # Do
    4: 'legs_strength',      # Fr
    5: 'zone2_run',          # Sa
    6: 'rest',               # So
}

PHASE_NOTES = {
    'prime':    'Volle Intensität · Wochenplan einhalten',
    'moderate': '−20% Intensität · −15% Volumen · Zone 2 bevorzugen',
    'low':      'Aktive Erholung oder komplette Pause · kein Krafttraining',
    'unknown':  'Noch keine Readiness-Daten – Wochenplan einhalten',
}


def classify(score) -> str:
    if score is None:
        return 'unknown'
    if score >= 73:
        return 'prime'
    if score >= 34:
        return 'moderate'
    return 'low'


def _compute_score_from_factors(garmin_row: dict) -> int | None:
    """Berechnet Score aus HRV, Schlaf und Body Battery wenn kein nativer Score vorhanden."""
    hrv_base_low = garmin_row.get("hrv_baseline_low")
    hrv_last = garmin_row.get("hrv_last_night")
    sleep = garmin_row.get("sleep_score")
    battery = garmin_row.get("body_battery_morning")

    components = []
    weights = []

    if hrv_last and hrv_base_low and hrv_base_low > 0:
        hrv_pct = min(hrv_last / hrv_base_low, 1.5)
        hrv_score = int(min(100, hrv_pct * 70))  # Normiert: Baseline = 70
        components.append(hrv_score)
        weights.append(0.5)

    if sleep:
        components.append(int(sleep))
        weights.append(0.3)

    if battery:
        components.append(int(battery))
        weights.append(0.2)

    if not components:
        return None

    total_weight = sum(weights)
    score = sum(c * w for c, w in zip(components, weights)) / total_weight
    return int(round(score))


def compute_and_cache_readiness(user_id: str, for_date: str | None = None) -> bool:
    """
    Berechnet Readiness für einen User und speichert in daily_readiness.
    Gibt True zurück wenn erfolgreich.
    """
    today = for_date or date.today().isoformat()
    weekday = datetime.fromisoformat(today).weekday()
    scheduled_workout = WEEKLY_SKELETON.get(weekday, 'rest')

    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT training_readiness_score, training_readiness_factors,
                      hrv_last_night, hrv_baseline_low, hrv_baseline_high, hrv_status,
                      sleep_score, body_battery_morning, body_battery_evening,
                      training_status, resting_heart_rate
               FROM garmin_raw_metrics WHERE user_id = %s AND metric_date = %s""",
            (user_id, today)
        )
        row = cur.fetchone()

    if not row:
        logger.debug("Keine Garmin-Daten für %s am %s – Readiness übersprungen", user_id, today)
        return False

    cols = ['training_readiness_score', 'training_readiness_factors',
            'hrv_last_night', 'hrv_baseline_low', 'hrv_baseline_high', 'hrv_status',
            'sleep_score', 'body_battery_morning', 'body_battery_evening',
            'training_status', 'resting_heart_rate']
    garmin_data = dict(zip(cols, row))

    # Score bestimmen
    native_score = garmin_data.get('training_readiness_score')
    if native_score is not None:
        score = int(native_score)
    else:
        score = _compute_score_from_factors(garmin_data)

    level = classify(score)

    # Empfehlung anpassen
    recommended = scheduled_workout
    if level == 'low':
        if 'strength' in scheduled_workout:
            recommended = 'active_recovery'
        elif scheduled_workout == 'zone2_run':
            recommended = 'walk_or_rest'
    elif level == 'moderate':
        if scheduled_workout == 'push_strength':
            recommended = 'push_reduced'
        elif scheduled_workout == 'pull_strength':
            recommended = 'pull_reduced'
        elif scheduled_workout == 'legs_strength':
            recommended = 'legs_reduced'

    reason = PHASE_NOTES.get(level, '')

    # HRV-Baseline-Abweichung
    hrv_vs_baseline = None
    hrv_last = garmin_data.get('hrv_last_night')
    hrv_low = garmin_data.get('hrv_baseline_low')
    if hrv_last and hrv_low and hrv_low > 0:
        hrv_vs_baseline = round((hrv_last / hrv_low - 1) * 100, 1)

    # Deload-Woche prüfen
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT id FROM deload_weeks WHERE user_id = %s
               AND week_start_date <= %s AND week_start_date + 7 > %s::date""",
            (user_id, today, today)
        )
        is_deload = cur.fetchone() is not None

    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """INSERT INTO daily_readiness
                 (user_id, plan_date, readiness_score, readiness_level,
                  scheduled_workout_type, recommended_workout_type, recommendation_reason,
                  hrv_vs_baseline_pct, sleep_score, body_battery_morning,
                  hrv_status, training_status, is_deload_week)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (user_id, plan_date) DO UPDATE
                 SET readiness_score = EXCLUDED.readiness_score,
                     readiness_level = EXCLUDED.readiness_level,
                     recommended_workout_type = EXCLUDED.recommended_workout_type,
                     recommendation_reason = EXCLUDED.recommendation_reason,
                     hrv_vs_baseline_pct = EXCLUDED.hrv_vs_baseline_pct,
                     sleep_score = EXCLUDED.sleep_score,
                     body_battery_morning = EXCLUDED.body_battery_morning,
                     hrv_status = EXCLUDED.hrv_status,
                     training_status = EXCLUDED.training_status,
                     is_deload_week = EXCLUDED.is_deload_week,
                     updated_at = NOW()""",
            (user_id, today, score, level,
             scheduled_workout, recommended, reason,
             hrv_vs_baseline,
             garmin_data.get('sleep_score'),
             garmin_data.get('body_battery_morning'),
             garmin_data.get('hrv_status'),
             garmin_data.get('training_status'),
             is_deload)
        )
        conn.commit()

    logger.info("Readiness für %s am %s: score=%s level=%s", user_id, today, score, level)
    return True


def compute_for_all_users() -> None:
    """Berechnet Readiness für alle aktiven User."""
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM users")
        user_ids = [str(row[0]) for row in cur.fetchall()]

    for uid in user_ids:
        try:
            compute_and_cache_readiness(uid)
        except Exception as e:
            logger.error("Readiness-Fehler für User %s: %s", uid, e)
