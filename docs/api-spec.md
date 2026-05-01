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

## GET /

Friendly API landing response.

### Response

```json
{
  "service": "thai-food-matchmaker",
  "status": "ok",
  "phase": 10,
  "docs": {
      "health": "/api/health",
      "tags": "/api/tags",
      "recommend": "/api/recommend",
      "userPreferences": "/api/user-preferences/:userId",
      "groups": "/api/groups",
      "demoIds": "/api/dev/demo-ids"
  }
}
```

## GET /api/health

Checks whether the backend server is running.

### Response

```json
{
  "ok": true,
  "service": "thai-food-matchmaker",
  "phase": 10
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

Dictionary entries are used first. Unknown menu names use an LLM backend service when an API key is configured, or a mock fallback when no key is available. Supported providers are OpenRouter (`LLM_PROVIDER=openrouter`) and OpenAI (`LLM_PROVIDER=openai`).

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

## GET /api/user-preferences/:userId

Returns one user's personalization profile.

## PUT /api/user-preferences/:userId

Creates or updates one user's personalization profile. Fields are partial on update.

### Request Body

```json
{
  "foodTags": ["local_food", "spicy"],
  "viewTags": ["mountain_view"],
  "atmosphereTags": ["quiet"],
  "serviceTags": ["english_menu_available"],
  "placeContextTags": ["local_hidden_gem"],
  "dietaryRestrictions": ["no_pork"],
  "allergies": ["shrimp"],
  "transportModes": ["walking", "taxi"],
  "budgetMin": 50,
  "budgetMax": 250,
  "maxDistanceKm": 8,
  "learnedPreferences": {}
}
```

### OpenRouter Setup

For a free-model demo provider:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=openrouter/free
```

`openrouter/free` may route to different free models over time. The backend requests structured-output-capable providers and enables OpenRouter response healing, but if OpenRouter is unavailable, rate-limited, or still returns invalid JSON, the API returns mock fallback suggestions instead of failing the demo flow.

## GET /api/groups

Lists groups. Pass `userId` to return only groups owned by or joined by that user.

## POST /api/groups

Creates a group and automatically adds the owner as a group member.

```json
{
  "name": "Chiang Mai Trip",
  "ownerUserId": "10000000-0000-0000-0000-000000000001"
}
```

## GET /api/groups/:groupId

Returns one group.

## PUT /api/groups/:groupId

Updates group metadata.

## GET /api/groups/:groupId/members

Returns group members with basic user profile data.

## POST /api/groups/:groupId/members

Adds or updates a member.

```json
{
  "userId": "10000000-0000-0000-0000-000000000001",
  "role": "member"
}
```

## DELETE /api/groups/:groupId/members/:userId

