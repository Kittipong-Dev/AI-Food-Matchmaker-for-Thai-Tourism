# Recommender Notebook Review

Reviewed file:

- `Testing_Model.ipynb`

## Summary

The notebook is useful and matches the project direction. It should not be copied directly into the app because it is Colab/Python experiment code, but its core ideas should be ported into backend services.

It overlaps with:

- Phase 5: embedding generation and saving `embedding_th` / `embedding_en`.
- Phase 6: menu-first recommendation SQL and scoring.

It does not meaningfully overlap with Phase 4 CRUD. The notebook has bulk insert helpers for mock data, but our Phase 4 CRUD APIs are still needed for the real frontend.

## What To Reuse

### Embedding Model

The notebook uses:

```txt
sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
```

This model outputs `384` dimensions, which matches our schema:

- `restaurants.embedding_th vector(384)`
- `restaurants.embedding_en vector(384)`
- `menus.embedding_th vector(384)`
- `menus.embedding_en vector(384)`

This is compatible with our database design.

### Menu-First Recommendation

The notebook correctly starts from safe menu matches, then groups menus back into restaurants.

This matches our core rule:

1. Filter safe menus first.
2. Match menus semantically.
3. Group matching menus into restaurants.
4. Add restaurant-level scoring.

### PostGIS Distance Filtering

The notebook uses:

```sql
ST_DWithin(...)
ST_Distance(...)
```

This fits our `restaurants.location geography(Point, 4326)` field.

### Safety Gate

The notebook filters:

```sql
m.confirmed_by_restaurant = true
```

This is good. Allergy and dietary filters should only trust confirmed menu data.

## What Needs Fixing Before Integration

### 1. Do Not Keep Notebook Bulk Insert As App Logic

The notebook inserts mock data with generic helpers.

This should not become production backend code because:

- it is Colab-oriented
- it uses Python/SQLAlchemy
- it depends on a local zip file
- it is intended for test data, not frontend CRUD

Our existing CRUD APIs should remain the app write path.

### 2. Add App-Level Embedding Text Builders

The notebook reads prebuilt fields:

- `embedding_text_th`
- `embedding_text_en`

Those fields do not exist in our database, and they should not be stored as required columns.

Instead, Phase 5 should generate embedding text from current restaurant/menu columns.

Menu embedding text should include:

- name
- description
- food tags
- taste tags
- ingredient tags
- allergen tags
- dietary tags
- spicy level
- price

Restaurant embedding text should include:

- name
- story
- view tags
- atmosphere tags
- service tags
- place context tags
- restaurant dietary tags
- price range
- address/location context

### 3. Port Python Embedding To Backend Service Boundary

The notebook uses Python `sentence-transformers`.

Our backend is Node/Express, so we should not directly paste notebook code into `src/`.

Recommended Phase 5 options:

1. Use an embedding API behind `embeddingClient`.
2. Use mock deterministic embeddings when no key is configured.
3. Optionally add a separate Python embedding worker later if the team wants local `sentence-transformers`.

For the MVP, option 1 + option 2 is safest.

### 4. Fix Thai Query Comparison

In `compare_vector_vs_tag_search`, the notebook always searches:

```sql
embedding_en
```

Even the Thai query test uses English embeddings.

Fix:

- use `embedding_th` when `language = "th"`
- use `embedding_en` when `language = "en"`

### 5. Expand Hard Dietary Rules

The notebook handles:

- no pork
- vegetarian
- halal required
- allergies

But our constraints also mention:

- no beef
- vegan
- strict halal

Phase 6 should add:

```txt
no_beef -> exclude menus with contains_beef
vegan -> require vegan_possible or vegan-friendly logic
halal_required -> require restaurant halal_certified tag and exclude unsafe menu tags
```

### 6. Improve Budget Handling

Notebook condition:

```sql
m.price <= :budget_max
```

This excludes menus where price is unknown.

Recommended MVP behavior:

```sql
(m.price is null or m.price <= :budget_max)
```

If menu price is null, use restaurant `price_max` as fallback.

### 7. Return Menu IDs And Reasons

Notebook returns menu names in:

```sql
ARRAY_AGG(s.menu_name_en ...)
```

The API should return structured recommended menus:

```json
{
  "menuId": "uuid",
  "nameTh": "แกงเห็ดรวม",
  "nameEn": "Mixed Mushroom Curry",
  "reason": "Matches local spicy preference and avoids pork"
}
```

This is needed for frontend display and match history explanations.

### 8. Add Restaurant Vector Scoring

The notebook mainly uses menu vector similarity plus restaurant tags.

Our target architecture also has restaurant vector search for:

- view
- atmosphere
- hidden gem feeling
- quiet
- mountain/river/sea view
- local story

Phase 6 should combine:

- menu vector score
- restaurant vector score
- tag overlap score
- distance/transport score
- learned preference score

### 9. Normalize Score Output

The notebook score is roughly 0-100, but it should be clamped and rounded before returning from the API.

Recommended:

```txt
score = round(greatest(0, least(100, raw_score)))
```

### 10. Transport Is Not Integrated Yet

The notebook uses straight-line PostGIS distance.

That is fine for MVP filtering, but it does not calculate:

- walking time
- driving time
- taxi route time
- public transit time

Google Maps route calculation should be added later behind a backend `transportService`.

## Recommended Integration Path

### Phase 5 Integration

Create:

- `src/services/embedding/embeddingTextBuilder.js`
- `src/services/embedding/mockEmbeddingClient.js`
- `src/services/embedding/embeddingClient.js`
- `src/services/embedding/embeddingService.js`
- `src/routes/embeddings.js`
- `embedding_service/main.py`

Add APIs/scripts:

- `POST /api/embeddings/refresh`
- refresh restaurant embeddings
- refresh menu embeddings

Use the Python FastAPI embedding service when `EMBEDDING_SERVICE_URL` is configured. Use mock embeddings if the Python service is not configured or unavailable.

### Phase 6 Integration

Create:

- `src/services/recommendationService.js`
- `src/routes/recommendations.js`

Add API:

- `POST /api/recommend`

Port the notebook SQL into Node/PostgreSQL with these changes:

- parameterized `pg` query syntax
- language-aware `embedding_th` / `embedding_en`
- menu-first filtering
- structured recommended menu objects
- no pork / no beef / vegetarian / vegan / halal filters
- restaurant vector scoring
- score breakdown JSON
- warnings for allergy confirmation

## Verdict

The notebook is a good prototype for Phase 5 and Phase 6.

Do not merge it as-is.

Reuse:

- 384-dimensional multilingual embedding choice
- menu-first SQL structure
- PostGIS distance logic
- confirmed menu safety gate

Fix before production integration:

- language-specific vector column selection
- hard dietary filters
- budget fallback behavior
- structured recommendation output
- restaurant vector scoring
- backend service/API shape
