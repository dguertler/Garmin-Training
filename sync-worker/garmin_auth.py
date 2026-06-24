"""
Garmin Auth – Token-Cache mit AES-256-Verschlüsselung.
Tokens werden in PostgreSQL (garmin_tokens) gespeichert, nicht im Filesystem.

Kompatibel mit garminconnect >= 0.2.19 (DI-Token-Format: di_token / di_refresh_token).
"""
import os
import json
import logging

import backoff
from cryptography.fernet import Fernet
from garminconnect import Garmin
import psycopg2

logger = logging.getLogger(__name__)

_fernet = Fernet(os.environ["GARMIN_ENCRYPT_KEY"].encode())


def _encrypt(data: str) -> bytes:
    return _fernet.encrypt(data.encode())


def _decrypt(data: bytes) -> str:
    return _fernet.decrypt(data).decode()


def get_db_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def load_tokens_from_db(user_id: str) -> str | None:
    """
    Lädt und entschlüsselt Garmin-Client-Tokens aus PostgreSQL.
    Gibt den JSON-String zurück (di_token-Format) oder None wenn nicht verfügbar.
    """
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
        decrypted = _decrypt(bytes(row[0]))
        try:
            data = json.loads(decrypted)
            # Altes garth-Format (oauth1/oauth2) ist inkompatibel → ignorieren
            if "oauth1" in data or "oauth2" in data:
                logger.info("Alter Token-Format (garth oauth1/oauth2) für user %s – wird ignoriert", user_id)
                return None
            # Neues DI-Format muss di_token enthalten
            if not data.get("di_token"):
                logger.warning("Token für user %s hat kein di_token – wird ignoriert", user_id)
                return None
            return decrypted
        except Exception as e:
            logger.warning("Token-Deserialisierung fehlgeschlagen für user %s: %s", user_id, e)
            return None


def save_tokens_to_db(user_id: str, token_json: str) -> None:
    """Verschlüsselt und speichert Garmin-Client-Tokens in PostgreSQL (Upsert)."""
    enc = _encrypt(token_json)
    with get_db_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO garmin_tokens (user_id, token_data_enc, status, last_refreshed_at, error_message)
            VALUES (%s, %s, 'active', NOW(), NULL)
            ON CONFLICT (user_id) DO UPDATE
                SET token_data_enc    = EXCLUDED.token_data_enc,
                    status            = 'active',
                    last_refreshed_at = NOW(),
                    updated_at        = NOW(),
                    error_message     = NULL
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
    1. Token-JSON aus DB laden → direkt in Client laden
    2. Falls kein Token oder Token ungültig → Passwort-Login
    3. Nach jedem erfolgreichen Login → Token in DB speichern
    """
    tokens_json = load_tokens_from_db(user_id)
    client = Garmin(garmin_email, garmin_password)

    if tokens_json:
        try:
            client.login(tokenstore=tokens_json)
            logger.debug("Login via gecachte Tokens für user %s", user_id)
        except Exception as e:
            logger.warning("Gecachte Tokens ungültig für user %s (%s) – Passwort-Login …", user_id, e)
            tokens_json = None

    if not tokens_json:
        if not garmin_password:
            raise ValueError(f"Kein gültiger Token für user {user_id} und kein Passwort übergeben.")
        logger.info("Erstmaligen Login für user %s durchführen …", user_id)
        client.login()

    # Aktuellen Token-Stand zurück in DB speichern
    try:
        save_tokens_to_db(user_id, client.client.dumps())
    except Exception as e:
        logger.warning("Token konnte nicht gespeichert werden: %s", e)

    return client
