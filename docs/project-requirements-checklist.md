# Project Requirements Checklist

Date: 2026-05-02

Project description:

> App ที่ match นักท่องเที่ยวที่ไม่รู้จะกินอะไรเวลาไปเที่ยวกับร้านอาหาร และช่วยเพิ่มพื้นที่ ads ให้ร้าน local ที่ไม่ถูกมองเห็น

## Overall Verdict

Status: **Backend MVP ตอบโจทย์หลักแล้ว**

The backend now supports the core product idea:

- tourists can be matched to restaurants through menu-first recommendation
- allergies/dietary rules are handled at menu level
- hidden/local restaurant tags can influence discovery
- restaurants can enter store/menu data
- menu tag suggestions are dictionary-first with AI/mock fallback
- review/match history data feeds dashboard insights
- Vercel deployment is supported

Not yet complete as a full product:

- frontend screens are handled separately by collaborator
- auth/permissions are not production-ready
- user preference CRUD API is now implemented
- group CRUD API is now implemented
- paid ads/boosting system is not implemented
- Google Maps route-time scoring is implemented when configured
- real LLM dashboard summary is now implemented with fallback

Latest backend update:

- `GET/PUT /api/user-preferences/:userId` now supports personalize data, including food tags, service tags, dietary restrictions, allergies, budget, max distance, and transport modes.
- `GET/POST/PUT /api/groups` plus member add/list/remove APIs now support group/gang preference flows.
- `POST /api/menu/suggest-tags` now uses OpenRouter/OpenAI for unknown menu names when configured, with mock fallback when absent/failing.
- `POST /api/recommend` now supports `transportMode` and `maxTravelMinutes`; Google Routes adjusts scoring when `GOOGLE_MAPS_API_KEY` and `TRANSPORT_DISTANCE_PROVIDER=google` are configured.
- `GET /api/dashboard/restaurants/:id` now includes `llmInsight` using OpenRouter/OpenAI when configured, with mock fallback.

## Tourist Side

| Requirement | Status | Evidence / Notes |
| --- | --- | --- |
| เขียนได้ว่าชอบกินอาหารประเภทไหน | Done MVP | `GET/PUT /api/user-preferences/:userId` supports saved food tags and recommendation uses them. |
| เขียนได้ว่าไม่กินอะไร เช่น กินเจ ไม่กินหมู แพ้กุ้ง | Partial | Database supports `dietary_restrictions` and `allergies`; recommendation hard-filters menus. Missing dedicated personalize update API. |
| เอาประวัติการเลือกร้านย้อนหลังมาร่วม | Partial | `POST /api/match-history` saves selected/skipped/viewed and updates `learned_preferences`. Recommendation loads learned preferences, but scoring does not deeply use learned weights yet. |
| ให้เลือก condition เกี่ยวกับการเดินทาง | Partial | `transport_modes` exists in `user_preferences`. Recommendation uses straight-line PostGIS distance, not transport mode route time yet. |
| join personalize / condition สำหรับเที่ยวเป็น gang | Done MVP | Group tables and `GET/POST/PUT/DELETE /api/groups` APIs exist; recommendation merges group member preferences when `groupId` is provided. |

## Recommender System

| Requirement | Status | Evidence / Notes |
| --- | --- | --- |
| Search result ร้าน/เมนูที่ match | Done | `POST /api/recommend` returns ranked restaurants with `recommendedMenus`. |
| Match safe/suitable menus first, then restaurant | Done | Recommendation starts from confirmed safe menus, then groups back to restaurants. |
| Allergy/dietary hard filters | Done | Supports allergy exclusion, no pork, no beef, vegetarian, vegan, halal required. |
| Budget and distance filters | Done | Supports `budgetMax` and `maxDistanceKm` with PostGIS. |
| ให้กดเอา/ไม่เอาร้านนี้เป็น bubble เหตุผล | Done | `POST /api/match-history` supports `selected`, `skipped`, `viewed`, and `rejectReasons`. |
| เอาเหตุผลไป personalize ต่อ | Done MVP | Rule-based learner updates `learned_preferences`, skip reason counts, tag weights, distance/price sensitivity. |
| Tinder | Not implemented | Marked not urgent in requirement. Backend can support it via recommend + match-history APIs. |
| วงล้อร้านที่ recommend ไว้ | Not implemented | Marked not urgent in requirement. Frontend feature can consume recommendation API later. |

## After Use / Reviews

