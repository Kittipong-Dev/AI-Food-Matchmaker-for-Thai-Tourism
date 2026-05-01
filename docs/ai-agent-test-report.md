# AI Agent Test Report

Date: 2026-05-01

Target tested:

- Local backend: `http://localhost:3120`
- Database: configured Supabase PostgreSQL
- Current backend phase: 10

## Result

Overall result: **PASS**

Summary:

```txt
Passed: 18
Failed: 0
```

The test created temporary user, restaurant, menu, match-history, and review data, then cleaned up the temporary user and restaurant. Restaurant deletion cascaded temporary menus, reviews, and match history.

## Checklist

| Area | Endpoint / Flow | Result | Notes |
| --- | --- | --- | --- |
| API landing | `GET /` | Pass | Returned service status and docs links. |
| Health | `GET /api/health` | Pass | Returned phase `10`. |
| Database | `GET /api/db/health` | Pass | Connected to Supabase and returned database time. |
| Tags | `GET /api/tags?category=service` | Pass | Returned 10 service tags. |
| Tag categories | `GET /api/tags/categories` | Pass | Returned 12 categories. |
| Menu dictionary | `GET /api/menu-dictionary/search?q=tom` | Pass | Found `Tom Yum Kung`. |
| Menu suggestion | `POST /api/menu/suggest-tags` dictionary path | Pass | Returned source `dictionary`. |
| Menu suggestion | `POST /api/menu/suggest-tags` mock path | Pass | Returned source `mock_llm` for unknown menu. |
| Restaurant CRUD | `POST /api/restaurants` | Pass | Created temporary restaurant. |
| Restaurant CRUD | `GET` / `PUT /api/restaurants/:id` | Pass | Read and updated temporary restaurant. |
| Menu CRUD | `POST /api/restaurants/:id/menus` | Pass | Created temporary confirmed menu. |
| Menu CRUD | `GET` / `PUT /api/menus/:id` | Pass | Read and updated temporary menu price. |
| Image metadata | `PUT /api/images/menus/:id` | Pass | Returned required AI-generated image label. |
| Embeddings | `POST /api/embeddings/refresh` | Pass | Refreshed menu and restaurant embeddings. Provider returned `service`. |
| Recommendation | `POST /api/recommend` | Pass | Returned menu-first recommendations and included the temporary restaurant. |
| Match history | `POST /api/match-history` | Pass | Saved action and updated learned preferences. |
| Reviews | `POST /api/reviews` and `GET /api/reviews/restaurant/:id` | Pass | Saved and listed review. |
| Dashboard | `GET /api/dashboard/restaurants/:id` | Pass | Returned funnel, review summary, AI insight, and dashboard sections. |
| Demo IDs | `GET /api/dev/demo-ids` | Pass | Returned users, restaurants, and menus for frontend testing. |

## Detailed Observations

### Embedding Refresh

The embedding refresh test returned provider `service`, meaning the backend reached the configured Python embedding service instead of using mock fallback.

This confirms:

- Node can call the embedding service.
- The embedding service returns 384-dimensional vectors.
- Vectors can be saved to Supabase pgvector columns.

### Recommendation

The recommendation test created a temporary safe menu:

- spicy mushroom curry
- no pork
- vegetarian possible
- confirmed by restaurant

The recommendation API returned results and included the temporary restaurant. This confirms the menu-first recommendation flow is working:

1. filter safe confirmed menus
2. search menu embeddings
3. group menus back into restaurants
4. apply restaurant-level scoring

### Match History And Learner

The match-history test saved a `selected` event and updated `learned_preferences`.

This confirms the MVP rule-based learner is connected end to end.

### Dashboard

The dashboard test returned:

- funnel data
- AI insight
- menu health
- context/story sync
- opportunity card
- review summary
- tourist mix

This matches the current business-advisor dashboard direction.

## Cleanup

Temporary data cleanup completed:

- temporary restaurant deleted
- temporary user deleted

Because of database cascade rules, this also removed temporary:

- menus
- match histories
- reviews
- user preferences

One non-destructive side effect remains:

- `/api/embeddings/refresh` refreshed embeddings for up to 5 recent menu and restaurant rows.

This is acceptable because embeddings are derived data and the service provider was the real embedding service.

## Remaining Risks

### Authentication And Authorization

Current API has no production auth yet.

Before production release:

- require user/session auth
- restrict restaurant owner write access
- restrict dashboard access to restaurant owners
- protect `/api/dev/demo-ids` or disable it outside demo environments

### Transport Scoring

Recommendation currently uses PostGIS straight-line distance.

Google Maps route travel time is not integrated yet.

### LLM Provider

Menu suggestion unknown-path currently uses mock fallback unless a real LLM provider is implemented in `llmClient`.

### Dashboard AI

Dashboard insight is MVP rule-based, not a real LLM summary yet.

This is good for demo stability, but can be upgraded later.

### Vercel Environment

This report tested the local backend against Supabase. After deploying the latest commit, run a smaller smoke test against Vercel:

```bash
curl https://your-vercel-domain.vercel.app/
curl https://your-vercel-domain.vercel.app/api/health
curl https://your-vercel-domain.vercel.app/api/db/health
curl https://your-vercel-domain.vercel.app/api/dev/demo-ids
curl https://your-vercel-domain.vercel.app/api/tags
```

## Verdict

The backend is ready for frontend collaborator integration and Vercel redeployment.

Recommended next action:

1. Commit current backend changes.
2. Push branch.
3. Redeploy Vercel.
4. Run the Vercel smoke tests above.
