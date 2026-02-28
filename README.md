# Voxidria

Voxidria is a web platform that records short voice tasks and uses a speech-based ML model to estimate Parkinson's risk (0–100), then uses Gemini to explain the result and next steps in plain language. Auth0 login + secure cloud storage included.

## Architecture

```
client/          React (Vite) SPA
  src/
    components/  Header, ResultsCard
    pages/       Landing, Dashboard, Record
    hooks/       useVoiceRecorder
    services/    API client

server/          Express REST API
  src/
    routes/      /api/health, /api/voice
    middleware/  Auth0 JWT verification
    services/    Speech analysis, Gemini explanation
    config/      Environment configuration
```

## Quick Start

### Prerequisites

- Node.js 18+
- An [Auth0](https://auth0.com) account (free tier works)
- A [Google Gemini API key](https://ai.google.dev) (optional — the app falls back to built-in explanations)

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Fill in your Auth0 and Gemini credentials.

**Auth0 setup:**

1. Create a **Single Page Application** in Auth0
2. Set Allowed Callback / Logout / Web Origins to `http://localhost:5173`
3. Create an **API** with identifier `https://voxidria-api`
4. Copy your domain and client ID into the `.env` files

### 3. Run in development

```bash
npm run dev
```

This starts both the Express server (port 3001) and the Vite dev server (port 5173) with hot reload.

### 4. Build for production

```bash
npm run build   # builds the client
npm start       # serves everything from Express
```

## Voice Tasks

Users complete one of three voice tasks designed to capture vocal biomarkers:

| Task | Description | Duration |
|------|-------------|----------|
| Sustained Vowel | Say "Ahhh" steadily | 10s |
| Sentence Reading | Read a predefined sentence aloud | 15s |
| Free Speech | Describe yesterday naturally | 30s |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/voice/tasks` | Yes | List available voice tasks |
| POST | `/api/voice/analyze` | Yes | Upload audio and get risk assessment |

## Disclaimer

Voxidria is a screening tool and does not provide medical diagnoses. Always consult a qualified healthcare professional for medical advice.
