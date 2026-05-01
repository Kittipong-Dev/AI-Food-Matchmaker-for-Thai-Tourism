# API Specification

Base URL for local development:

```txt
http://localhost:3000
```

All responses use JSON.

Successful list responses use:

```json
{
  "data": []
}
```

Error responses use:

```json
{
  "error": {
    "message": "Human-readable message",
    "detail": {}
  }
}
```

`detail` is only intended for development/debugging.

## GET /api/health

Checks whether the backend server is running.

### Response

```json
{
  "ok": true,
  "service": "thai-food-matchmaker",
  "phase": 6
}
```

## GET /api/db/health

Checks whether the backend can connect to PostgreSQL/Supabase.

### Response

```json
{
  "ok": true,
  "databaseTime": "2026-05-01T13:27:07.408Z"
}
```

## GET /api/tags

Returns tag catalog entries.

### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `category` | string | no | Filter tags by category. |
| `includeInactive` | boolean | no | Include inactive tags when `true`. Default is `false`. |

### Example

```txt
GET /api/tags?category=service
```

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "category": "service",
      "tagKey": "english_menu_available",
      "labelTh": "มีเมนูภาษาอังกฤษ",
      "labelEn": "English menu available",
      "descriptionTh": "ร้านมีเมนูภาษาอังกฤษ",
      "descriptionEn": "Restaurant has an English menu",
      "isActive": true
    }
  ]
}
```

## GET /api/tags/categories

Returns available tag categories.

### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `includeInactive` | boolean | no | Include categories that only have inactive tags when `true`. Default is `false`. |

### Response

```json
{
  "data": [
    "allergen",
    "atmosphere",
    "dietary",
    "food",
    "ingredient",
    "place_context",
    "review_bubble",
    "service",
    "skip_reason",
    "taste",
    "transport",
    "view"
  ]
}
```

## GET /api/menu-dictionary

Returns menu dictionary entries.

### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | number | no | Max entries to return. Default `50`, max `100`. |

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "menuNameTh": "ต้มยำกุ้ง",
      "menuNameEn": "Tom Yum Kung",
      "foodTags": ["thai_food", "soup", "spicy", "seafood"],
      "tasteTags": ["spicy", "sour"],
      "ingredientTags": ["shrimp"],
      "allergenTags": ["shrimp", "seafood"],
      "dietaryTags": ["contains_seafood", "not_vegetarian"],
      "spicyLevel": 4,
      "confidence": 0.94,
      "createdAt": "2026-05-01T00:00:00.000Z"
    }
  ]
}
```

## GET /api/menu-dictionary/search

Searches menu dictionary entries by Thai or English menu name.

### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `q` | string | yes | Search text. |
| `limit` | number | no | Max entries to return. Default `50`, max `100`. |

### Example

```txt
GET /api/menu-dictionary/search?q=tom
GET /api/menu-dictionary/search?q=ต้มยำ
```

For Windows PowerShell, URL-encoding Thai queries is safer:

