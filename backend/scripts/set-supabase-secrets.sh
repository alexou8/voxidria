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
# These secrets are injected as environment variables into every Edge Function.
# They are NEVER stored in version control.
# =============================================================================

set -euo pipefail

PROJECT_REF="ugmgrncvxkeaazzwizki"

echo "Setting Supabase Edge Function secrets for project: $PROJECT_REF"
echo "Make sure you have run: supabase link --project-ref $PROJECT_REF"
echo ""

# Prompt for secrets that should not be hard-coded here
read -rsp "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
echo ""
read -rsp "GEMINI_API_KEY: " GEMINI_API_KEY
echo ""
read -rsp "ELEVENLABS_API_KEY: " ELEVENLABS_API_KEY
echo ""

supabase secrets set \
  AUTH0_DOMAIN=alexou.ca.auth0.com \
  AUTH0_AUDIENCE=voxidria \
  AUTH0_ISSUER_BASE_URL=https://alexou.ca.auth0.com/ \
  SUPABASE_URL=https://ugmgrncvxkeaazzwizki.supabase.co \
  SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnbWdybmN2eGtlYWF6endpemtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDg1OTYsImV4cCI6MjA4NzgyNDU5Nn0.yrkdvsGAs2LfWUB6VZnL75WZviJYhTOY50mZldthfLM \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  GEMINI_API_KEY="$GEMINI_API_KEY" \
  GEMINI_MODEL=gemini-1.5-pro \
  ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY" \
  ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM \
  ELEVENLABS_MODEL_ID=eleven_multilingual_v2 \
  ALLOWED_ORIGIN=http://localhost:5173

echo ""
echo "Secrets set successfully. Verify with: supabase secrets list"
