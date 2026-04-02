#!/usr/bin/env bash
# Lending Recovery Agent — startup script
# Usage: ANTHROPIC_API_KEY=sk-ant-... ./start.sh [port]

PORT=${1:-8000}

if [ -z "$ANTHROPIC_API_KEY" ]; then
  if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
  fi
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY is not set."
  echo "  Option 1: export ANTHROPIC_API_KEY=sk-ant-..."
  echo "  Option 2: create a .env file (see .env.example)"
  exit 1
fi

echo "Starting Lending Recovery Agent on port $PORT ..."
uvicorn main:app --host 0.0.0.0 --port "$PORT" --reload