```txt
GET /api/menu-dictionary/search?q=%E0%B8%95%E0%B9%89%E0%B8%A1%E0%B8%A2%E0%B8%B3
```

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "menuNameTh": "ต้มยำกุ้ง",
      "menuNameEn": "Tom Yum Kung",
      "foodTags": ["thai_food", "soup", "spicy", "seafood"],
      "tasteTags": ["spicy", "sour"],
      "ingredientTags": ["shrimp"],
      "allergenTags": ["shrimp", "seafood"],
      "dietaryTags": ["contains_seafood", "not_vegetarian"],
      "spicyLevel": 4,
      "confidence": 0.94,
      "createdAt": "2026-05-01T00:00:00.000Z"
    }
  ]
}
```

## POST /api/menu/suggest-tags

Suggests menu details and bubble tags from a menu name.

Dictionary entries are used first. Unknown menu names use an LLM backend service when an API key is configured, or a mock fallback when no key is available.

All allergen and dietary suggestions require restaurant confirmation before being trusted.

### Request Body

```json
{
  "menuName": "ต้มยำกุ้ง",
  "language": "th"
}
```

### Request Fields

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `menuName` | string | yes | Thai or English menu name entered by restaurant owner. |
| `language` | string | no | Input language hint. Expected `th` or `en`. |

### Response

```json
{
  "data": {
    "nameTh": "ต้มยำกุ้ง",
    "nameEn": "Tom Yum Kung",
    "suggestedTags": {
      "foodTags": ["thai_food", "soup", "spicy", "seafood"],
      "tasteTags": ["spicy", "sour"],
      "ingredientTags": ["shrimp"],
      "allergenTags": ["shrimp", "seafood"],
      "dietaryTags": ["contains_seafood", "not_vegetarian"]
    },
    "spicyLevel": 4,
    "confidence": 0.94,
    "source": ["dictionary"],
    "requiresConfirmation": true,
    "safetyNotice": "Allergen and dietary information must be confirmed by the restaurant."
  }
}
```

### Unknown Menu Response With Mock AI

```json
{
  "data": {
    "nameTh": "เมนูตัวอย่าง",
    "nameEn": "Sample Menu",
    "suggestedTags": {
      "foodTags": ["thai_food"],
      "tasteTags": [],
      "ingredientTags": [],
      "allergenTags": [],
      "dietaryTags": []
    },
    "spicyLevel": null,
    "confidence": 0.35,
    "source": ["mock_llm"],
    "requiresConfirmation": true,
    "safetyNotice": "Allergen and dietary information must be confirmed by the restaurant."
  }
}
```

### Validation Errors

If `menuName` is missing:

```json
{
  "error": {
    "message": "menuName is required"
  }
}
```

## Frontend Notes

- Do not call LLM APIs directly from frontend JavaScript.
- Do not expose Supabase service role keys or Google Maps API keys in frontend code.
- Frontend should treat `requiresConfirmation: true` as mandatory before saving trusted allergen/dietary data.
- Display AI-generated suggestions as suggestions, not confirmed facts.

## GET /api/restaurants

Returns restaurants.

### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | number | no | Max restaurants to return. Default `50`, max `100`. |
| `includeClosed` | boolean | no | Include restaurants where `isOpen` is false. Default `false`. |

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "ownerUserId": "uuid",
      "nameTh": "ครัวบ้านสวน",
      "nameEn": "Baan Suan Kitchen",
      "storyTh": "ร้านอาหารท้องถิ่น",
      "storyEn": "A local kitchen",
      "latitude": 18.7883,
      "longitude": 98.9853,
      "addressTh": "เชียงใหม่",
      "addressEn": "Chiang Mai",
      "googleMapsUrl": "https://maps.google.com/?q=18.7883,98.9853",
      "googlePlaceId": null,
      "openingHours": [],
      "timezone": "Asia/Bangkok",
      "isOpen": true,
      "viewTags": ["mountain_view"],
      "atmosphereTags": ["quiet"],
      "serviceTags": ["english_menu_available"],
      "placeContextTags": ["local_hidden_gem"],
      "restaurantDietaryTags": ["vegetarian_friendly"],
      "priceMin": 60,
      "priceMax": 220,
      "priceCurrency": "THB",
      "imageUrl": null,
      "imageType": "placeholder",
      "menuCount": 2,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    }
  ]
}
```

## GET /api/restaurants/:id

Returns one restaurant.

### Response

```json
{
  "data": {
    "id": "uuid",
    "nameTh": "ครัวบ้านสวน",
    "nameEn": "Baan Suan Kitchen"
  }
}
```

Returns `404` when not found.

## POST /api/restaurants

Creates a restaurant.

### Request Body

