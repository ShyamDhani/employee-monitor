#!/bin/bash
set -e

echo "==> Installing backend dependencies..."
cd backend
npm install

echo "==> Building web dashboard..."
cd ../web-dashboard
npm install
npm run build

echo "==> Build complete!"
