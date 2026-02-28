# Voxidria Backend

Backend for Voxidria — a Parkinson's speech-risk screening platform using Auth0, Supabase, Gemini, and ElevenLabs.

> **Medical Disclaimer**: Voxidria is a screening tool only. It does not diagnose Parkinson's disease or any other medical condition. Always consult a qualified healthcare professional about health concerns.

---

## Architecture

```
Frontend (Next.js/React)
        │
        │  Auth0 JWT in Authorization header
        ▼
Supabase Edge Functions  ← Public API layer (never exposes secrets)
        │                   Verifies Auth0 JWT on every request
        │
        ├── Supabase Postgres  (users, sessions, tasks, predictions)
        ├── Supabase Storage   (private audio bucket)
        ├── Gemini API         (reading task analysis)
        ├── ElevenLabs API     (text-to-speech accessibility)
        └── Inference Service  (optional: Python/FastAPI ML pipeline)
```

**Two-tier design:**
1. **Supabase Edge Functions** — public-facing API. All secrets live here.
2. **Inference Microservice** (optional) — Python FastAPI for ML audio analysis.

**Auth0 is the sole identity provider.** We do NOT use Supabase Auth.
The `SUPABASE_SERVICE_ROLE_KEY` is only ever used inside Edge Functions — never sent to clients.

---

## Directory Structure

```
backend/
├── supabase/
│   ├── config.toml                   # Local Supabase CLI config
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # users, test_sessions, session_tasks, predictions
│   │   └── 002_storage_setup.sql     # Private audio bucket + RLS policies
│   └── functions/
│       ├── _shared/
│       │   ├── auth/
│       │   │   └── verifyAuth0.ts    # Auth0 JWT verification (JWKS-based)
│       │   ├── gemini/
│       │   │   └── readingAnalysis.ts # Gemini reading task analysis
│       │   ├── elevenlabs/
│       │   │   └── tts.ts            # ElevenLabs TTS proxy
│       │   ├── types/
│       │   │   └── index.ts          # Shared TypeScript types
│       │   └── utils/
│       │       ├── cors.ts           # CORS headers utility
│       │       └── logger.ts         # Structured logging
│       ├── create-session/           # POST — start a new screening session
│       ├── upload-url/               # POST — get signed URL for audio upload
│       ├── finalize-task/            # POST — submit transcript + run analysis
│       ├── get-session/              # GET  — fetch session + tasks + predictions
│       ├── list-sessions/            # GET  — list user's sessions (dashboard)
│       ├── delete-session/           # DELETE — remove session + audio files
│       └── elevenlabs-tts/           # POST — accessibility TTS endpoint
├── .env.example                      # All required environment variables
└── README.md                         # This file
```

