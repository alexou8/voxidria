#!/usr/bin/env bash
# =============================================================================
# Set Supabase Edge Function secrets for production deployment.
#
# Usage:
#   chmod +x scripts/set-supabase-secrets.sh
#   ./scripts/set-supabase-secrets.sh
#
# Prerequisites:
#   - Supabase CLI installed: npm install -g supabase
#   - Logged in: supabase login
#   - Project linked: supabase link --project-ref ugmgrncvxkeaazzwizki
#
# These values are injected as environment variables into every Edge Function.
# Public configuration (e.g. project ref, Auth0 domain) is hard-coded here and
# safe to commit. Sensitive secrets (service role key, API keys, anon key, and
# allowed origin) must be entered at runtime and are not stored in version control.
# =============================================================================

set -euo pipefail

PROJECT_REF="ugmgrncvxkeaazzwizki"

echo "Setting Supabase Edge Function secrets for project: $PROJECT_REF"
echo "Make sure you have run: supabase link --project-ref $PROJECT_REF"
echo ""

# Prompt for secrets that should not be hard-coded here
read -rsp "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
echo ""
read -rsp "SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
echo ""
read -rsp "GEMINI_API_KEY: " GEMINI_API_KEY
echo ""
read -rsp "ELEVENLABS_API_KEY: " ELEVENLABS_API_KEY
echo ""
read -rp "ALLOWED_ORIGIN (e.g. https://your-app.vercel.app): " ALLOWED_ORIGIN
echo ""

supabase secrets set \
  AUTH0_DOMAIN=alexou.ca.auth0.com \
  AUTH0_AUDIENCE=voxidria \
  AUTH0_ISSUER_BASE_URL=https://alexou.ca.auth0.com/ \
  SUPABASE_URL=https://ugmgrncvxkeaazzwizki.supabase.co \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  GEMINI_API_KEY="$GEMINI_API_KEY" \
  GEMINI_MODEL=gemini-1.5-pro \
  ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY" \
  ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM \
  ELEVENLABS_MODEL_ID=eleven_multilingual_v2 \
  ALLOWED_ORIGIN="$ALLOWED_ORIGIN"

echo ""
echo "Secrets set successfully. Verify with: supabase secrets list"
