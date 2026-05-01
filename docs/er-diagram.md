# ER Diagram

This diagram reflects the Phase 1 PostgreSQL/Supabase schema.

```mermaid
erDiagram
  USERS {
    uuid id PK
    text name
    text language
    text nationality
    timestamptz created_at
  }

  USER_PREFERENCES {
    uuid id PK
    uuid user_id FK
    text_array food_tags
    text_array view_tags
    text_array atmosphere_tags
    text_array service_tags
    text_array place_context_tags
    text_array dietary_restrictions
    text_array allergies
    text_array transport_modes
    numeric budget_min
    numeric budget_max
    numeric max_distance_km
    jsonb learned_preferences
    timestamptz created_at
    timestamptz updated_at
  }

  GROUPS {
    uuid id PK
    text name
    uuid owner_user_id FK
    timestamptz created_at
  }

  GROUP_MEMBERS {
    uuid group_id PK, FK
    uuid user_id PK, FK
    text role
  }

  RESTAURANTS {
    uuid id PK
    uuid owner_user_id FK
    text name_th
    text name_en
    text story_th
    text story_en
    numeric latitude
    numeric longitude
    geography location
    text address_th
    text address_en
    text google_maps_url
    text google_place_id
    jsonb opening_hours
    text timezone
    boolean is_open
    text_array view_tags
    text_array atmosphere_tags
    text_array service_tags
    text_array place_context_tags
    text_array restaurant_dietary_tags
    numeric price_min
    numeric price_max
    text price_currency
    text image_url
    text image_type
    vector embedding_th
    vector embedding_en
    timestamptz created_at
    timestamptz updated_at
  }

  MENUS {
    uuid id PK
    uuid restaurant_id FK
    text name_th
    text name_en
    text description_th
    text description_en
    numeric price
    text_array food_tags
    text_array taste_tags
    text_array ingredient_tags
    text_array allergen_tags
    text_array dietary_tags
    int spicy_level
    text image_url
    text image_type
    boolean ai_suggested
    boolean confirmed_by_restaurant
    vector embedding_th
    vector embedding_en
    timestamptz created_at
    timestamptz updated_at
  }

  REVIEWS {
    uuid id PK
    uuid user_id FK
    uuid restaurant_id FK
    int rating
    text_array review_bubbles
    text comment
    timestamptz created_at
  }

  MATCH_HISTORIES {
    uuid id PK
    uuid user_id FK
    uuid group_id FK
    uuid restaurant_id FK
    text action
    text_array reject_reasons
    numeric match_score
    jsonb query_context
    jsonb score_breakdown
    timestamptz created_at
  }

  TAG_CATALOGS {
    uuid id PK
    text category
    text tag_key
    text label_th
    text label_en
    text description_th
    text description_en
    boolean is_active
  }

  MENU_DICTIONARY {
    uuid id PK
    text menu_name_th
    text menu_name_en
    text_array food_tags
    text_array taste_tags
    text_array ingredient_tags
    text_array allergen_tags
    text_array dietary_tags
    int spicy_level
    numeric confidence
    timestamptz created_at
  }

  USERS ||--|| USER_PREFERENCES : "has preferences"
  USERS ||--o{ GROUPS : "owns groups"
  USERS ||--o{ GROUP_MEMBERS : "joins groups"
  GROUPS ||--o{ GROUP_MEMBERS : "has members"

  USERS ||--o{ RESTAURANTS : "owns restaurants"
  RESTAURANTS ||--o{ MENUS : "has menus"

  USERS ||--o{ REVIEWS : "writes reviews"
  RESTAURANTS ||--o{ REVIEWS : "receives reviews"

  USERS ||--o{ MATCH_HISTORIES : "creates match events"
  GROUPS ||--o{ MATCH_HISTORIES : "optional group context"
  RESTAURANTS ||--o{ MATCH_HISTORIES : "is recommended"
```

## Notes

- `tag_catalogs` is a controlled tag dictionary. Other tables store tag keys in `text[]` fields.
- `menu_dictionary` is used by the menu tag suggestion service. It does not directly reference `menus`.
- `restaurants.location` is a PostGIS `geography(Point, 4326)` field for distance filtering.
- `restaurants.embedding_th`, `restaurants.embedding_en`, `menus.embedding_th`, and `menus.embedding_en` are `vector(384)`.
- Recommendation should start from `menus`, then group safe matching menus back into `restaurants`.
