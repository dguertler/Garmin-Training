"""
Garmin Auth – garth-Token-Cache mit AES-256-Verschlüsselung.
Tokens werden in PostgreSQL (garmin_tokens) gespeichert, nicht im Filesystem.
"""
import os
import json
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import backoff
import garth
from cryptography.fernet import Fernet
from garminconnect import Garmin
import psycopg2

logger = logging.getLogger(__name__)

# GARMIN_ENCRYPT_KEY muss als 32-Byte Fernet-Key gesetzt sein:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
_fernet = Fernet(os.environ["GARMIN_ENCRYPT_KEY"].encode())


def _encrypt(data: str) -> bytes:
    return _fernet.encrypt(data.encode())


def _decrypt(data: bytes) -> str:
    return _fernet.decrypt(data).decode()


def get_db_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def load_tokens_from_db(user_id: str) -> dict | None:
    """Lädt und entschlüsselt garth-Tokens aus PostgreSQL."""
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT token_data_enc, status FROM garmin_tokens WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        if row[1] != "active":
            logger.warning("Token für user %s hat Status: %s", user_id, row[1])
            return None
        return json.loads(_decrypt(bytes(row[0])))


def save_tokens_to_db(user_id: str, token_data: dict) -> None:
    """Verschlüsselt und speichert garth-Tokens in PostgreSQL (Upsert)."""
    enc = _encrypt(json.dumps(token_data))
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO garmin_tokens (user_id, token_data_enc, status, last_refreshed_at)
            VALUES (%s, %s, 'active', NOW())
            ON CONFLICT (user_id) DO UPDATE
                SET token_data_enc    = EXCLUDED.token_data_enc,
                    status            = 'active',
                    last_refreshed_at = NOW(),
                    updated_at        = NOW()
            """,
            (user_id, enc),
        )
        conn.commit()


def mark_token_error(user_id: str, message: str) -> None:
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE garmin_tokens
               SET status = 'error', error_message = %s, updated_at = NOW()
             WHERE user_id = %s
            """,
            (message[:1000], user_id),
        )
        conn.commit()


@backoff.on_exception(
    backoff.expo,
    Exception,
    max_tries=4,
    giveup=lambda e: "invalid_grant" in str(e).lower(),
    logger=logger,
)
def get_garmin_client(user_id: str, garmin_email: str, garmin_password: str | None = None) -> Garmin:
    """
    Gibt einen authentifizierten Garmin-Client zurück.
    Strategie:
    1. Token aus DB laden (garth OAuth-Cache)
    2. Falls kein Token → Passwort-Login, Token speichern
    3. Exponential Backoff bei Fehlern
    """
    tokens = load_tokens_from_db(user_id)

    # garth speichert Session-Daten in einem Verzeichnis – wir nutzen tempdir
    with tempfile.TemporaryDirectory() as tmpdir:
        garth_home = Path(tmpdir)

        if tokens:
            # Token-Daten ins temporäre garth-Home schreiben
            (garth_home / "oauth1_token.json").write_text(
                json.dumps(tokens.get("oauth1", {}))
            )
            (garth_home / "oauth2_token.json").write_text(
                json.dumps(tokens.get("oauth2", {}))
            )
            garth.configure(domain="garmin.com")
            garth.resume(str(garth_home))
            client = Garmin()
        else:
            if not garmin_password:
                raise ValueError(f"Kein Token für user {user_id} und kein Passwort übergeben.")
            logger.info("Erstmaligen Login für user %s durchführen …", user_id)
            client = Garmin(garmin_email, garmin_password)
            client.login()

        # Verbindung testen
        client.connectapi  # Wirft Exception wenn nicht authentifiziert

        # Aktuellen Token-Stand zurück in DB speichern
        try:
            new_tokens = {
                "oauth1": json.loads((garth_home / "oauth1_token.json").read_text())
                if (garth_home / "oauth1_token.json").exists() else {},
                "oauth2": json.loads((garth_home / "oauth2_token.json").read_text())
                if (garth_home / "oauth2_token.json").exists() else {},
            }
            save_tokens_to_db(user_id, new_tokens)
        except Exception as e:
            logger.warning("Token konnte nicht gespeichert werden: %s", e)

        return client
