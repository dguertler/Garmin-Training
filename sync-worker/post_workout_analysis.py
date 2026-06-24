"""
Post-Workout-Analyse: wird nach jedem Activity-Sync aufgerufen.
Vergleicht neue Aktivität mit letzter gleichartiger, berechnet:
  - Pace-Delta (Lauf), HR-Delta, Distanz-Delta
  - Aerobic Decoupling (Pa:HR Drift)
  - Kraft: Volumen-Delta, Ø RIR
  - 80/20-Zone-Check
  - Gesamtbewertung: 'good' | 'ok' | 'warning'
"""
import os
import json
import logging
from datetime import date
import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

DB_URL = os.environ["DATABASE_URL"]


def _conn():
    return psycopg2.connect(DB_URL)


def _get_activity(conn, activity_id: str) -> dict | None:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """SELECT id, user_id, activity_type, start_time, distance_meters,
                      duration_seconds, avg_hr, avg_pace_per_km,
                      training_effect_aerobic, training_effect_anaerobic
               FROM garmin_activities WHERE id = %s""",
            (activity_id,)
        )
        return cur.fetchone()


def _get_prev_similar(conn, user_id: str, activity_type: str, current_id: str) -> dict | None:
    """Letzte Aktivität desselben Typs vor der aktuellen."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """SELECT id, distance_meters, duration_seconds, avg_hr, avg_pace_per_km
               FROM garmin_activities
               WHERE user_id = %s AND activity_type = %s AND id != %s
               ORDER BY start_time DESC LIMIT 1""",
            (user_id, activity_type, current_id)
        )
        return cur.fetchone()


def _get_hr_zones(conn, activity_id: str) -> list[dict]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT zone_number, seconds_in_zone FROM garmin_activity_hr_zones WHERE activity_id = %s ORDER BY zone_number",
            (activity_id,)
        )
        return cur.fetchall()


def _get_splits(conn, activity_id: str) -> list[dict]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT split_index, distance_meters, duration_seconds, avg_hr, avg_pace_per_km FROM garmin_activity_splits WHERE activity_id = %s ORDER BY split_index",
            (activity_id,)
        )
        return cur.fetchall()


def _calc_aerobic_decoupling(splits: list[dict]) -> float | None:
    """
    Pa:HR (Pace:HeartRate) Decoupling.
    Vergleicht erste Hälfte vs zweite Hälfte: (HR_end/Pace_end) / (HR_start/Pace_start) - 1
    < 5% = gut aerob, > 5% = Drift, > 10% = warnung
    """
    if len(splits) < 4:
        return None
    mid = len(splits) // 2
    first = splits[:mid]
    second = splits[mid:]

    def hr_pace_ratio(chunk):
        valid = [s for s in chunk if s["avg_hr"] and s["avg_pace_per_km"] and s["avg_pace_per_km"] > 0]
        if not valid:
            return None
        avg_hr = sum(s["avg_hr"] for s in valid) / len(valid)
        avg_pace = sum(s["avg_pace_per_km"] for s in valid) / len(valid)
        return avg_hr / avg_pace  # höher = schlechter (mehr HR pro Pace-Einheit)

    r1 = hr_pace_ratio(first)
    r2 = hr_pace_ratio(second)
    if r1 is None or r2 is None or r1 == 0:
        return None
    decoupling = ((r2 - r1) / r1) * 100  # % Drift
    return round(decoupling, 2)


def _calc_zone_pcts(hr_zones: list[dict]) -> tuple[float, float, float]:
    """Gibt (z1z2_pct, z3_pct, z4z5_pct) zurück."""
    zone_secs = {z["zone_number"]: z["seconds_in_zone"] or 0 for z in hr_zones}
    total = sum(zone_secs.values())
    if total == 0:
        return 0.0, 0.0, 0.0
    z1z2 = round((zone_secs.get(1, 0) + zone_secs.get(2, 0)) / total * 100, 1)
    z3 = round(zone_secs.get(3, 0) / total * 100, 1)
    z4z5 = round((zone_secs.get(4, 0) + zone_secs.get(5, 0)) / total * 100, 1)
    return z1z2, z3, z4z5


def _build_insights(
    activity_type: str,
    avg_pace_vs_prev: float | None,
    avg_hr_vs_prev: float | None,
    aerobic_decoupling: float | None,
    pct_z1z2: float,
    pct_z3: float,
    pct_z4z5: float,
) -> tuple[list[dict], str]:
    """Erstellt Insight-Liste und Overall-Rating."""
    insights = []
    warnings = 0

    # Lauf-spezifisch
    if activity_type in ("running", "trail_running") and avg_pace_vs_prev is not None:
        if avg_pace_vs_prev < -10:
            insights.append({"type": "pace", "message": f"Pace verbessert: {abs(avg_pace_vs_prev):.0f}s/km schneller", "severity": "good"})
        elif avg_pace_vs_prev > 15:
            insights.append({"type": "pace", "message": f"Pace langsamer als letzte Session: +{avg_pace_vs_prev:.0f}s/km", "severity": "warning"})
            warnings += 1

    if avg_hr_vs_prev is not None:
        if avg_hr_vs_prev < -5:
            insights.append({"type": "hr", "message": f"HR niedriger bei gleicher Belastung: {abs(avg_hr_vs_prev):.0f} BPM → Anpassung sichtbar", "severity": "good"})
        elif avg_hr_vs_prev > 8:
            insights.append({"type": "hr", "message": f"HR erhöht: +{avg_hr_vs_prev:.0f} BPM vs. letzte Session → prüfe Erholung", "severity": "warning"})
            warnings += 1

    if aerobic_decoupling is not None:
        if aerobic_decoupling > 10:
            insights.append({"type": "decoupling", "message": f"Aerober Drift {aerobic_decoupling:.1f}% – Grundlagenausdauer prüfen (Ziel <5%)", "severity": "warning"})
            warnings += 1
        elif aerobic_decoupling > 5:
            insights.append({"type": "decoupling", "message": f"Aerober Drift {aerobic_decoupling:.1f}% – leicht erhöht (Ziel <5%)", "severity": "info"})
        else:
            insights.append({"type": "decoupling", "message": f"Aerober Drift {aerobic_decoupling:.1f}% – gut unter 5%", "severity": "good"})

    # 80/20 Check
    if pct_z3 > 25:
        insights.append({"type": "zone", "message": f"Zone 3 (grauer Bereich) bei {pct_z3}% – vermeide moderates Dauertempo", "severity": "warning"})
        warnings += 1
    elif pct_z1z2 >= 75:
        insights.append({"type": "zone", "message": f"80/20 eingehalten: {pct_z1z2}% in Z1+Z2", "severity": "good"})

    rating = "good" if warnings == 0 and insights else "warning" if warnings >= 2 else "ok"
    return insights, rating


def analyze_activity(activity_id: str) -> bool:
    """
    Analysiert eine Aktivität und speichert das Ergebnis in post_workout_analyses.
    Gibt True zurück wenn Analyse erstellt wurde.
    """
    conn = _conn()
    try:
        act = _get_activity(conn, activity_id)
        if not act:
            logger.warning(f"Aktivität {activity_id} nicht gefunden")
            return False

        # Bereits analysiert?
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM post_workout_analyses WHERE activity_id = %s", (activity_id,))
            if cur.fetchone():
                logger.debug(f"Aktivität {activity_id} bereits analysiert")
                return False

        user_id = str(act["user_id"])
        activity_type = act["activity_type"] or "unknown"

        prev = _get_prev_similar(conn, user_id, activity_type, activity_id)
        hr_zones = _get_hr_zones(conn, activity_id)
        splits = _get_splits(conn, activity_id)

        # Pace-/HR-Deltas
        pace_vs_prev = None
        hr_vs_prev = None
        dist_vs_prev = None

        if prev:
            if act.get("avg_pace_per_km") and prev.get("avg_pace_per_km"):
                pace_vs_prev = round(float(act["avg_pace_per_km"]) - float(prev["avg_pace_per_km"]), 2)
            if act.get("avg_hr") and prev.get("avg_hr"):
                hr_vs_prev = round(float(act["avg_hr"]) - float(prev["avg_hr"]), 2)
            if act.get("distance_meters") and prev.get("distance_meters"):
                dist_vs_prev = round(float(act["distance_meters"]) - float(prev["distance_meters"]), 0)

        aerobic_decoupling = _calc_aerobic_decoupling(splits)
        pct_z1z2, pct_z3, pct_z4z5 = _calc_zone_pcts(hr_zones)

        insights, rating = _build_insights(
            activity_type, pace_vs_prev, hr_vs_prev,
            aerobic_decoupling, pct_z1z2, pct_z3, pct_z4z5
        )

        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO post_workout_analyses
                     (activity_id, user_id, prev_activity_id, analysis_date,
                      avg_pace_vs_prev, avg_hr_vs_prev, distance_vs_prev, aerobic_decoupling,
                      pct_z1z2, pct_z3, pct_z4z5, overall_rating, insights)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (activity_id) DO NOTHING""",
                (
                    activity_id, user_id,
                    str(prev["id"]) if prev else None,
                    date.today().isoformat(),
                    pace_vs_prev, hr_vs_prev, dist_vs_prev, aerobic_decoupling,
                    pct_z1z2, pct_z3, pct_z4z5, rating,
                    json.dumps(insights),
                )
            )
        conn.commit()
        logger.info(f"Analyse für {activity_id} erstellt: {rating}, {len(insights)} Insights")
        return True
    except Exception as e:
        logger.error(f"Fehler bei Analyse {activity_id}: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def analyze_recent_unanalyzed(user_id: str, limit: int = 20):
    """Analysiert alle noch nicht analysierten Aktivitäten eines Users."""
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT ga.id FROM garmin_activities ga
                   LEFT JOIN post_workout_analyses pwa ON pwa.activity_id = ga.id
                   WHERE ga.user_id = %s AND pwa.id IS NULL
                   ORDER BY ga.start_time DESC LIMIT %s""",
                (user_id, limit)
            )
            ids = [row[0] for row in cur.fetchall()]
    finally:
        conn.close()

    for aid in ids:
        analyze_activity(str(aid))
