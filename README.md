# Voxidria

Voxidria is a voice-based Parkinson's risk screening platform.

## Stack

- **Frontend**: React SPA built with Vite + React Router
- **Backend**: Supabase Edge Functions (Deno/TypeScript) + PostgreSQL migrations
- **ML**: Python audio analysis pipeline (TensorFlow, Librosa, Praat-Parselmouth)
- **Auth**: Auth0 (JWT, verified server-side on every request)
- **AI**: Gemini (reading task analysis), ElevenLabs (text-to-speech)

## Repository Structure

```
voxidria/
├── frontend/                         # React SPA (Vite)
│   ├── public/                       # Static assets (logos, icons, SVGs)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx / .css     # Site-wide navigation header
│   │   │   └── ResultsCard.jsx / .css # Individual result display card
│   │   ├── hooks/
│   │   │   └── useVoiceRecorder.js   # MediaRecorder hook for audio capture
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx / .css   # Home / onboarding page
│   │   │   ├── DashboardPage.jsx / .css # User session history dashboard
│   │   │   ├── RecordPage.jsx / .css    # Voice recording interface
│   │   │   └── ResultsPage.jsx / .css   # Screening results view
│   │   ├── services/
│   │   │   └── api.js                # Supabase Edge Function client
│   │   ├── App.jsx                   # Router setup
│   │   ├── main.jsx                  # Entry point
│   │   └── index.css                 # Global styles
│   ├── styles/
│   │   └── globals.css               # Additional global CSS
│   ├── .env.eg                       # Environment variable template
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   ├── supabase/
│   │   ├── config.toml               # Supabase CLI config
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql  # users, test_sessions, session_tasks, predictions
│   │   │   └── 002_storage_setup.sql   # Private audio bucket + RLS policies
│   │   └── functions/
│   │       ├── _shared/
│   │       │   ├── auth/
│   │       │   │   └── verifyAuth0.ts  # Auth0 JWT verification (JWKS-based)
│   │       │   ├── gemini/
│   │       │   │   └── readingAnalysis.ts # Gemini reading task analysis
│   │       │   ├── elevenlabs/
│   │       │   │   └── tts.ts          # ElevenLabs TTS proxy
│   │       │   ├── types/
│   │       │   │   └── index.ts        # Shared TypeScript types
│   │       │   └── utils/
│   │       │       ├── cors.ts         # CORS headers utility
│   │       │       └── logger.ts       # Structured logging
│   │       ├── create-session/         # POST — start a new screening session
│   │       ├── upload-url/             # POST — get signed URL for audio upload
│   │       ├── finalize-task/          # POST — submit transcript + run analysis
│   │       ├── get-session/            # GET  — fetch session + tasks + predictions
│   │       ├── list-sessions/          # GET  — list user's sessions (dashboard)
│   │       ├── delete-session/         # DELETE — remove session + audio files
│   │       └── elevenlabs-tts/         # POST — accessibility TTS endpoint
│   ├── ml/
│   │   ├── artifacts/
│   │   │   ├── parkinsons_model.h5     # Trained TensorFlow/Keras model
│   │   │   ├── scaler.joblib           # StandardScaler for feature normalization
│   │   │   └── feature_names.joblib    # Feature names in correct order
│   │   ├── data/
│   │   │   ├── parkinsons.csv          # UCI Parkinson's dataset (196 samples)
│   │   │   └── *.wav                   # Example audio files for testing
│   │   ├── audioParser.py              # Librosa-based feature extraction
│   │   ├── parsel_parser.py            # Praat/Parselmouth-based feature extraction
│   │   ├── predict.py                  # Model inference script
│   │   ├── train_model.py              # Model training script
│   │   ├── data_prep.py                # Data loading and preprocessing
│   │   ├── check_data.py               # Dataset verification utility
│   │   ├── requirements.txt            # Python dependencies
│   │   └── README.md
│   ├── scripts/
│   │   └── set-supabase-secrets.sh     # Helper to push secrets to Supabase
│   ├── .env.eg                         # Environment variable template
│   └── README.md
│
├── package.json                        # Root scripts (dev, build, install:all)
└── README.md
```

## Quick Start

### 1. Install frontend dependencies

```bash
npm run install:all
```

### 2. Configure frontend environment

```bash
cp frontend/.env.eg frontend/.env
```

Set Auth0 and Supabase public values in `frontend/.env`.

### 3. Run frontend

```bash
npm run dev
```

App URL: `http://localhost:5173`

## Backend Integration

The frontend calls Supabase Edge Functions via:

`$VITE_SUPABASE_URL/functions/v1/<function-name>`

API client location:
- `frontend/src/services/api.js`

For backend setup, deployment details, and API reference, see:
- `backend/README.md`

For the ML audio analysis pipeline, see:
- `backend/ml/README.md`
