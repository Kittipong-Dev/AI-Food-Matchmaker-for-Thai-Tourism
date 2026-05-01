# AI Local Food Matchmaker for Thai Tourism

Phase 10 sets up the PostgreSQL/Supabase database foundation, tag/menu dictionary APIs, menu tag suggestions, restaurant/menu CRUD APIs, user preference/group APIs, embedding refresh, menu-first recommendations, match history learning, reviews, business dashboard insights, image metadata, and demo polish.

## Current Phase

Implemented:

- Supabase/PostgreSQL schema
- `pgvector` setup with `vector(384)`
- PostGIS setup for restaurant geospatial data
- Separate Thai and English embedding columns:
  - `restaurants.embedding_th`
  - `restaurants.embedding_en`
  - `menus.embedding_th`
  - `menus.embedding_en`
- Seed data for tags, menu dictionary, restaurants, menus, and a demo user
- Minimal Express backend
- Tag catalog APIs
- Menu dictionary APIs
- Menu tag suggestion API with dictionary-first logic, optional OpenAI provider, and mock fallback
- Restaurant CRUD APIs
- Menu CRUD APIs
- User preference CRUD APIs
- Group CRUD and member APIs
- Embedding refresh API with optional Python FastAPI embedding service
- Menu-first recommendation API with optional Google Routes travel-time scoring
- Match history API with MVP preference learner
- Review APIs
- Restaurant dashboard insight API
- Dashboard LLM business insight with OpenRouter/OpenAI and mock fallback
- Image metadata APIs for restaurants and menus
- Root API landing response
- Demo IDs endpoint for frontend integration

Not implemented yet:

- CRUD screens
- Production auth and permissions
- Paid ads/boosting
- Real LLM dashboard narrative generation

## Database Files

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/seed.sql`
- `docs/database-schema.md`
- `docs/er-diagram.md`
- `docs/api-spec.md`
- `docs/recommender-notebook-review.md`
- `docs/deployment.md`
- `docs/ai-agent-test-report.md`
- `docs/project-requirements-checklist.md`

These are the main files to send to a database collaborator.

## Environment

Create `.env` from `.env.example`.

Required later for backend DB access:

```bash
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_MAPS_API_KEY=...
SERPAPI_API_KEY=...
TRANSPORT_DISTANCE_PROVIDER=serpapi
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
EMBEDDING_SERVICE_URL=http://localhost:8001
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend JavaScript.

For free/low-cost LLM menu suggestions and dashboard summaries, set `LLM_PROVIDER=openrouter` and use OpenRouter's free router model `openrouter/free`. The backend asks OpenRouter for structured-output-capable providers and enables response healing. If `OPENROUTER_API_KEY` is missing, the provider fails, or the model returns invalid JSON, the backend falls back to mock suggestions/insights.

For route travel time, use either:

```bash
TRANSPORT_DISTANCE_PROVIDER=serpapi
SERPAPI_API_KEY=...
```

or:

```bash
TRANSPORT_DISTANCE_PROVIDER=google
GOOGLE_MAPS_API_KEY=...
```

## Apply Schema In Supabase

Option 1: Supabase SQL Editor

1. Create a Supabase project.
2. Open the Supabase dashboard.
3. Go to **SQL Editor**.
4. Run `supabase/migrations/0001_initial_schema.sql`.
5. Run `supabase/seed.sql`.
6. Go to **Project Settings > Database** and copy the connection string.
7. Put that connection string in `.env` as `DATABASE_URL`.

Option 2: Supabase CLI

```bash
supabase db push
supabase db seed
```

## Supabase Connection String

In Supabase, use the PostgreSQL connection string from **Project Settings > Database**.

For local development, `.env` should include:

```bash
DATABASE_URL=postgresql://postgres.your-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres
```

If Supabase gives you a direct connection on port `5432`, that can also work. For many local apps, the pooler connection on port `6543` is easier.

## Local Backend

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm run dev
```

Test health endpoint:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "ok": true,
  "service": "thai-food-matchmaker",
  "phase": 10
}
```

## Phase 2 API Tests

After schema and seed are applied, test:

