#!/bin/bash
set -euo pipefail

# Nur in Remote-Umgebung (Claude Code on the web) ausführen
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Node.js-Abhängigkeiten installieren
echo "[session-start] npm install..."
npm install

# Python-Abhängigkeiten für den Sync-Worker installieren
echo "[session-start] pip install sync-worker..."
pip install -r sync-worker/requirements.txt --quiet --user

echo "[session-start] Fertig."
