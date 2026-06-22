#!/usr/bin/env bash
# db/migrate.sh – Führt alle ausstehenden Migrationen idempotent aus.
# Benötigt DATABASE_URL in der Umgebung.
# Reihenfolge: schema.sql (nur bei leerem DB), dann alle migrations/*.sql aufsteigend.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL muss gesetzt sein}"

psql_exec() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }

echo "==> Prüfe/Erstelle schema_migrations Tabelle…"
psql_exec <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

# Prüfen ob DB noch leer ist (kein users-Eintrag)
TABLES=$(psql "$DATABASE_URL" -Atc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users';")

if [ "$TABLES" = "0" ]; then
    echo "==> Leere DB erkannt – schema.sql wird eingespielt…"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    psql_exec -f "$SCRIPT_DIR/schema.sql"
    psql_exec -c "INSERT INTO schema_migrations (version) VALUES ('000_schema') ON CONFLICT DO NOTHING;"
    echo "    schema.sql OK"
else
    echo "==> DB existiert bereits – überspringe schema.sql"
fi

# Alle Migrations-Dateien aufsteigend anwenden
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="$SCRIPT_DIR/migrations"

shopt -s nullglob
for f in "$MIGRATION_DIR"/*.sql; do
    version=$(basename "$f" .sql)
    APPLIED=$(psql "$DATABASE_URL" -Atc "SELECT COUNT(*) FROM schema_migrations WHERE version = '$version';")
    if [ "$APPLIED" = "0" ]; then
        echo "==> Migration: $version …"
        psql_exec -f "$f"
        psql_exec -c "INSERT INTO schema_migrations (version) VALUES ('$version') ON CONFLICT DO NOTHING;"
        echo "    $version OK"
    else
        echo "    $version bereits angewendet, übersprungen"
    fi
done

echo "==> Alle Migrationen abgeschlossen."
