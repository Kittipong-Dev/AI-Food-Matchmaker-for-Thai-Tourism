# Demo Data

Use `supabase/demo_seed.sql` when you need a richer demo database for recording or frontend testing.

## What It Adds

- 7 demo users with mixed nationalities.
- 1 demo travel group: `Chiang Mai Food Gang Demo`.
- 5 restaurants across Chiang Mai, Bangkok, and Phuket.
- Menu examples with Thai and English fields, allergy tags, dietary tags, and one unconfirmed menu item.
- 30-day dashboard activity:
  - impressions / viewed events
  - selected events
  - skipped events with bubble reasons
  - reviews with bubble feedback
  - tourist nationality mix

The data is designed to make these screens look useful:

- Tourist recommendation page.
- Restaurant dashboard funnel.
- AI insight summary in Thai.
- Menu health / allergy confirmation section.
- Tourist mix and opportunity section.

## Safety

The seed is rerunnable. It deletes only rows marked as demo data:

- `match_histories.query_context.demo_seed = true`
- `reviews.comment` beginning with `[demo_seed]`
- the demo group ID `30000000-0000-0000-0000-000000000001`

It does not delete real restaurants, real users, or real reviews that are not marked as demo data.

## Apply In Supabase SQL Editor

1. Open Supabase dashboard.
2. Go to SQL Editor.
3. Paste the contents of `supabase/demo_seed.sql`.
4. Run it.

## Apply From Local Node

From the backend root:

```powershell
node -e "import('fs').then(fs => import('./src/db/postgres.js').then(async ({ query }) => { const sql = fs.readFileSync('supabase/demo_seed.sql', 'utf8'); await query(sql); console.log('Demo seed applied'); process.exit(0); }).catch((error) => { console.error(error); process.exit(1); }))"
```

## Quick Test

Health:

```bash
curl http://localhost:3000/api/db/health
```

Dashboard without LLM:

```bash
curl "http://localhost:3000/api/dashboard/restaurants/20000000-0000-0000-0000-000000000001?days=30&includeLlm=false"
```

Dashboard with Thai LLM insight:

```bash
curl "http://localhost:3000/api/dashboard/restaurants/20000000-0000-0000-0000-000000000001?days=30&includeLlm=true&language=th"
```

Recommendation:

```bash
curl -X POST http://localhost:3000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"userId":"10000000-0000-0000-0000-000000000001","groupId":"30000000-0000-0000-0000-000000000001","currentLocation":{"lat":18.7883,"lng":98.9853},"query":"spicy local food with mountain view, no pork, no shrimp","limit":5}'
```

Expected dashboard shape after applying:

- Baan Suan Kitchen has more than 100 impressions.
- It has selected and skipped events in the last 30 days.
- Top skip reasons include allergy clarity, distance, menu understanding, price, and parking.
- Top review bubbles include local taste, friendly staff, photo spot, family friendly, and menu clarity.
- Tourist mix includes Japan, Germany, China, Malaysia, Italy, United States, and Thailand.