---

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)
- [Deno](https://deno.land/) (for running Edge Functions locally)
- Auth0 account + tenant
- Google AI Studio account (Gemini API key)
- ElevenLabs account (API key + voice ID)

---

## Setup

### 1. Clone and configure environment

```bash
cp .env.example .env
# Fill in all values in .env — see comments for where to find each key
```

### 2. Create Supabase project

1. Go to [app.supabase.com](https://app.supabase.com/) and create a new project.
2. Copy your **Project URL** and **Service Role key** (Project Settings → API).
3. Copy your **Anon key** (for the frontend).

### 3. Apply database migrations

```bash
# Using Supabase CLI (recommended)
supabase login
supabase link --project-ref <your-project-ref>
supabase db push

# Or apply manually in Supabase SQL Editor:
# Paste contents of migrations/001_initial_schema.sql then 002_storage_setup.sql
```

### 4. Configure Auth0

1. Create a **Regular Web Application** in Auth0 for your frontend.
2. Create an **API** in Auth0:
   - Name: `Voxidria API`
   - Identifier: `https://voxidria-api` (or your preferred identifier — must match `AUTH0_AUDIENCE`)
3. Set **Allowed Callback URLs** and **Allowed Logout URLs** to your frontend URL.
4. Enable `email` scope so the JWT includes the user's email.
5. Copy `Domain`, `Client ID`, and `Client Secret` into your `.env`.

### 5. Deploy Edge Functions

```bash
# Deploy all Edge Functions
supabase functions deploy create-session --no-verify-jwt
supabase functions deploy upload-url --no-verify-jwt
supabase functions deploy finalize-task --no-verify-jwt
supabase functions deploy get-session --no-verify-jwt
supabase functions deploy list-sessions --no-verify-jwt
supabase functions deploy delete-session --no-verify-jwt
supabase functions deploy elevenlabs-tts --no-verify-jwt
```

We pass `--no-verify-jwt` because we verify Auth0 JWTs manually inside each function (Supabase's built-in JWT verification only works with Supabase Auth).

### 6. Set Edge Function secrets

```bash
supabase secrets set AUTH0_DOMAIN=your-tenant.us.auth0.com
supabase secrets set AUTH0_AUDIENCE=https://voxidria-api
supabase secrets set AUTH0_ISSUER_BASE_URL=https://your-tenant.us.auth0.com/
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJh...
supabase secrets set GEMINI_API_KEY=AIza...
supabase secrets set GEMINI_MODEL=gemini-1.5-pro
supabase secrets set ELEVENLABS_API_KEY=sk_...
supabase secrets set ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
supabase secrets set ELEVENLABS_MEDICAL_ASSISTANT_VOICE_ID=<optional-voice-id>
supabase secrets set ELEVENLABS_MODEL_ID=eleven_multilingual_v2
supabase secrets set ALLOWED_ORIGIN=https://your-frontend.vercel.app
```

Or use the helper script to load values from `backend/.env`:

```bash
cd backend
PROJECT_REF=<your-project-ref> ./scripts/set-supabase-secrets.sh
```

---

## Running Locally

```bash
# Start local Supabase stack (Postgres + Storage + Edge Functions)
supabase start

# Serve a specific Edge Function locally with hot reload
supabase functions serve create-session --env-file .env

# Or serve all functions
supabase functions serve --env-file .env
```

The local Edge Function URL will be: `http://localhost:54321/functions/v1/<function-name>`

---

## ElevenLabs Medical Assistant Setup

1. Ensure `backend/.env` includes:
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_VOICE_ID`
   - `ELEVENLABS_MODEL_ID`
   - optional `ELEVENLABS_MEDICAL_ASSISTANT_VOICE_ID`
2. Push secrets + deploy function:

```bash
cd backend
PROJECT_REF=<your-project-ref> ./scripts/set-supabase-secrets.sh
```

3. Run smoke test (requires a valid Auth0 access token for your API):

```bash
cd backend
AUTH0_TOKEN="<jwt>" ./scripts/test-medical-assistant-tts.sh
```

Expected output: 3 mp3 files generated for `CONSENT_OVERVIEW`, `AHHH_TEST`, and `PA_TA_KA_TEST`.

---

## API Reference

All endpoints require `Authorization: Bearer <auth0_token>` unless noted.

### POST `/functions/v1/create-session`

Start a new screening session.

```bash
curl -X POST https://<project>.supabase.co/functions/v1/create-session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "consent_version_accepted": "1.0",
    "device_meta": { "browser": "Chrome", "sample_rate": 48000 },
    "reading_original_text": "The rainbow is a division of white light..."
  }'
```

Response: `{ "session_id": "<uuid>", "tasks": [...] }`

---

### POST `/functions/v1/upload-url`

Get a signed upload URL for an audio task.

```bash
curl -X POST https://<project>.supabase.co/functions/v1/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<uuid>",
    "task_type": "READING",
    "content_type": "audio/webm"
  }'
```

Response: `{ "signedUrl": "...", "path": "audio/...", "expiresIn": 300 }`

Client then uploads the audio blob directly:
```bash
curl -X PUT "$SIGNED_URL" \
  -H "Content-Type: audio/webm" \
  --data-binary @recording.webm
```

---

### POST `/functions/v1/finalize-task`

Submit transcript and trigger Gemini reading analysis.

```bash
curl -X POST https://<project>.supabase.co/functions/v1/finalize-task \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<uuid>",
    "task_type": "READING",
    "transcript_text": "The rainbow is a division of white light into many beautiful colors...",
    "transcript_words": [
      { "word": "The", "start_ms": 0, "end_ms": 250 },
      { "word": "rainbow", "start_ms": 280, "end_ms": 680 }
    ]
  }'
```

Response: `{ "task_status": "ANALYZED", "analysis_json": { ... } }`

---

### GET `/functions/v1/get-session?session_id=<uuid>`

Fetch a session with tasks and predictions.

```bash
curl "https://<project>.supabase.co/functions/v1/get-session?session_id=<uuid>" \
  -H "Authorization: Bearer $TOKEN"
```

Response: `{ "session": {...}, "tasks": [...], "predictions": [...] }`

---

### GET `/functions/v1/list-sessions?limit=10&offset=0`

List user's sessions (most recent first).

```bash
curl "https://<project>.supabase.co/functions/v1/list-sessions?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

Response: `{ "sessions": [...], "total": 5 }`

---

### DELETE `/functions/v1/delete-session?session_id=<uuid>`

Delete session, tasks, predictions, and audio files.

```bash
curl -X DELETE "https://<project>.supabase.co/functions/v1/delete-session?session_id=<uuid>" \
  -H "Authorization: Bearer $TOKEN"
```

Response: `{ "deleted": true, "session_id": "<uuid>" }`

---

### POST `/functions/v1/elevenlabs-tts`

Text-to-speech for accessibility features.

```bash
curl -X POST https://<project>.supabase.co/functions/v1/elevenlabs-tts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "mode": "SITE_HELP" }' \
  --output help-audio.mp3
```

Modes:
- `SITE_HELP` (landing page explanation)
- `RESULTS_HELP` (results page explanation)
- `MEDICAL_ASSISTANT` (scripted instructions and consent guidance). Optional body field: `section` = `CONSENT_OVERVIEW` | `AHHH_TEST` | `PA_TA_KA_TEST` | `READING_TEST`
- `CUSTOM` (requires `text` field)

Response: `audio/mpeg` binary

---

## Security Notes

| Secret | Where used | Frontend safe? |
|--------|-----------|---------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | ❌ Never |
| `GEMINI_API_KEY` | Edge Functions only | ❌ Never |
| `ELEVENLABS_API_KEY` | Edge Functions only | ❌ Never |
| `SUPABASE_ANON_KEY` | Frontend SDK | ✅ Yes |
| `AUTH0_DOMAIN` | Frontend + server | ✅ Yes (public) |
| `AUTH0_CLIENT_ID` | Frontend only | ✅ Yes (public) |
| `AUTH0_AUDIENCE` | Frontend + server | ✅ Yes (public) |

- Auth0 JWT is verified on **every** Edge Function request.
- Session **ownership** is checked before any read/write/delete.
- Storage paths are constructed server-side; clients never choose upload paths.
- CORS is restricted to `ALLOWED_ORIGIN`.
- Audio files are in a **private** bucket; no direct public access.
