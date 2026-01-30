#!/usr/bin/env bash
set -euo pipefail

DEFAULT_PORT="8000"
USER_SET_PORT="0"
if [[ $# -ge 1 ]]; then
  USER_SET_PORT="1"
fi
PORT="${1:-$DEFAULT_PORT}"

is_port_in_use() {
  # macOS-friendly: lsof returns 0 if something is listening on that port
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

pick_free_port() {
  local start="$1"
  local end="$2"
  local p="$start"
  while [[ "$p" -le "$end" ]]; do
    if ! is_port_in_use "$p"; then
      echo "$p"
      return 0
    fi
    p=$((p + 1))
  done
  return 1
}

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

if [[ "$PORT" == "0" ]]; then
  echo "Please provide a concrete port (e.g. ./serve_local.sh 8001)." >&2
  exit 1
fi

if is_port_in_use "$PORT"; then
  if [[ "$USER_SET_PORT" == "1" ]]; then
    echo "Port ${PORT} is already in use. Try: ./serve_local.sh $((PORT + 1))" >&2
    exit 1
  fi
  PORT="$(pick_free_port "$DEFAULT_PORT" "8100" || true)"
  if [[ -z "${PORT}" ]]; then
    echo "No free port found in ${DEFAULT_PORT}..8100. Try a higher one, e.g. ./serve_local.sh 9000" >&2
    exit 1
  fi
fi

echo "Serving on: http://${IP}:${PORT}"
python3 -m http.server "${PORT}" --bind 0.0.0.0
