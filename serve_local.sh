#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8000}"

get_ip() {
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || true
  fi
  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}'
  fi
}

IP="$(get_ip)"
if [[ -z "${IP}" ]]; then
  IP="<your-local-ip>"
fi

echo "Serving on: http://${IP}:${PORT}"
python3 -m http.server "${PORT}" --bind 0.0.0.0
