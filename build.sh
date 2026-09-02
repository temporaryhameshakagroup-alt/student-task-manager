#!/bin/bash
set -e
npm install
node --check server.js
nohup npm start > app.log 2>&1 &
sleep 3
curl -s http://localhost:3000/api/tasks | head -c 200
echo ""
echo "Build successful - app is running at http://localhost:3000"
