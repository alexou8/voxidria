# Voxidria

Voxidria is a voice-based Parkinson's risk screening platform.

## Current Stack

- `frontend/`: React SPA built with Vite
- `backend/`: Supabase Edge Functions + migrations + ML assets

There is no Next.js `pages` router and no Next.js API routes in this repo.

## Quick Start

### 1. Install frontend dependencies

```bash
npm run install:all
```

### 2. Configure frontend environment

```bash
cp frontend/.env.example frontend/.env
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

For backend setup/deploy details, see:
- `backend/README.md`