| Requirement | Status | Evidence / Notes |
| --- | --- | --- |
| Review สั้นๆ | Done | `POST /api/reviews` saves rating/comment. |
| Bubble review เช่น ห้องน้ำไม่สะอาด อาหารจืด | Done | `reviewBubbles` supports structured bubble tags. |
| Review feeds dashboard | Done | `GET /api/dashboard/restaurants/:id` aggregates review bubbles and ratings. |

## Restaurant Side

| Requirement | Status | Evidence / Notes |
| --- | --- | --- |
| Dashboard สรุปว่าควรปรับอะไร | Done MVP | `GET /api/dashboard/restaurants/:id` returns funnel, AI insight, menu health, context, opportunity, review summary, skip summary, tourist mix. |
| Dashboard จากข้อมูลลูกค้าที่ใช้แอพ | Done | Uses `match_histories`, `reviews`, `menus`, `restaurants`, and `users`. |
| ร้านใส่ข้อมูลร้านตัวเอง | Done | `POST /api/restaurants`, `PUT /api/restaurants/:id`. |
| ใส่ story ได้ | Done | `storyTh`, `storyEn` supported in restaurant CRUD and embeddings. |
| ร้านใส่เมนู | Done | `POST /api/restaurants/:restaurantId/menus`, `PUT /api/menus/:id`. |
| ใส่ชื่อเมนูอย่างเดียวแล้วช่วย suggest tags | Done MVP | `POST /api/menu/suggest-tags` dictionary-first and mock AI fallback. |
| เมนูทั่วไป ดึงจาก database มาแปะ | Done | `menu_dictionary` and `/api/menu-dictionary/search`. |
| เมนูแปลกๆ gen | Done MVP | `POST /api/menu/suggest-tags` uses OpenRouter/OpenAI when configured and falls back to mock suggestions when absent/failing. |
| ใส่ label ว่าไม่ใช่รูปจริง | Done | `imageType = ai_generated` returns label: `AI-generated illustration, not actual photo`. |

## Local Restaurant Visibility / Ads

| Requirement | Status | Evidence / Notes |
| --- | --- | --- |
| เพิ่มพื้นที่ให้ร้าน local ที่ไม่ถูกมองเห็น | Partial | `place_context_tags` supports `local_hidden_gem`; recommendation scoring includes place-context tags. |
| Ads / paid placement | Not implemented | No paid ads, boosting, campaign, impression billing, or sponsored ranking yet. |

## AI / Data Systems

| Requirement | Status | Evidence / Notes |
| --- | --- | --- |
| Embeddings | Done | `POST /api/embeddings/refresh` writes `vector(384)` embeddings. |
| Python model service | Done | `embedding_service/main.py` exposes FastAPI `/embed` using sentence-transformers. |
| Mock fallback | Done | Node falls back to deterministic 384-dim mock vectors. |
| Menu vector search | Done MVP | Recommendation uses menu embeddings. |
| Restaurant vector search | Done MVP | Recommendation uses restaurant embeddings as part of scoring. |
| LLM abstraction | Done MVP | LLM client abstraction supports OpenRouter Chat Completions and OpenAI Responses API for menu suggestions with mock fallback. |
| Dashboard AI summary | Done MVP | Dashboard includes `llmInsight` from OpenRouter/OpenAI when configured, with mock fallback. |

## Deployment / Collaboration

| Requirement | Status | Evidence / Notes |
| --- | --- | --- |
| Vercel-compatible backend | Done | Express app exports cleanly for Vercel. |
| API spec for frontend team | Done | `docs/api-spec.md`. |
| Demo IDs for frontend team | Done | `GET /api/dev/demo-ids`. |
| End-to-end API test report | Done | `docs/ai-agent-test-report.md`, 18/18 passed. |

## Highest Priority Gaps

These are the most useful next backend gaps if the frontend team needs full demo flows:

1. Auth and authorization
   - Needed before production or public write access.

2. Frontend screens
   - Collaborator can now connect to the full MVP backend APIs.

3. Ads/boosting model
   - Needed for paid local restaurant promotion.

## Presentation Answer

If asked “does this answer the project goal?”:

> Yes, the backend MVP answers the main goal. It can recommend local restaurants by matching safe menus first, then ranking restaurants by location, tags, atmosphere, learned behavior, and optional Google route time. It also supports restaurant/menu entry, user preferences, group management, OpenRouter/OpenAI-backed menu tag suggestions, LLM dashboard business insights with mock fallback, reviews, embeddings, and deployed API collaboration. Production auth, frontend screens, and paid ads are still future work.
