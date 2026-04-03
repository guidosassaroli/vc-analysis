#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for .env
if [ ! -f "$ROOT/.env" ]; then
  echo "⚠️  No .env file found. Copying from .env.example..."
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "   → Edit $ROOT/.env and add your ANTHROPIC_API_KEY before proceeding."
  exit 1
fi

echo "🚀 Starting VC Deal Flow Intelligence..."
echo ""

# Start backend
echo "▶  Backend (FastAPI on :8000)"
cd "$ROOT/backend"
if [ ! -d "venv" ]; then
  echo "   Creating Python virtual environment..."
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q

# Copy .env to backend directory so dotenv finds it
cp "$ROOT/.env" "$ROOT/backend/.env" 2>/dev/null || true

uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 2

# Start frontend
echo ""
echo "▶  Frontend (Vite on :5173)"
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "   Installing npm dependencies..."
  npm install
fi
npm run dev &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Dashboard: http://localhost:5173"
echo "  API docs:  http://localhost:8000/docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait for either process to exit
wait $BACKEND_PID $FRONTEND_PID
