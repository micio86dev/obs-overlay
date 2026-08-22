#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPOSITORY_ROOT="$SCRIPT_DIRECTORY"

relay_pid=""
overlay_pid=""

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command '$1' was not found. Install it and try again."
  fi
}

stop_process() {
  local pid="$1"
  local attempt

  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    kill -TERM "$pid" >/dev/null 2>&1 || true

    for attempt in {1..20}; do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        return
      fi
      sleep 0.1
    done

    kill -KILL "$pid" >/dev/null 2>&1 || true
  fi
}

cleanup() {
  trap - EXIT INT TERM
  printf '\nStopping demo processes...\n'

  stop_process "$relay_pid"
  stop_process "$overlay_pid"

  [[ -z "$relay_pid" ]] || wait "$relay_pid" 2>/dev/null || true
  [[ -z "$overlay_pid" ]] || wait "$overlay_pid" 2>/dev/null || true
}

wait_for_process_exit() {
  while kill -0 "$relay_pid" >/dev/null 2>&1 && kill -0 "$overlay_pid" >/dev/null 2>&1; do
    sleep 1
  done

  if ! kill -0 "$relay_pid" >/dev/null 2>&1; then
    if wait "$relay_pid"; then
      printf 'The relay exited unexpectedly.\n' >&2
      return 1
    fi
    return $?
  fi

  if wait "$overlay_pid"; then
    printf 'The overlay exited unexpectedly.\n' >&2
    return 1
  fi
  return $?
}

require_command node
require_command pnpm

if [[ ! -d "$REPOSITORY_ROOT/node_modules" ]]; then
  fail "Dependencies are missing. Run 'pnpm install' in $REPOSITORY_ROOT, then run this script again."
fi

cd "$REPOSITORY_ROOT"

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf 'Starting the idle relay and browser demo from %s\n' "$REPOSITORY_ROOT"
printf 'Overlay URL: http://localhost:5173/\n'
printf 'Press Ctrl+C to stop both processes.\n\n'

EVENT_SOURCE=none MOCK_SOURCE_ENABLED=false pnpm dev:relay &
relay_pid=$!

VITE_DEMO_MODE=true pnpm dev &
overlay_pid=$!

wait_for_process_exit
