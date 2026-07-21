#!/bin/bash
# Start dev server, wait for ready, keep alive for tests.
# Usage: ./keep-alive.sh

set -e
cd /home/z/my-project

# Kill any existing dev server
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

# Start fresh
rm -f dev.log
nohup node node_modules/.bin/next dev -p 3000 --webpack > dev.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
echo $SERVER_PID > .zscripts/dev.pid

# Wait for server to be ready and respond
echo "Waiting for server to be ready..."
for i in {1..60}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    echo "✓ Server is ready after $((i*2))s (HTTP $CODE)"
    break
  fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "✗ Server process died after $((i*2))s"
    echo "---log---"
    cat dev.log
    exit 1
  fi
  sleep 2
done

# Verify still alive
if kill -0 $SERVER_PID 2>/dev/null; then
  echo "✓ Server is alive, PID=$SERVER_PID"
  echo "$SERVER_PID" > .zscripts/dev.pid
else
  echo "✗ Server died"
  cat dev.log
  exit 1
fi
