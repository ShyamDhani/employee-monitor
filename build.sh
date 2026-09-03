#!/bin/bash
set -e

echo "==> Installing backend dependencies..."
cd backend
npm install

echo "==> Building web dashboard..."
cd ../web-dashboard
npm install --include=dev
npx vite build

echo "==> Build complete!"
