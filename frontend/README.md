# Voxidria Frontend (Vite + React)

This frontend is a Vite-powered React SPA. It does not use Next.js routing or API routes.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env
```

3. Start dev server:

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

## Environment Variables

Use `VITE_` prefixed variables only:

- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL`

## Backend Link

The frontend calls Supabase Edge Functions at:

`$VITE_SUPABASE_URL/functions/v1/<function-name>`

Main client implementation lives in:
- `src/services/api.js`

## Build

```bash
npm run build
npm run preview
```