Removes a group member.

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
7. If Google Maps is configured, adjusts score with route travel time.

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
  "transportMode": "taxi",
  "maxTravelMinutes": 30,
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
| `transportMode` | string | no | Route mode such as `walking`, `driving`, `taxi`, `motorbike`, or `public_transit`. |
| `transportModes` | string[] | no | Allowed/preferred modes. First value is used when `transportMode` is missing. |
| `maxTravelMinutes` | number | no | Optional route-time target. Requires `TRANSPORT_DISTANCE_PROVIDER=google` or `serpapi` to affect scoring. |

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
      "location": {
        "lat": 18.7883,
        "lng": 98.9853
      },
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
      "transport": {
        "provider": "serpapi_google_maps",
        "mode": "taxi",
        "durationSeconds": 720,
        "durationMinutes": 12,
        "distanceMeters": 5300,
        "distanceKm": 5.3
      },
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
        },
        "transport": {
          "mode": "taxi",
          "durationMinutes": 12,
          "distanceKm": 5.3,
          "score": 6,
          "penalty": 0
        }
      }
    }
  ]
}
```

### Current MVP Limitations

- Route-time scoring requires either `SERPAPI_API_KEY` with `TRANSPORT_DISTANCE_PROVIDER=serpapi`, or `GOOGLE_MAPS_API_KEY` with `TRANSPORT_DISTANCE_PROVIDER=google`.
- If the origin and destination are the same/very close, the API returns a `same_or_nearby_location` estimate with `0` minutes.
- If SerpApi calls Google Maps but Google returns no route, the API returns `serpapi_google_maps_fallback` with a straight-line time estimate and `sourceWarning`.
- Learned preferences are loaded but not deeply scored yet.
- Recommendation explanations are simple rule-based strings.

## POST /api/match-history

Saves a viewed/selected/skipped recommendation event and updates learned preferences.

### Request Body

```json
{
  "userId": "10000000-0000-0000-0000-000000000001",
  "groupId": null,
  "restaurantId": "20000000-0000-0000-0000-000000000001",
  "action": "selected",
  "rejectReasons": [],
  "matchScore": 88,
  "queryContext": {
    "query": "spicy local food no pork"
  },
  "scoreBreakdown": {
    "bestMenuSimilarity": 0.82,
    "distanceKm": 2.1
  }
}
```

### Request Fields

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `userId` | string | yes | User creating the action. |
| `groupId` | string/null | no | Optional group context. |
| `restaurantId` | string | yes | Restaurant shown/selected/skipped. |
| `action` | string | yes | `viewed`, `selected`, or `skipped`. |
| `rejectReasons` | string[] | no | Skip reasons such as `too_far`, `too_expensive`, `not_safe_allergy`. |
| `matchScore` | number | no | Score from recommendation result, 0 to 100. |
| `queryContext` | object | no | Snapshot of query/user context. |
| `scoreBreakdown` | object | no | Snapshot of score components. |

### Response

Returns `201`.

```json
{
  "data": {
    "matchHistory": {
      "id": "uuid",
      "userId": "10000000-0000-0000-0000-000000000001",
      "groupId": null,
      "restaurantId": "20000000-0000-0000-0000-000000000001",
      "action": "selected",
      "rejectReasons": [],
      "matchScore": 88,
      "queryContext": {
        "query": "spicy local food no pork"
      },
      "scoreBreakdown": {
        "bestMenuSimilarity": 0.82
      },
      "createdAt": "2026-05-01T00:00:00.000Z"
    },
    "learnedPreferences": {
      "actionCounts": {
        "selected": 1
      },
      "skipReasonCounts": {},
      "selectedTagWeights": {
        "local_hidden_gem": 1,
        "quiet": 1
      },
      "skippedTagWeights": {},
      "distanceSensitivity": 1,
      "priceSensitivity": 1
    }
  }
}
```

### Learner MVP Rules

- `selected` increases weights for restaurant view, atmosphere, service, place-context, and restaurant dietary tags.
- `skipped` increases skipped tag weights.
- `skipped` with `too_far` increases `distanceSensitivity`.
- `skipped` with `too_expensive` increases `priceSensitivity`.

## POST /api/reviews

Saves a tourist review after visiting a restaurant.

### Request Body

```json
{
  "userId": "10000000-0000-0000-0000-000000000001",
  "restaurantId": "20000000-0000-0000-0000-000000000001",
  "rating": 5,
  "reviewBubbles": ["good_local_taste", "friendly_staff"],
  "comment": "Great local taste"
}
```

### Request Fields

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `userId` | string | yes | Reviewer user ID. |
| `restaurantId` | string | yes | Reviewed restaurant ID. |
| `rating` | number | no | Integer from 1 to 5. |
| `reviewBubbles` | string[] | no | Review bubble tags. |
| `comment` | string | no | Optional free-text comment. |

### Response

Returns `201`.

```json
{
  "data": {
    "id": "uuid",
    "userId": "10000000-0000-0000-0000-000000000001",
    "restaurantId": "20000000-0000-0000-0000-000000000001",
    "rating": 5,
    "reviewBubbles": ["good_local_taste", "friendly_staff"],
    "comment": "Great local taste",
    "createdAt": "2026-05-01T00:00:00.000Z"
  }
}
```

## GET /api/reviews/restaurant/:restaurantId

Returns recent reviews for a restaurant.

### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | number | no | Default `50`, max `100`. |

## GET /api/dashboard/restaurants/:restaurantId

Returns dashboard insight data for restaurant owners.

This endpoint aggregates real data from:

- `match_histories`
- `reviews`
- `menus`
- `restaurants`
- `users`

It also returns `llmInsight` when `includeLlm` is not `false`. The LLM summary uses OpenRouter/OpenAI when configured and falls back to a local rule-based mock summary when keys are missing or the provider fails.

### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `days` | number | no | Lookback window. Default `30`, max `365`. |
| `includeLlm` | boolean | no | Include LLM business insight. Default `true`; set `false` to skip provider calls. |
| `language` | string | no | LLM insight language. `th` or `en`. Default `th` for Thai restaurant owners. |

### Response

```json
{
  "data": {
    "restaurantId": "20000000-0000-0000-0000-000000000001",
    "restaurantNameTh": "ครัวบ้านสวน",
    "restaurantNameEn": "Baan Suan Kitchen",
    "periodDays": 30,
    "insightLanguage": "th",
    "latestDataAt": "2026-05-01T00:00:00.000Z",
    "funnel": {
      "impressions": 1240,
      "selected": 482,
      "reviews": 156,
      "skipped": 128,
      "selectionRate": 38
    },
    "aiInsight": {
      "type": "risk",
      "title": "AI Insight",
      "message": "Your restaurant is getting attention, but recent skip events mention allergy or safety concerns."
    },
    "llmInsight": {
      "provider": "openrouter",
      "generatedAt": "2026-05-01T00:00:00.000Z",
      "summary": "นักท่องเที่ยวชอบรสชาติท้องถิ่นของร้าน แต่ความชัดเจนเรื่องแพ้อาหารและการเดินทางยังอาจทำให้ลูกค้าบางส่วนลังเล",
      "whatToImprove": [
        "ยืนยันแท็กสารก่อภูมิแพ้ในเมนูที่ยังรอตรวจสอบ",
        "เพิ่มคำอธิบายเมนูภาษาอังกฤษให้ชัดเจนขึ้น"
      ],
      "priorityActions": [
        "ยืนยันส่วนผสมและแท็กแพ้อาหารของเมนูที่มีความเสี่ยงสูง",
        "เพิ่มข้อมูลการเดินทางและที่จอดรถในโปรไฟล์ร้าน"
      ],
      "riskFlags": [
        "ข้อมูลแพ้อาหารที่ยังไม่ยืนยันอาจทำให้นักท่องเที่ยวปัดข้าม"
      ],
      "opportunities": [
        "นำจุดเด่นเรื่องรสชาติท้องถิ่นและรีวิวเชิงบวกไปใช้โปรโมต"
      ],
      "confidence": 0.74
    },
    "sections": {
      "menu": {
        "title": "Menu health",
        "items": [
          {
            "menuId": "uuid",
            "nameTh": "ต้มยำกุ้งแม่น้ำ",
            "nameEn": "River Prawn Tom Yum",
            "status": "allergen_visible",
            "severity": "info",
            "title": "Allergen information visible",
            "message": "This menu lists allergen tags: shrimp, seafood."
          }
        ]
      },
      "context": {
        "topTalkedAbout": [
          {
            "tag": "good_local_taste",
            "count": 24
          }
        ],
        "storySync": "Tourist perception is broadly aligned with your current restaurant tags."
      },
      "opportunity": {
        "type": "menu_translation",
        "title": "Translation opportunity",
        "message": "Add clearer English menu descriptions and allergy notes to increase tourist confidence.",
        "actionLabel": "Improve menu descriptions"
      }
    },
    "reviewSummary": {
      "averageRating": 4.7,
      "reviewBubbleCounts": {
        "good_local_taste": 24
      },
      "topReviewBubbles": [
        {
          "key": "good_local_taste",
          "count": 24
        }
      ]
    },
    "skipSummary": {
      "skipReasonCounts": {
        "too_far": 3
      },
      "topSkipReasons": [
        {
          "key": "too_far",
          "count": 3
        }
      ]
    },
    "touristMix": [
      {
        "nationality": "Japan",
        "count": 28,
        "percentage": 28
      }
    ]
  }
}
```

### Dashboard Field Mapping

- `funnel.impressions` = restaurant `viewed` events.
- `funnel.selected` = restaurant `selected` events.
- `funnel.reviews` = reviews in the selected period.
- `aiInsight` = rule-based business insight.
- `sections.menu` = menu health and confirmation/allergen issues.
- `sections.context` = review bubble perception and story sync.
- `sections.opportunity` = tourist segment or translation opportunity.
- `touristMix` = nationality mix from users who created match history events.

## PUT /api/images/restaurants/:restaurantId

Updates restaurant image metadata.

This endpoint stores image URL/type only. Actual upload can be handled by Supabase Storage, Cloudinary, S3, or another provider.

### Request Body

```json
{
  "imageUrl": "https://storage.example/restaurants/photo.jpg",
  "imageType": "real"
}
```

### Image Types

Allowed `imageType` values:

- `real`
- `ai_generated`
- `placeholder`

### Response

```json
{
  "data": {
    "target": "restaurant",
    "id": "20000000-0000-0000-0000-000000000001",
    "imageUrl": "https://storage.example/restaurants/photo.jpg",
    "imageType": "real",
    "label": null
  }
}
```

## PUT /api/images/menus/:menuId

Updates menu image metadata.

### Request Body

```json
{
  "imageUrl": "https://storage.example/menus/tom-yum-illustration.png",
  "imageType": "ai_generated"
}
```

### Response

```json
{
  "data": {
    "target": "menu",
    "id": "uuid",
    "imageUrl": "https://storage.example/menus/tom-yum-illustration.png",
    "imageType": "ai_generated",
    "label": "AI-generated illustration, not actual photo"
  }
}
```

Frontend must display the `label` whenever it is not null.

## GET /api/dev/demo-ids

Returns a small set of demo IDs for frontend testing.

### Response

```json
{
  "data": {
    "users": [
      {
        "id": "10000000-0000-0000-0000-000000000001",
        "name": "Demo Tourist",
        "language": "en",
        "nationality": "United States"
      }
    ],
    "restaurants": [
      {
        "id": "20000000-0000-0000-0000-000000000001",
        "nameTh": "ครัวบ้านสวน",
        "nameEn": "Baan Suan Kitchen"
      }
    ],
    "menus": [
      {
        "id": "uuid",
        "restaurantId": "20000000-0000-0000-0000-000000000001",
        "nameTh": "แกงเห็ดรวม",
        "nameEn": "Mixed Mushroom Curry"
      }
    ]
  }
}
```

This endpoint is for demo/prototype integration only.

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
