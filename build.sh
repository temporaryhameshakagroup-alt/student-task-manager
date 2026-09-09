#!/bin/bash
set -e
npm install
npm run build
node --check server.js
