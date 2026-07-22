#!/bin/bash
# Robust dev server keepalive — auto-restarts if killed by cgroup OOM.
# Uses setsid to fully detach each dev server from the keepalive's process
# group, so a keepalive death doesn't take the server down with it.
# Checks every 8s; restarts on 2 consecutive failures.

cd /home/z/project 2>/dev/null || cd /home/z/my-project

# Kill any existing dev server
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

start_server() {
  rm -f dev.log
  # setsid: new session, detached from this script's process group.
  # This way if the keepalive script dies, the dev server keeps running.
  # NODE_OPTIONS=--max-old-space-size=1024 caps the dev server heap at 1GB
  # to prevent cgroup OOM kills (the container has ~3.5GB available; leaving
  # room for Playwright/Chromium which can use 1.5GB+).
  setsid bash -c "NODE_OPTIONS='--max-old-space-size=1024' node node_modules/.bin/next dev -p 3000 --webpack > dev.log 2>&1" < /dev/null > /dev/null 2>&1 &
  local PID=$!
  disown
  echo $PID > .zscripts/dev.pid
  echo "[$(date +%H:%M:%S)] Started dev server PID=$PID (heap cap=1GB)"
  # Wait up to 30s for HTTP 200
  for i in {1..30}; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
      echo "[$(date +%H:%M:%S)] Server ready (HTTP 200) after ${i}s"
      return 0
    fi
    sleep 1
  done
  echo "[$(date +%H:%M:%S)] Server failed to become ready in 30s"
  return 1
}

start_server

# Watchdog loop
FAIL_COUNT=0
while true; do
  sleep 8
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null || echo "000")
  if [ "$CODE" != "200" ]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "[$(date +%H:%M:%S)] Health check #$FAIL_COUNT failed (HTTP $CODE)"
    if [ $FAIL_COUNT -ge 2 ]; then
      echo "[$(date +%H:%M:%S)] Restarting server after 2 consecutive failures"
      pkill -f "next dev" 2>/dev/null || true
      pkill -f "next-server" 2>/dev/null || true
      sleep 5
      start_server
      FAIL_COUNT=0
    fi
  else
    FAIL_COUNT=0
  fi
done