```bash
curl http://localhost:3000/
curl http://localhost:3000/api/tags
curl "http://localhost:3000/api/tags?category=service"
curl http://localhost:3000/api/tags/categories
curl http://localhost:3000/api/menu-dictionary
curl "http://localhost:3000/api/menu-dictionary/search?q=tom"
curl -X POST http://localhost:3000/api/menu/suggest-tags -H "Content-Type: application/json" -d "{\"menuName\":\"Tom Yum Kung\",\"language\":\"en\"}"
curl http://localhost:3000/api/restaurants
curl http://localhost:3000/api/user-preferences/10000000-0000-0000-0000-000000000001
curl -X PUT http://localhost:3000/api/user-preferences/10000000-0000-0000-0000-000000000001 -H "Content-Type: application/json" -d "{\"foodTags\":[\"local_food\",\"spicy\"],\"allergies\":[\"shrimp\"],\"transportModes\":[\"walking\",\"taxi\"],\"budgetMax\":250,\"maxDistanceKm\":8}"
curl -X POST http://localhost:3000/api/groups -H "Content-Type: application/json" -d "{\"name\":\"Chiang Mai Trip\",\"ownerUserId\":\"10000000-0000-0000-0000-000000000001\"}"
curl -X POST http://localhost:3000/api/embeddings/refresh -H "Content-Type: application/json" -d "{\"target\":\"menus\",\"language\":\"en\",\"limit\":10}"
curl -X POST http://localhost:3000/api/recommend -H "Content-Type: application/json" -d "{\"userId\":\"10000000-0000-0000-0000-000000000001\",\"currentLocation\":{\"lat\":18.7883,\"lng\":98.9853},\"query\":\"spicy local food with mountain view no pork\",\"language\":\"en\",\"transportMode\":\"taxi\",\"maxTravelMinutes\":30,\"limit\":5}"
curl -X POST http://localhost:3000/api/match-history -H "Content-Type: application/json" -d "{\"userId\":\"10000000-0000-0000-0000-000000000001\",\"restaurantId\":\"20000000-0000-0000-0000-000000000001\",\"action\":\"selected\",\"matchScore\":88}"
curl -X POST http://localhost:3000/api/reviews -H "Content-Type: application/json" -d "{\"userId\":\"10000000-0000-0000-0000-000000000001\",\"restaurantId\":\"20000000-0000-0000-0000-000000000001\",\"rating\":5,\"reviewBubbles\":[\"good_local_taste\",\"friendly_staff\"],\"comment\":\"Great local taste\"}"
curl http://localhost:3000/api/dashboard/restaurants/20000000-0000-0000-0000-000000000001
curl "http://localhost:3000/api/dashboard/restaurants/20000000-0000-0000-0000-000000000001?days=30&includeLlm=true&language=th"
curl -X PUT http://localhost:3000/api/images/menus/YOUR_MENU_ID -H "Content-Type: application/json" -d "{\"imageUrl\":\"https://example.com/menu.png\",\"imageType\":\"ai_generated\"}"
curl http://localhost:3000/api/dev/demo-ids
```

Check database connectivity separately:

```bash
curl http://localhost:3000/api/db/health
```

For Thai text on Windows PowerShell, URL-encoding the query is more reliable:

```bash
curl "http://localhost:3000/api/menu-dictionary/search?q=%E0%B8%95%E0%B9%89%E0%B8%A1%E0%B8%A2%E0%B8%B3"
```

## Phase 1 Database Tables

- `users`
- `user_preferences`
- `groups`
- `group_members`
- `restaurants`
- `menus`
- `reviews`
- `match_histories`
- `tag_catalogs`
- `menu_dictionary`

See `docs/database-schema.md` for table-by-table documentation.

## Important Design Notes

Recommendation will be menu-first:

1. Filter safe and suitable menus using allergies, dietary restrictions, budget, and distance.
2. Search menu vectors for food preference.
3. Group matching menus back into restaurants.
4. Score restaurants using view, atmosphere, service, place context, reviews, distance, and learned preferences.

AI-suggested menu allergy and dietary tags must always require restaurant confirmation before being trusted.

## Frontend Integration Quickstart

Use your deployed API base URL:

```js
const API_BASE_URL = "https://your-vercel-domain.vercel.app";
```

Get demo IDs:

```js
const demo = await fetch(`${API_BASE_URL}/api/dev/demo-ids`).then((res) => res.json());
```

Get tags:

```js
const tags = await fetch(`${API_BASE_URL}/api/tags`).then((res) => res.json());
```

Get recommendations:

```js
const recommendations = await fetch(`${API_BASE_URL}/api/recommend`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: demo.data.users[0].id,
    currentLocation: { lat: 18.7883, lng: 98.9853 },
    query: "spicy local food with mountain view no pork",
    language: "en",
    limit: 5
  })
}).then((res) => res.json());
```

## Optional Python Embedding Service

The Node backend can call a Python FastAPI service for real sentence-transformer embeddings.

See:

- `embedding_service/README.md`

If `EMBEDDING_SERVICE_URL` is not set or the service is unavailable, Node uses deterministic mock 384-dimensional embeddings.
