#!/usr/bin/env bash
# =============================================================================
# Smoke test for ElevenLabs MEDICAL_ASSISTANT mode.
#
# Usage:
#   AUTH0_TOKEN="<jwt>" ./scripts/test-medical-assistant-tts.sh
#   AUTH0_TOKEN="<jwt>" OUT_DIR=/tmp/tts-test ./scripts/test-medical-assistant-tts.sh
#   AUTH0_TOKEN="<jwt>" ENV_FILE=./.env ./scripts/test-medical-assistant-tts.sh
#
# Prerequisites:
#   - backend/.env contains SUPABASE_URL
#   - elevenlabs-tts edge function is deployed
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env}"
AUTH0_TOKEN="${AUTH0_TOKEN:-}"
OUT_DIR="${OUT_DIR:-$BACKEND_DIR/.tmp/tts-smoke}"

if [[ -z "$AUTH0_TOKEN" ]]; then
  echo "Error: AUTH0_TOKEN is required."
  echo "Example: AUTH0_TOKEN=\"<jwt>\" ./scripts/test-medical-assistant-tts.sh"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found at $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Error: SUPABASE_URL is missing in $ENV_FILE"
  exit 1
fi

mkdir -p "$OUT_DIR"
BASE_URL="${SUPABASE_URL%/}/functions/v1/elevenlabs-tts"

sections=("CONSENT_OVERVIEW" "AHHH_TEST" "PA_TA_KA_TEST")

for section in "${sections[@]}"; do
  outfile="$OUT_DIR/${section}.mp3"
  echo "Testing section: $section"
  curl -sS -f "$BASE_URL" \
    -H "Authorization: Bearer $AUTH0_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"mode\":\"MEDICAL_ASSISTANT\",\"section\":\"$section\"}" \
    --output "$outfile"

  bytes="$(wc -c < "$outfile" | tr -d ' ')"
  if [[ "$bytes" -lt 1000 ]]; then
    echo "Warning: $section output is very small (${bytes} bytes)."
  else
    echo "OK: $section -> $outfile (${bytes} bytes)"
  fi
done

echo ""
echo "Medical assistant TTS smoke test complete."
