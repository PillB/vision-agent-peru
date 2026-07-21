#!/bin/bash
# Double-fork to fully detach from the Bash tool's session
cd /home/z/my-project
exec node node_modules/.bin/next dev -p 3000 --webpack >> dev.log 2>&1
