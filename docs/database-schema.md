# Database Schema Handoff

This document explains the Phase 1 PostgreSQL/Supabase schema for the AI Local Food Matchmaker for Thai Tourism.

Main SQL files:

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/seed.sql`

## Core Design

The recommendation system is menu-first.

1. Filter menus by allergies, dietary restrictions, budget, and menu-level safety.
2. Match menu embeddings against food preferences.
3. Group safe matching menus back into restaurants.
4. Score restaurants by atmosphere, view, location, opening status, transport distance/time, reviews, and learned preferences.

Restaurant-level data should not be used to remove a whole restaurant when only some menus are unsafe. For example, if one menu contains shrimp, the restaurant may still be recommended with safe non-shrimp menus.

## Extensions

The schema uses:

- `pgcrypto` for UUID generation.
- `vector` for pgvector embeddings.
- `postgis` for geospatial restaurant location and distance queries.

Vector dimensions are `384`.

Restaurant and menu embeddings are separated by language:

- `embedding_th vector(384)`
- `embedding_en vector(384)`

This supports different Thai and English vector spaces.

## Transport And Google Maps

PostGIS is used for fast geospatial filtering:

- nearest restaurants
- restaurants within max distance
- straight-line distance

Google Maps API should be used later for transport-aware recommendation:

- driving time
- walking time
- route distance by road
- public transit estimates, if enabled by the provider

The Google Maps API key must stay backend-only. Do not expose it in frontend HTML/JavaScript.

Environment variables:

- `GOOGLE_MAPS_API_KEY`
- `TRANSPORT_DISTANCE_PROVIDER=google`

## Table: users

Stores base user identity.

Important fields:

- `id`: UUID primary key.
- `name`: user display name.
- `language`: preferred language, for example `th` or `en`.
- `nationality`: optional tourist nationality.
- `created_at`: creation timestamp.

Preference fields are not stored here. They are stored in `user_preferences` because preferences can evolve.

## Table: user_preferences

Stores tourist preference data and learned preference data.

Important fields:

- `user_id`: links to `users`.
- `food_tags`: preferred food tags such as `local_food`, `spicy`, `noodle`.
- `view_tags`: preferred view tags such as `mountain_view`, `river_view`.
- `atmosphere_tags`: preferred atmosphere tags such as `quiet`, `family_friendly`.
- `service_tags`: preferred service features such as `english_menu_available`, `parking_available`, `card_accepted`.
- `place_context_tags`: preferred place context such as `local_hidden_gem`, `good_for_group`.
- `dietary_restrictions`: hard restrictions such as `no_pork`, `vegetarian`, `halal_required`.
- `allergies`: hard allergy constraints such as `shrimp`, `peanut`.
- `transport_modes`: ordered travel modes the user can use, such as `taxi`, `walking`, `public_transit`. The first item is the preferred/default mode.
- `budget_min`, `budget_max`: expected meal budget.
- `max_distance_km`: initial distance limit.
- `learned_preferences`: JSONB field updated by the preference learner.

Recommendation should treat allergies and strict dietary restrictions as hard constraints.

Preference tag mapping:

- `user_preferences.food_tags` matches mostly against `menus.food_tags`.
- `user_preferences.view_tags` matches against `restaurants.view_tags`.
- `user_preferences.atmosphere_tags` matches against `restaurants.atmosphere_tags`.
- `user_preferences.service_tags` matches against `restaurants.service_tags`.
- `user_preferences.place_context_tags` matches against `restaurants.place_context_tags`.

## Table: groups

Stores travel groups.

Important fields:

- `id`: UUID primary key.
- `name`: group name.
- `owner_user_id`: user who created the group.
- `created_at`: creation timestamp.

## Table: group_members

Many-to-many relationship between groups and users.

Important fields:

- `group_id`: links to `groups`.
- `user_id`: links to `users`.
- `role`: member role, for example `owner` or `member`.

The primary key is `(group_id, user_id)`.

For group recommendations, combine hard constraints from all members.

## Table: restaurants

Stores restaurant-level information.

Thai/English paired fields:

- `name_th`, `name_en`
- `story_th`, `story_en`
- `address_th`, `address_en`

Location fields:

- `latitude`
- `longitude`
- `location geography(Point, 4326)`
- `google_maps_url`
- `google_place_id`

`latitude` and `longitude` are convenient for forms and maps. `location` is for PostGIS distance queries.

Opening fields:

- `opening_hours`: JSONB for detailed weekly schedule.
- `timezone`: defaults to `Asia/Bangkok`.
- `is_open`: whether this restaurant listing is active/available.

Tags:

- `view_tags`: view features such as `sea_view`, `mountain_view`.
- `atmosphere_tags`: experience features such as `quiet`, `photo_spot`.
- `service_tags`: service features such as `english_menu_available`, `parking_available`, `card_accepted`.
- `place_context_tags`: context such as `local_hidden_gem`, `good_for_group`.
- `restaurant_dietary_tags`: restaurant-level support such as `halal_certified`, `vegetarian_friendly`, `vegan_friendly`.

Pricing:

- `price_min`
- `price_max`
- `price_currency`, default `THB`

Dietary booleans:

Restaurant-level dietary status is stored in `restaurant_dietary_tags`, not separate booleans. Examples:

- `halal_certified`
- `vegetarian_friendly`
- `vegan_friendly`

Images:

- `image_url`: URL from Supabase Storage, Cloudinary, S3, or another storage service.
- `image_type`: `real`, `ai_generated`, or `placeholder`.

Recommendation stats should be calculated from `match_histories`. If performance becomes a problem later, add a cached stats table or materialized view instead of duplicating counters on `restaurants`.

Embeddings:

- `embedding_th vector(384)`
- `embedding_en vector(384)`

Restaurant embeddings should describe the restaurant experience, not menu safety.

## Table: menus

Stores menu-level information. This is the most important table for safe recommendation.

Thai/English paired fields:

- `name_th`, `name_en`
- `description_th`, `description_en`

Restaurant relationship:

- `restaurant_id`: links to `restaurants`.

Tags:

- `food_tags`: food category tags such as `thai_food`, `soup`, `noodle`.
- `taste_tags`: taste tags such as `spicy`, `sour`, `sweet`.
- `ingredient_tags`: ingredients such as `shrimp`, `pork`, `mushroom`.
- `allergen_tags`: allergen risks such as `shrimp`, `seafood`, `peanut`.
- `dietary_tags`: menu suitability such as `no_pork`, `contains_pork`, `vegetarian_possible`.

Other fields:

- `price`
- `spicy_level`: integer from 0 to 5.
- `ai_suggested`: whether AI helped suggest tags.
- `confirmed_by_restaurant`: whether the restaurant owner confirmed the menu details.

Images:

- `image_url`
- `image_type`: `real`, `ai_generated`, or `placeholder`.

Embeddings:

- `embedding_th vector(384)`
- `embedding_en vector(384)`

Important safety rule:

AI-suggested allergy and dietary information is not trusted until `confirmed_by_restaurant = true`.

## Table: reviews

Stores tourist reviews after visiting.

Important fields:

- `user_id`: reviewer.
- `restaurant_id`: reviewed restaurant.
- `rating`: optional 1 to 5 score.
- `review_bubbles`: structured review tags such as `too_far`, `good_local_taste`, `friendly_staff`.
- `comment`: optional free text.
- `created_at`: review timestamp.

Dashboard insights will aggregate this table.

## Table: match_histories

Stores recommendation interactions.

Important fields:

- `user_id`: tourist.
- `group_id`: optional group context.
- `restaurant_id`: restaurant shown/recommended.
- `action`: `viewed`, `selected`, or `skipped`.
- `reject_reasons`: skip reasons such as `too_far`, `too_expensive`, `not_safe_allergy`.
- `match_score`: recommendation score from 0 to 100.
- `query_context`: JSONB snapshot of user query/profile context.
- `score_breakdown`: JSONB explanation of scoring parts.
- `created_at`: event timestamp.

The user preference learner will use this table to update `user_preferences.learned_preferences`.

## Table: tag_catalogs

Stores controlled tag bubbles.

Important fields:

- `category`: tag category.
- `tag_key`: stable machine key.
- `label_th`, `label_en`: display labels.
- `description_th`, `description_en`: explanation for humans.
- `is_active`: whether the tag is currently usable.

Current seed categories:

- `food`
- `taste`
- `ingredient`
- `allergen`
- `dietary`
- `view`
- `atmosphere`
- `service`
- `place_context`
- `transport`
- `review_bubble`
- `skip_reason`

Frontend should display tags from this table instead of hardcoding all bubbles.

## Table: menu_dictionary

Stores known menu names and suggested tags.

Important fields:

- `menu_name_th`
- `menu_name_en`
- `food_tags`
- `taste_tags`
- `ingredient_tags`
- `allergen_tags`
- `dietary_tags`
- `spicy_level`
- `confidence`
- `created_at`

Menu suggestion logic:

1. Normalize menu name.
2. Check `menu_dictionary`.
3. If not found, call LLM from backend.
4. Return suggestions to frontend.
5. Require restaurant confirmation before trusting allergy/dietary tags.

## Seed Data

The seed file includes:

- demo tourist user
- demo restaurant owner
- demo user preferences
- tag catalogs
- menu dictionary entries
- restaurants
- menus

The seed is intended to be re-runnable.

## Notes For Frontend Collaborator

The frontend is plain HTML/CSS/JavaScript.

Do not call Supabase service role or Google Maps backend APIs directly from frontend code.

Frontend should later call backend endpoints such as:

- `GET /api/tags?category=food`
- `POST /api/menu/suggest-tags`
- `POST /api/recommend`
- `POST /api/match-history`
- `POST /api/reviews`

These endpoints will be implemented in later phases.
