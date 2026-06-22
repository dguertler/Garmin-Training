"""
Einfacher HTTP-Server für den Sync-Worker.
Erlaubt POST /sync/trigger vom Next.js-Backend.
Läuft auf Port 8001 nebenläufig zum Scheduler.
"""
import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from garmin_auth import get_db_conn, get_garmin_client
from sync_daily import sync_user_daily

logger = logging.getLogger(__name__)
INTERNAL_KEY = os.environ.get("SYNC_INTERNAL_KEY", "")


class SyncHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/sync/trigger":
            self._respond(404, {"error": "Not found"})
            return

        # Auth prüfen
        if INTERNAL_KEY and self.headers.get("X-Internal-Key") != INTERNAL_KEY:
            self._respond(403, {"error": "Forbidden"})
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        user_id = body.get("user_id")

        if not user_id:
            self._respond(400, {"error": "user_id required"})
            return

        # Garmin-E-Mail aus DB holen
        with get_db_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT up.garmin_username FROM user_profiles up WHERE up.user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()

        if not row:
            self._respond(404, {"error": "User not found"})
            return

        garmin_email = row[0]

        # Sync in separatem Thread (Request sofort zurückgeben)
        def run():
            try:
                sync_user_daily(user_id, garmin_email)
            except Exception as e:
                logger.error("Manueller Sync fehlgeschlagen: %s", e)

        threading.Thread(target=run, daemon=True).start()
        self._respond(200, {"ok": True, "message": "Sync gestartet"})

    def _respond(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        logger.info(fmt, *args)


def start_web_server(port: int = 8001):
    server = HTTPServer(("0.0.0.0", port), SyncHandler)
    logger.info("Sync-Worker HTTP-Server auf Port %d", port)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server
