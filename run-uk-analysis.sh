#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3002}"
MARKET="${MARKET:-UK}"

# Adjust if your db path differs
DB_PATH="${DB_PATH:-$(pwd)/api/data/cu-tool.db}"

# Poll interval in seconds
INTERVAL="${INTERVAL:-10}"

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl not found"
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 not found"
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: DB not found at: $DB_PATH"
  echo "Set DB_PATH env var, e.g.: DB_PATH=~/Projects/cu-tool/api/data/cu-tool.db"
  exit 1
fi

echo "=== Full analysis run ==="
echo "API_URL   : $API_URL"
echo "MARKET    : $MARKET"
echo "DB_PATH   : $DB_PATH"
echo "INTERVAL  : ${INTERVAL}s"
echo

# Total eligible URLs (mirrors your POC scope)
total_sql="
SELECT COUNT(*)
FROM url_inventory
WHERE market = '$MARKET'
  AND status = 'fetched'
  AND duplicate_of_id IS NULL
  AND html_path IS NOT NULL
  AND html_path NOT LIKE '\\_\\_%' ESCAPE '\\';
"

analyzed_sql="
SELECT COUNT(DISTINCT url_id)
FROM david_component_usage;
"

get_total() {
  sqlite3 -noheader -batch "$DB_PATH" "$total_sql" 2>/dev/null | tr -d '[:space:]'
}

get_analyzed() {
  sqlite3 -noheader -batch "$DB_PATH" "$analyzed_sql" 2>/dev/null | tr -d '[:space:]'
}

TOTAL="$(get_total)"
if [ -z "$TOTAL" ] || [ "$TOTAL" = "0" ]; then
  echo "ERROR: TOTAL eligible URLs is 0."
  echo "Check that UK fetch + html cache is complete and the SQL scope matches your dataset."
  exit 1
fi

echo "Eligible URLs (TOTAL): $TOTAL"
echo

echo "Starting analysis via API..."
echo "POST $API_URL/api/analysis/david-components/run  {market:$MARKET, reset:true}"
echo

# Start analysis request in background; it may take a while
RUN_LOG="$(mktemp -t cu-tool-run.XXXXXX.log)"
(
  curl -sS -X POST "$API_URL/api/analysis/david-components/run" \
    -H "Content-Type: application/json" \
    -d "{\"market\":\"$MARKET\",\"reset\":true}" \
    > "$RUN_LOG"
) &
RUN_PID=$!

cleanup() {
  if kill -0 "$RUN_PID" >/dev/null 2>&1; then
    echo
    echo "Stopping analysis request (PID $RUN_PID)..."
    kill "$RUN_PID" >/dev/null 2>&1 || true
  fi
  echo "Run log: $RUN_LOG"
}
trap cleanup INT TERM

echo "Polling progress (Ctrl+C to stop)..."
echo

last_analyzed=0
same_count_ticks=0

while true; do
  if ! kill -0 "$RUN_PID" >/dev/null 2>&1; then
    # Request finished
    break
  fi

  ANALYZED="$(get_analyzed)"
  if [ -z "$ANALYZED" ]; then ANALYZED=0; fi

  # basic progress %
  pct=$(python3 - <<PY
total=int("$TOTAL")
done=int("$ANALYZED")
print(round(done*100.0/total, 1))
PY
)

  # detect if we're stuck (no change for a while)
  if [ "$ANALYZED" -eq "$last_analyzed" ]; then
    same_count_ticks=$((same_count_ticks+1))
  else
    same_count_ticks=0
  fi
  last_analyzed="$ANALYZED"

  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  printf "[%s] analyzed=%s/%s (%s%%)\n" "$ts" "$ANALYZED" "$TOTAL" "$pct"

  if [ "$ANALYZED" -ge "$TOTAL" ]; then
    echo
    echo "Progress reached 100% (or more). Waiting for API request to finish..."
    break
  fi

  if [ "$same_count_ticks" -ge 12 ]; then
    echo
    echo "WARNING: progress hasn't changed for $((same_count_ticks*INTERVAL))s."
    echo "Check API logs and consider rerunning with smaller batches if needed."
    echo
    same_count_ticks=0
  fi

  sleep "$INTERVAL"
done

echo
echo "Analysis request finished."
echo "API response saved to: $RUN_LOG"
echo

# Print a small tail of the API response for convenience
echo "---- API response (first 80 lines) ----"
head -n 80 "$RUN_LOG" || true
echo "--------------------------------------"
echo

# Final counts
FINAL_ANALYZED="$(get_analyzed)"
final_pct=$(python3 - <<PY
total=int("$TOTAL")
done=int("$FINAL_ANALYZED")
print(round(done*100.0/total, 1))
PY
)

echo "Final progress: $FINAL_ANALYZED/$TOTAL (${final_pct}%)"
