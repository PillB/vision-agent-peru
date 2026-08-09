#!/bin/bash
# Persistent GitHub auth script
# This script runs gh auth login and keeps the process alive
# even after the parent shell exits.

export PATH="/home/z/.npm-global/bin:$PATH"

LOGFILE="/tmp/gh-auth-persistent.log"
PIDFILE="/tmp/gh-auth-pid"

echo "[auth-script] Starting at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOGFILE"

# Start gh auth login in the background
gh auth login --hostname github.com --git-protocol https --web >> "$LOGFILE" 2>&1 &
AUTH_PID=$!
echo "$AUTH_PID" > "$PIDFILE"

echo "[auth-script] Auth process PID: $AUTH_PID" >> "$LOGFILE"

# Wait for the process to complete (up to 15 minutes)
for i in $(seq 1 30); do
  sleep 30
  if ! kill -0 $AUTH_PID 2>/dev/null; then
    echo "[auth-script] Auth process completed at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOGFILE"
    break
  fi
  echo "[auth-script] Still waiting... ($((i*30))s elapsed)" >> "$LOGFILE"
done

echo "[auth-script] Final auth status:" >> "$LOGFILE"
gh auth status >> "$LOGFILE" 2>&1

# Configure git credential helper
gh auth setup-git >> "$LOGFILE" 2>&1

echo "[auth-script] Done at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOGFILE"
