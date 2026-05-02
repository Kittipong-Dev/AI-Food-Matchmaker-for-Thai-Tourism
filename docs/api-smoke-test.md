# API Smoke Test

Use this to verify that the backend API is working and to check whether external providers are real or falling back to mocks.

## Local Server

Start backend:

```powershell
npm run dev
```

Run normal smoke test:

```powershell
npm run test:api
```

If `localhost` has a Node fetch issue on Windows, use `127.0.0.1`:

```powershell
npm run test:api -- --base-url http://127.0.0.1:3000
```

Run against a deployed URL:

```powershell
npm run test:api -- --base-url https://your-vercel-url.vercel.app
```

## Strict Provider Test

Strict mode fails if external providers fall back.

```powershell
npm run test:api -- --strict-providers
```

Against Vercel:

```powershell
npm run test:api -- --base-url https://your-vercel-url.vercel.app --strict-providers
```

For slow LLM providers, increase timeout:

```powershell
npm run test:api -- --strict-providers --timeout-ms 120000
```

## What Strict Mode Checks

### `DATABASE_URL`

Endpoint:

```text
GET /api/db/health
```

Expected:

```json
{
  "ok": true,
  "databaseTime": "..."
}
```

There is no database fallback. If this fails, `DATABASE_URL` is missing, wrong, not available in the current Vercel environment, or the database cannot be reached.

### `EMBEDDING_SERVICE_URL`

Endpoint:

```text
POST /api/embeddings/refresh
```

Test body:

```json
{
  "target": "menus",
  "language": "en",
  "limit": 1
}
```

Expected strict provider:

```json
{
  "provider": "service",
  "dimension": 384
}
```

Fallback values that strict mode treats as failure:

```text
mock
mock_fallback
```

Meaning:

- `mock`: `EMBEDDING_SERVICE_URL` is empty.
- `mock_fallback`: `EMBEDDING_SERVICE_URL` exists but request failed.

### `SERPAPI_API_KEY`

Endpoint:

```text
POST /api/recommend
```

Expected strict transport:

```json
{
  "provider": "serpapi_google_maps",
  "durationMinutes": 4.1,
  "distanceKm": 1.5
}
```

Fallback or bad values that strict mode treats as failure:

```text
transport: null
provider: serpapi_google_maps_fallback
warning: ...
estimateType: straight_line_fallback
```

Required environment:

```env
TRANSPORT_DISTANCE_PROVIDER=serpapi
SERPAPI_API_KEY=your_key
```

### `OPENROUTER_API_KEY`

Endpoints:

```text
POST /api/menu/suggest-tags
GET /api/dashboard/restaurants/:restaurantId?includeLlm=true&language=th
```

Expected strict providers:

```text
openrouter
```

Fallback values that strict mode treats as failure:

```text
mock_llm
mock_fallback
```

Required environment:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=openrouter/free
```

## Full Write-Capable Test

This also runs idempotent PUT tests and creates one match history row.

```powershell
npm run test:api -- --include-writes
```

With strict provider checks:

```powershell
npm run test:api -- --include-writes --strict-providers
```

## Skip Embedding Refresh

Embedding refresh writes vectors to the database. If you only want a read-heavy test:

```powershell
npm run test:api -- --skip-embedding
```

## Direct cURL Checks

Database:

```bash
curl http://localhost:3000/api/db/health
```

Embedding service:

```bash
curl -X POST http://localhost:3000/api/embeddings/refresh \
  -H "Content-Type: application/json" \
  -d '{"target":"menus","language":"en","limit":1}'
```

OpenRouter menu suggestion:

```bash
curl -X POST http://localhost:3000/api/menu/suggest-tags \
  -H "Content-Type: application/json" \
  -d '{"menuName":"Demo Strange Menu 12345","language":"en"}'
```

OpenRouter dashboard insight:

```bash
curl "http://localhost:3000/api/dashboard/restaurants/20000000-0000-0000-0000-000000000001?days=30&includeLlm=true&language=th"
```

SerpApi transport through recommendation:

```bash
curl -X POST http://localhost:3000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"userId":"10000000-0000-0000-0000-000000000001","groupId":"30000000-0000-0000-0000-000000000001","currentLocation":{"lat":18.795,"lng":98.98},"query":"spicy local food with mountain view, no pork, no shrimp","limit":3}'
```
