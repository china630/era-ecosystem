#!/bin/sh
# Public PORT stays 3201-3210.
# When this image contains a Nest API, Next listens on 20000+PORT and Nest on 10000+PORT.
# Satellites that still serve /api from Next keep a single process on PORT.
set -e
cd /app

if [ ! -f /opt/nest-runtime/enabled ]; then
  exec node server.js
fi

PUBLIC_PORT="${PORT:-3200}"
NEST_PORT="${NEST_PORT:-$((10000 + PUBLIC_PORT))}"
NEXT_PORT="${NEXT_PORT:-$((20000 + PUBLIC_PORT))}"
export NEST_PORT NEXT_PORT

PORT="$NEXT_PORT" HOSTNAME=127.0.0.1 node /app/server.js &
NEXT_PID=$!

cd /opt/nest-runtime/app
NEST_PORT="$NEST_PORT" node node_modules/tsx/dist/cli.mjs nest/main.ts &
NEST_PID=$!

cd /app
PORT="$PUBLIC_PORT" NEST_PORT="$NEST_PORT" NEXT_PORT="$NEXT_PORT" node /app/satellite-front.mjs &
FRONT_PID=$!

echo "[satellite] public ${PUBLIC_PORT}  nest ${NEST_PORT}  next ${NEXT_PORT}"

stop_all() {
  kill "$NEXT_PID" "$NEST_PID" "$FRONT_PID" 2>/dev/null || true
}
trap stop_all TERM INT

while kill -0 "$NEXT_PID" 2>/dev/null && kill -0 "$NEST_PID" 2>/dev/null && kill -0 "$FRONT_PID" 2>/dev/null; do
  sleep 2
done
stop_all
wait
exit 1