```json
{
  "ownerUserId": "uuid",
  "nameTh": "ครัวบ้านสวน",
  "nameEn": "Baan Suan Kitchen",
  "storyTh": "ร้านอาหารท้องถิ่นในสวน",
  "storyEn": "A local garden kitchen",
  "latitude": 18.7883,
  "longitude": 98.9853,
  "addressTh": "เชียงใหม่",
  "addressEn": "Chiang Mai",
  "googleMapsUrl": "https://maps.google.com/?q=18.7883,98.9853",
  "googlePlaceId": null,
  "openingHours": [
    { "day": "mon", "open": "09:00", "close": "20:00" }
  ],
  "timezone": "Asia/Bangkok",
  "isOpen": true,
  "viewTags": ["mountain_view"],
  "atmosphereTags": ["quiet", "family_friendly"],
  "serviceTags": ["english_menu_available", "parking_available"],
  "placeContextTags": ["local_hidden_gem"],
  "restaurantDietaryTags": ["vegetarian_friendly"],
  "priceMin": 60,
  "priceMax": 220,
  "priceCurrency": "THB",
  "imageUrl": null,
  "imageType": "placeholder"
}
```

Required fields:

- `nameTh`
- `nameEn`

### Response

Returns `201`.

```json
{
  "data": {
    "id": "uuid",
    "nameTh": "ครัวบ้านสวน",
    "nameEn": "Baan Suan Kitchen"
  }
}
```

## PUT /api/restaurants/:id

Updates a restaurant. Fields are partial.

### Request Body

```json
{
  "serviceTags": ["english_menu_available", "card_accepted"],
  "priceMax": 250,
  "isOpen": true
}
```

Returns `404` when not found.

## GET /api/restaurants/:restaurantId/menus

