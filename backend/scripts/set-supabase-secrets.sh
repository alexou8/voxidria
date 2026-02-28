#!/usr/bin/env bash
# =============================================================================
# Set Supabase Edge Function secrets from backend/.env and deploy ElevenLabs TTS.
#
# Usage:
#   ./scripts/set-supabase-secrets.sh
#   ENV_FILE=./.env ./scripts/set-supabase-secrets.sh
#   PROJECT_REF=abc123 DEPLOY_FUNCTION=false ./scripts/set-supabase-secrets.sh
#
# Prerequisites:
#   - Supabase CLI installed and authenticated.
#   - backend/.env populated with the required values.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env}"
DEPLOY_FUNCTION="${DEPLOY_FUNCTION:-true}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: Supabase CLI is not installed. Install with: npm install -g supabase"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found at $ENV_FILE"
  echo "Copy backend/.env.example to backend/.env and fill it in first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required_vars=(
  AUTH0_DOMAIN
  AUTH0_AUDIENCE
  AUTH0_ISSUER_BASE_URL
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_ANON_KEY
  GEMINI_API_KEY
  ELEVENLABS_API_KEY
  ELEVENLABS_VOICE_ID
  ALLOWED_ORIGIN
)

missing_vars=()
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    missing_vars+=("$var_name")
  fi
done

if (( ${#missing_vars[@]} > 0 )); then
  echo "Error: missing required env vars in $ENV_FILE:"
  printf ' - %s\n' "${missing_vars[@]}"
  exit 1
fi

GEMINI_MODEL="${GEMINI_MODEL:-gemini-1.5-pro}"
ELEVENLABS_MODEL_ID="${ELEVENLABS_MODEL_ID:-eleven_multilingual_v2}"

if [[ -n "${PROJECT_REF:-}" ]]; then
  echo "Linking Supabase project: $PROJECT_REF"
  supabase link --project-ref "$PROJECT_REF"
fi

echo "Setting Supabase Edge Function secrets from: $ENV_FILE"
secret_args=(
  "AUTH0_DOMAIN=$AUTH0_DOMAIN"
  "AUTH0_AUDIENCE=$AUTH0_AUDIENCE"
  "AUTH0_ISSUER_BASE_URL=$AUTH0_ISSUER_BASE_URL"
  "SUPABASE_URL=$SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
  "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
  "GEMINI_API_KEY=$GEMINI_API_KEY"
  "GEMINI_MODEL=$GEMINI_MODEL"
  "ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY"
  "ELEVENLABS_VOICE_ID=$ELEVENLABS_VOICE_ID"
  "ELEVENLABS_MODEL_ID=$ELEVENLABS_MODEL_ID"
  "ALLOWED_ORIGIN=$ALLOWED_ORIGIN"
)

if [[ -n "${ELEVENLABS_MEDICAL_ASSISTANT_VOICE_ID:-}" ]]; then
  secret_args+=("ELEVENLABS_MEDICAL_ASSISTANT_VOICE_ID=$ELEVENLABS_MEDICAL_ASSISTANT_VOICE_ID")
fi

supabase secrets set "${secret_args[@]}"

if [[ "$DEPLOY_FUNCTION" == "true" ]]; then
  echo "Deploying edge function: elevenlabs-tts"
  supabase functions deploy elevenlabs-tts --no-verify-jwt
fi

echo ""
echo "Done."
echo "Verify secrets: supabase secrets list"
echo "Tail logs:       supabase functions logs elevenlabs-tts --follow"
