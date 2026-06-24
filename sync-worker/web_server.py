"""
Einfacher HTTP-Server für den Sync-Worker.
Erlaubt POST /sync/trigger vom Next.js-Backend.
Läuft auf Port 8001 nebenläufig zum Scheduler.
"""
import json
import logging
import os
import socket
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from garmin_auth import get_db_conn, get_garmin_client
from sync_daily import sync_user_daily

logger = logging.getLogger(__name__)
INTERNAL_KEY = os.environ.get("SYNC_INTERNAL_KEY", "")


class SyncHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self._respond(200, {'ok': True, 'status': 'running'})
        elif self.path == '/migrate':
            self._run_migrations()
        else:
            self._respond(404, {'error': 'Not found'})

    def _run_migrations(self):
        migrations = [
            ("008_password_reset", """
                ALTER TABLE user_credentials
                  ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
                  ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
                  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
                CREATE INDEX IF NOT EXISTS idx_uc_reset_token
                  ON user_credentials (password_reset_token)
                  WHERE password_reset_token IS NOT NULL;
            """),
            ("009_fix_missing_columns", """
                ALTER TABLE garmin_activity_hr_zones
                  ADD COLUMN IF NOT EXISTS time_in_zone_seconds INT;
                UPDATE garmin_activity_hr_zones
                  SET time_in_zone_seconds = seconds_in_zone
                  WHERE time_in_zone_seconds IS NULL AND seconds_in_zone IS NOT NULL;
                ALTER TABLE profile_goals
                  ADD COLUMN IF NOT EXISTS weekly_cardio_sessions INTEGER DEFAULT 2;
            """),
            ("010_daily_readiness_columns", """
                ALTER TABLE daily_readiness
                  ADD COLUMN IF NOT EXISTS hrv_status TEXT,
                  ADD COLUMN IF NOT EXISTS training_status TEXT;
            """),
            ("011_profile_goals_columns", """
                ALTER TABLE profile_goals
                  ADD COLUMN IF NOT EXISTS target_date DATE,
                  ADD COLUMN IF NOT EXISTS notes TEXT,
                  ADD COLUMN IF NOT EXISTS weekly_cardio_sessions INTEGER DEFAULT 2;
            """),
        ]
        results = []
        try:
            with get_db_conn() as conn, conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS schema_migrations (
                        version TEXT PRIMARY KEY,
                        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                conn.commit()
                for version, sql in migrations:
                    cur.execute("SELECT COUNT(*) FROM schema_migrations WHERE version = %s", (version,))
                    if cur.fetchone()[0] == 0:
                        try:
                            cur.execute(sql)
                            cur.execute("INSERT INTO schema_migrations (version) VALUES (%s) ON CONFLICT DO NOTHING", (version,))
                            conn.commit()
                            results.append({"name": version, "status": "ok"})
                        except Exception as e:
                            conn.rollback()
                            results.append({"name": version, "status": "error", "error": str(e)})
                    else:
                        results.append({"name": version, "status": "already applied"})
            self._respond(200, {"ok": True, "results": results})
        except Exception as e:
            self._respond(500, {"ok": False, "error": str(e)})

    def do_POST(self):
        if self.path == "/sync/trigger":
            self._handle_sync_trigger()
        elif self.path == "/sync/history":
            self._handle_sync_history()
        else:
            self._respond(404, {"error": "Not found"})

    def _get_user_email(self, user_id: str):
        with get_db_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT garmin_username FROM user_profiles WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
        return row

    def _check_auth(self) -> bool:
        if INTERNAL_KEY and self.headers.get("X-Internal-Key") != INTERNAL_KEY:
            self._respond(403, {"error": "Forbidden"})
            return False
        return True

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length) or b"{}")

    def _handle_sync_trigger(self):
        if not self._check_auth():
            return

        body = self._read_body()
        user_id = body.get("user_id")
        if not user_id:
            self._respond(400, {"error": "user_id required"})
            return

        row = self._get_user_email(user_id)
        if not row:
            self._respond(404, {"error": "User not found"})
            return

        garmin_email = body.get("garmin_email") or row[0]
        garmin_password = body.get("garmin_password")
        job_id = body.get("job_id")

        def run():
            try:
                sync_user_daily(user_id, garmin_email, garmin_password, job_id=job_id)
            except Exception as e:
                logger.error("Manueller Sync fehlgeschlagen: %s", e)

        threading.Thread(target=run, daemon=True).start()
        self._respond(200, {"ok": True, "message": "Sync gestartet"})

    def _handle_sync_history(self):
        if not self._check_auth():
            return

        body = self._read_body()
        user_id = body.get("user_id")
        if not user_id:
            self._respond(400, {"error": "user_id required"})
            return

        row = self._get_user_email(user_id)
        if not row:
            self._respond(404, {"error": "User not found"})
            return

        garmin_email = body.get("garmin_email") or row[0]
        garmin_password = body.get("garmin_password")
        days = int(body.get("days", 60))

        def run():
            try:
                from sync_history import sync_user_history
                sync_user_history(user_id, garmin_email, garmin_password, days=days)
            except Exception as e:
                logger.error("History-Sync fehlgeschlagen: %s", e)

        threading.Thread(target=run, daemon=True).start()
        self._respond(200, {"ok": True, "message": f"History-Sync gestartet ({days} Tage)"})


    def _respond(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        logger.info(fmt, *args)


class DualStackHTTPServer(HTTPServer):
    address_family = socket.AF_INET6


def start_web_server(port: int = 8001):
    server = DualStackHTTPServer(("::", port), SyncHandler)
    logger.info("Sync-Worker HTTP-Server auf Port %d", port)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server