Returns menus for one restaurant.

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "restaurantId": "uuid",
      "nameTh": "ต้มยำกุ้ง",
      "nameEn": "Tom Yum Kung",
      "price": 180,
      "foodTags": ["thai_food", "soup"],
      "allergenTags": ["shrimp", "seafood"],
      "confirmedByRestaurant": true
    }
  ]
}
```

## POST /api/restaurants/:restaurantId/menus

Creates a menu for one restaurant.

### Request Body

```json
{
  "nameTh": "ต้มยำกุ้ง",
  "nameEn": "Tom Yum Kung",
  "descriptionTh": "ต้มยำกุ้งน้ำใส",
  "descriptionEn": "Clear spicy and sour shrimp soup",
  "price": 180,
  "foodTags": ["thai_food", "soup", "spicy", "seafood"],
  "tasteTags": ["spicy", "sour"],
  "ingredientTags": ["shrimp"],
  "allergenTags": ["shrimp", "seafood"],
  "dietaryTags": ["contains_seafood", "not_vegetarian"],
  "spicyLevel": 4,
  "imageUrl": null,
  "imageType": "placeholder",
  "aiSuggested": true,
  "confirmedByRestaurant": true
}
```

Required fields:

- `nameTh`
- `nameEn`

## GET /api/menus/:id

Returns one menu.

Returns `404` when not found.

## PUT /api/menus/:id

Updates one menu. Fields are partial.

### Request Body

```json
{
  "price": 190,
  "confirmedByRestaurant": true,
  "imageUrl": "https://storage.example/menu.jpg",
  "imageType": "real"
}
```

## POST /api/embeddings/refresh

Refreshes menu and/or restaurant embeddings.

The Node backend:

1. Loads rows from PostgreSQL.
2. Builds Thai and/or English embedding text.
3. Calls the Python embedding service at `EMBEDDING_SERVICE_URL` when available.
4. Falls back to deterministic mock embeddings when the Python service is unavailable.
5. Saves vectors into pgvector columns.

### Request Body

```json
{
  "target": "menus",
  "language": "en",
  "limit": 100
}
```

## POST /api/recommend

Returns menu-first restaurant recommendations.

The recommendation engine:

1. Loads the user's saved preferences.
2. If `groupId` is provided, merges group member constraints.
3. Applies hard filters at menu level first.
4. Searches menu embeddings using pgvector.
5. Groups safe matching menus back into restaurants.
6. Adds restaurant-level scoring from distance, restaurant embeddings, and tag matches.

### Request Body

```json
{
  "userId": "10000000-0000-0000-0000-000000000001",
  "groupId": null,
  "currentLocation": {
    "lat": 18.7883,
    "lng": 98.9853
  },
  "query": "spicy local food with mountain view no pork",
  "language": "en",
  "limit": 5
}
```

### Request Fields

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `userId` | string | yes | User ID used to load saved preferences. |
| `groupId` | string | no | Optional group ID. Group member hard constraints are merged. |
| `currentLocation` | object | no | `{ "lat": number, "lng": number }`. Used with PostGIS distance filters. |
| `query` | string | no | Free-text preference query. If missing, saved preference tags are used. |
| `language` | string | no | `en` or `th`. Chooses `embedding_en` or `embedding_th`. Default `en`. |
| `limit` | number | no | Max recommendations. Default `10`, max `50`. |
| `allergies` | string[] | no | Temporary request-level allergy overrides/additions. |
| `dietaryRestrictions` | string[] | no | Temporary request-level restrictions such as `no_pork`, `no_beef`, `vegetarian`, `vegan`, `halal_required`. |
| `budgetMax` | number | no | Temporary max budget override. |
| `maxDistanceKm` | number | no | Temporary distance override. |
| `foodTags` | string[] | no | Temporary food preference tags. |
| `viewTags` | string[] | no | Temporary view preference tags. |
| `atmosphereTags` | string[] | no | Temporary atmosphere preference tags. |
| `serviceTags` | string[] | no | Temporary service preference tags. |
| `placeContextTags` | string[] | no | Temporary place-context preference tags. |

### Response

```json
{
  "query": "spicy local food with mountain view no pork",
  "language": "en",
  "embeddingProvider": "service",
  "warnings": [],
  "data": [
    {
      "restaurantId": "20000000-0000-0000-0000-000000000001",
      "restaurantName": "Baan Suan Kitchen",
      "restaurantNameTh": "ครัวบ้านสวน",
      "restaurantNameEn": "Baan Suan Kitchen",
      "googleMapsUrl": "https://maps.google.com/?q=18.7883,98.9853",
      "distanceKm": 0,
      "score": 60,
      "reasons": [
        "Found 1 confirmed matching menu.",
        "Menu descriptions match the food preference query.",
        "About 0.0 km from current location."
      ],
      "recommendedMenus": [
        {
          "menuId": "uuid",
          "nameTh": "แกงเห็ดรวม",
          "nameEn": "Mixed Mushroom Curry",
          "price": 120,
          "reason": "Confirmed menu that matches the query and hard constraints."
        }
      ],
      "warnings": [
        "Allergen and dietary information should still be confirmed with the restaurant."
      ],
      "scoreBreakdown": {
        "bestMenuSimilarity": 0.4658,
        "restaurantSimilarity": 0.4472,
        "matchingMenuCount": 1,
        "distanceKm": 0,
        "tagMatches": {
          "view": 1,
          "atmosphere": 1,
          "service": 1,
          "placeContext": 2
        }
      }
    }
  ]
}
```

### Current MVP Limitations

- Transport scoring still uses straight-line PostGIS distance, not Google Maps route time.
- Match history is not saved yet. That is Phase 7.
- Learned preferences are loaded but not deeply scored yet.
- Recommendation explanations are simple rule-based strings.

### Request Fields

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `target` | string | no | `all`, `menus`, or `restaurants`. Default `all`. |
| `language` | string | no | `both`, `th`, or `en`. Default `both`. |
| `limit` | number | no | Max rows per target. Default `100`, max `500`. |

### Response

```json
{
  "data": {
    "target": "menus",
    "language": "en",
    "limit": 100,
    "results": {
      "menus": {
        "en": {
          "updated": 12,
          "provider": "service",
          "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
          "dimension": 384
        }
      }
    }
  }
}
```

When the Python service is unavailable:

```json
{
  "data": {
    "target": "menus",
    "language": "en",
    "limit": 10,
    "results": {
      "menus": {
        "en": {
          "updated": 10,
          "provider": "mock_fallback",
          "model": "deterministic-mock-384",
          "dimension": 384,
          "warning": "fetch failed"
        }
      }
    }
  }
}
```
