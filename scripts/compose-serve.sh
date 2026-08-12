#!/bin/sh
# Used by docker-compose api/ui. Keeps the named node_modules volume in sync with
# package-lock.json, then starts the requested Nx target.
set -eu

cd /app
mkdir -p node_modules

TARGET="${1:?usage: compose-serve.sh api|ui}"
HASH="$(sha256sum package-lock.json | awk '{print $1}')"
STAMP="node_modules/.compose-lock-hash"
LOCK="node_modules/.compose-install.lock"

needs_install() {
  [ ! -x node_modules/.bin/nx ] && return 0
  [ ! -f "$STAMP" ] && return 0
  [ "$(cat "$STAMP")" != "$HASH" ] && return 0
  return 1
}

(
  flock 9
  if needs_install; then
    echo "[compose-serve] Installing npm deps for lockfile ${HASH}..."
    npm ci --legacy-peer-deps
    echo "$HASH" >"$STAMP"
    echo "[compose-serve] Install complete."
  else
    echo "[compose-serve] node_modules already matches lockfile ${HASH}."
  fi
) 9>"$LOCK"

case "$TARGET" in
  api)
    exec npx nx serve @app-espn-lines-mono/api
    ;;
  ui)
    exec npx nx serve ui
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    exit 1
    ;;
esac
