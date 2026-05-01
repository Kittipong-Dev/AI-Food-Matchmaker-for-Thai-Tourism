import { query as dbQuery } from '../db/postgres.js';
import { embedTexts } from './embedding/embeddingClient.js';
import { getRouteEstimate } from './transportService.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function normalizeLimit(limit) {
  const parsed = Number(limit || DEFAULT_LIMIT);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function normalizeLanguage(language) {
  return language === 'th' ? 'th' : 'en';
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function mergeArrays(rows, key) {
  return unique(rows.flatMap((row) => row[key] || []));
}

function vectorToPgvector(embedding) {
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(',')}]`;
}

function hasAny(values, candidates) {
  return candidates.some((candidate) => values.includes(candidate));
}

function buildPoint(currentLocation) {
  if (!currentLocation) {
    return null;
  }

  const lat = Number(currentLocation.lat ?? currentLocation.latitude);
  const lng = Number(currentLocation.lng ?? currentLocation.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

async function loadPreferenceRows(userId, groupId) {
  if (!userId) {
    const error = new Error('userId is required');
    error.statusCode = 400;
    throw error;
  }

  if (!groupId) {
    const result = await dbQuery(
      `
        select *
        from public.user_preferences
        where user_id = $1
      `,
      [userId]
    );

    return result.rows;
  }

  const result = await dbQuery(
    `
      select up.*
      from public.user_preferences up
      where up.user_id = $1
         or up.user_id in (
           select gm.user_id
           from public.group_members gm
           where gm.group_id = $2
         )
    `,
    [userId, groupId]
  );

  return result.rows;
}

function combinePreferences(rows) {
  if (rows.length === 0) {
    return {
      foodTags: [],
      viewTags: [],
      atmosphereTags: [],
      serviceTags: [],
      placeContextTags: [],
      dietaryRestrictions: [],
      allergies: [],
      transportModes: [],
      budgetMin: null,
      budgetMax: null,
      maxDistanceKm: null,
      learnedPreferences: {}
    };
  }

  return {
    foodTags: mergeArrays(rows, 'food_tags'),
    viewTags: mergeArrays(rows, 'view_tags'),
    atmosphereTags: mergeArrays(rows, 'atmosphere_tags'),
    serviceTags: mergeArrays(rows, 'service_tags'),
    placeContextTags: mergeArrays(rows, 'place_context_tags'),
    dietaryRestrictions: mergeArrays(rows, 'dietary_restrictions'),
    allergies: mergeArrays(rows, 'allergies'),
    transportModes: mergeArrays(rows, 'transport_modes'),
    budgetMin: rows
      .map((row) => row.budget_min)
      .filter((value) => value !== null)
      .sort((a, b) => Number(b) - Number(a))[0] ?? null,
    budgetMax: rows
      .map((row) => row.budget_max)
      .filter((value) => value !== null)
      .sort((a, b) => Number(a) - Number(b))[0] ?? null,
    maxDistanceKm: rows
      .map((row) => row.max_distance_km)
      .filter((value) => value !== null)
      .sort((a, b) => Number(a) - Number(b))[0] ?? null,
    learnedPreferences: rows[0]?.learned_preferences || {}
  };
}

function buildEffectiveConstraints(input, preferences) {
  const transportModes = unique([
    ...(input.transportModes || []),
    ...(preferences.transportModes || [])
  ]);

  return {
    allergies: unique([...(preferences.allergies || []), ...(input.allergies || [])]),
    dietaryRestrictions: unique([
      ...(preferences.dietaryRestrictions || []),
      ...(input.dietaryRestrictions || [])
    ]),
    budgetMax: input.budgetMax ?? preferences.budgetMax,
    maxDistanceKm: input.maxDistanceKm ?? preferences.maxDistanceKm,
    foodTags: unique([...(preferences.foodTags || []), ...(input.foodTags || [])]),
    viewTags: unique([...(preferences.viewTags || []), ...(input.viewTags || [])]),
    atmosphereTags: unique([
      ...(preferences.atmosphereTags || []),
      ...(input.atmosphereTags || [])
    ]),
    serviceTags: unique([...(preferences.serviceTags || []), ...(input.serviceTags || [])]),
    placeContextTags: unique([
      ...(preferences.placeContextTags || []),
      ...(input.placeContextTags || [])
    ]),
    transportModes,
    transportMode:
      input.transportMode ||
      input.preferredTransportMode ||
      transportModes[0] ||
      preferences.transportModes?.[0] ||
      null,
    maxTravelMinutes:
      input.maxTravelMinutes === undefined || input.maxTravelMinutes === null
        ? null
        : Number(input.maxTravelMinutes)
  };
}

function createParamBuilder(initial = []) {
  const values = [...initial];

  return {
    values,
    add(value, cast = '') {
      values.push(value);
      return `$${values.length}${cast}`;
    }
  };
}

function buildHardFilterSql({ constraints, point, params }) {
  const filters = [
    'r.is_open = true',
    'm.confirmed_by_restaurant = true'
  ];

  if (constraints.budgetMax !== null && constraints.budgetMax !== undefined) {
    const budgetParam = params.add(Number(constraints.budgetMax), '::numeric');
    filters.push(`(m.price is null or m.price <= ${budgetParam})`);
    filters.push(`(r.price_max is null or r.price_max <= ${budgetParam})`);
  }

  if (point && constraints.maxDistanceKm) {
    const lngParam = params.add(point.lng, '::float8');
    const latParam = params.add(point.lat, '::float8');
    const distanceParam = params.add(Number(constraints.maxDistanceKm) * 1000, '::float8');
    filters.push('r.location is not null');
    filters.push(`
      ST_DWithin(
        r.location,
        ST_SetSRID(ST_MakePoint(${lngParam}, ${latParam}), 4326)::geography,
        ${distanceParam}
      )
    `);
  }

  if (constraints.allergies.length > 0) {
    const allergyParam = params.add(constraints.allergies, '::text[]');
    filters.push(`not (m.allergen_tags && ${allergyParam})`);
  }

  const dietary = constraints.dietaryRestrictions;
  const noPork = hasAny(dietary, ['no_pork', 'halal_required']) || constraints.allergies.includes('pork');
  const noBeef = hasAny(dietary, ['no_beef']) || constraints.allergies.includes('beef');
  const vegetarian = hasAny(dietary, ['vegetarian', 'vegetarian_required']);
  const vegan = hasAny(dietary, ['vegan', 'vegan_required']);
  const halalRequired = hasAny(dietary, ['halal_required']);

  if (noPork) {
    filters.push(`'contains_pork' <> all(m.dietary_tags)`);
    filters.push(`'pork' <> all(m.ingredient_tags)`);
  }

  if (noBeef) {
    filters.push(`'contains_beef' <> all(m.dietary_tags)`);
    filters.push(`'beef' <> all(m.ingredient_tags)`);
  }

  if (vegetarian) {
    filters.push(`'not_vegetarian' <> all(m.dietary_tags)`);
    filters.push(`'vegetarian_possible' = any(m.dietary_tags)`);
  }

  if (vegan) {
    filters.push(`'not_vegetarian' <> all(m.dietary_tags)`);
    filters.push(`'vegan_possible' = any(m.dietary_tags)`);
  }

  if (halalRequired) {
    filters.push(`'halal_certified' = any(r.restaurant_dietary_tags)`);
  }

  return filters.join('\n        and ');
}

function buildDistanceExpression(point, params) {
  if (!point) {
    return 'null::float8';
  }

  const lngParam = params.add(point.lng, '::float8');
  const latParam = params.add(point.lat, '::float8');

  return `
    ST_Distance(
      r.location,
      ST_SetSRID(ST_MakePoint(${lngParam}, ${latParam}), 4326)::geography
    ) / 1000.0
  `;
}

function createReasons(row, constraints) {
  const reasons = [];
  const matchingMenuCount = Number(row.matching_menu_count || 0);

  reasons.push(`Found ${matchingMenuCount} confirmed matching menu${matchingMenuCount === 1 ? '' : 's'}.`);

  if (row.best_menu_similarity !== null) {
    reasons.push('Menu descriptions match the food preference query.');
  }

  if (row.restaurant_similarity !== null && Number(row.restaurant_similarity) > 0.35) {
    reasons.push('Restaurant atmosphere/story also matches the query.');
  }

  if (row.distance_km !== null) {
    reasons.push(`About ${Number(row.distance_km).toFixed(1)} km from current location.`);
  }

  if (constraints.budgetMax !== null && constraints.budgetMax !== undefined) {
    reasons.push('Within the selected budget range.');
  }

  if ((row.view_tag_matches || 0) > 0) {
    reasons.push('Matches preferred view tags.');
  }

  if ((row.service_tag_matches || 0) > 0) {
    reasons.push('Matches preferred service needs.');
  }

  if ((row.place_tag_matches || 0) > 0) {
    reasons.push('Matches preferred local/place context.');
  }

  return reasons;
}

function createWarnings(constraints) {
  const warnings = [];

  if (constraints.allergies.length > 0 || constraints.dietaryRestrictions.length > 0) {
    warnings.push('Allergen and dietary information should still be confirmed with the restaurant.');
  }

  return warnings;
}

function mapRecommendation(row, constraints) {
  const score = Math.max(0, Math.min(100, Math.round(Number(row.final_score || 0))));
  const recommendedMenus = Array.isArray(row.recommended_menus)
    ? row.recommended_menus
    : [];

  return {
    restaurantId: row.restaurant_id,
    restaurantName: row.name_en || row.name_th,
    restaurantNameTh: row.name_th,
    restaurantNameEn: row.name_en,
    googleMapsUrl: row.google_maps_url,
    location: {
      lat: row.latitude === null ? null : Number(row.latitude),
      lng: row.longitude === null ? null : Number(row.longitude)
    },
    distanceKm: row.distance_km === null ? null : Number(row.distance_km),
    score,
    reasons: createReasons(row, constraints),
    recommendedMenus: recommendedMenus.map((menu) => ({
      menuId: menu.menuId,
      nameTh: menu.nameTh,
      nameEn: menu.nameEn,
      price: menu.price,
      reason: 'Confirmed menu that matches the query and hard constraints.'
    })),
    warnings: createWarnings(constraints),
    scoreBreakdown: {
      bestMenuSimilarity: row.best_menu_similarity === null ? null : Number(row.best_menu_similarity),
      restaurantSimilarity:
        row.restaurant_similarity === null ? null : Number(row.restaurant_similarity),
      matchingMenuCount: Number(row.matching_menu_count || 0),
      distanceKm: row.distance_km === null ? null : Number(row.distance_km),
      tagMatches: {
        view: Number(row.view_tag_matches || 0),
        atmosphere: Number(row.atmosphere_tag_matches || 0),
        service: Number(row.service_tag_matches || 0),
        placeContext: Number(row.place_tag_matches || 0)
      }
    }
  };
}

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function applyTransportScoring(recommendations, { point, constraints }) {
  if (!point || !constraints.transportMode) {
    return recommendations;
  }

  const maxTravelMinutes = Number.isFinite(constraints.maxTravelMinutes)
    ? constraints.maxTravelMinutes
    : null;

  const updated = [];

  for (const recommendation of recommendations) {
    if (recommendation.location.lat === null || recommendation.location.lng === null) {
      updated.push(recommendation);
      continue;
    }

    const transport = await getRouteEstimate({
      origin: point,
      destination: {
        lat: recommendation.location.lat,
        lng: recommendation.location.lng
      },
      transportMode: constraints.transportMode
    });

    if (!transport || transport.warning || transport.durationMinutes === null) {
      updated.push({
        ...recommendation,
        transport: transport || null
      });
      continue;
    }

    const targetMinutes = maxTravelMinutes || 45;
    const transportScore = Math.max(0, 10 * (1 - transport.durationMinutes / targetMinutes));
    const overTimePenalty =
      maxTravelMinutes && transport.durationMinutes > maxTravelMinutes ? 20 : 0;
    const score = clampScore(recommendation.score + transportScore - overTimePenalty);
    const warnings = [...recommendation.warnings];

    if (overTimePenalty > 0) {
      warnings.push(`Estimated travel time is over ${maxTravelMinutes} minutes.`);
    }

    updated.push({
      ...recommendation,
      distanceKm: transport.distanceKm ?? recommendation.distanceKm,
      score,
      reasons: [
        ...recommendation.reasons,
        `Estimated ${transport.durationMinutes} minutes by ${constraints.transportMode}.`
      ],
      warnings,
      transport,
      scoreBreakdown: {
        ...recommendation.scoreBreakdown,
        transport: {
          mode: constraints.transportMode,
          durationMinutes: transport.durationMinutes,
          distanceKm: transport.distanceKm,
          score: Math.round(transportScore * 10) / 10,
          penalty: overTimePenalty
        }
      }
    });
  }

  return updated.sort((a, b) => b.score - a.score);
}

export async function recommendRestaurants(input = {}) {
  const preferences = combinePreferences(await loadPreferenceRows(input.userId, input.groupId));
  const constraints = buildEffectiveConstraints(input, preferences);
  const point = buildPoint(input.currentLocation);
  const language = normalizeLanguage(input.language);
  const limit = normalizeLimit(input.limit);
  const textQuery = input.query || [
    ...constraints.foodTags,
    ...constraints.viewTags,
    ...constraints.atmosphereTags,
    ...constraints.serviceTags,
    ...constraints.placeContextTags
  ].join(' ');

  if (!textQuery.trim()) {
    const error = new Error('query or saved preferences are required');
    error.statusCode = 400;
    throw error;
  }

  const embeddingResult = await embedTexts([textQuery]);
  const queryVector = vectorToPgvector(embeddingResult.embeddings[0]);
  const embeddingColumn = language === 'th' ? 'embedding_th' : 'embedding_en';
  const params = createParamBuilder([queryVector]);
  const queryVectorParam = '$1::vector';
  const hardFilterSql = buildHardFilterSql({ constraints, point, params });
  const distanceExpression = buildDistanceExpression(point, params);
  const foodTagsParam = params.add(constraints.foodTags, '::text[]');
  const viewTagsParam = params.add(constraints.viewTags, '::text[]');
  const atmosphereTagsParam = params.add(constraints.atmosphereTags, '::text[]');
  const serviceTagsParam = params.add(constraints.serviceTags, '::text[]');
  const placeTagsParam = params.add(constraints.placeContextTags, '::text[]');
  const limitParam = params.add(limit, '::int');

  const sql = `
    with safe_menu_matches as (
      select
        m.id as menu_id,
        m.restaurant_id,
        m.name_th as menu_name_th,
        m.name_en as menu_name_en,
        m.price,
        m.food_tags,
        m.taste_tags,
        m.ingredient_tags,
        m.allergen_tags,
        m.dietary_tags,
        coalesce(1 - (m.${embeddingColumn} <=> ${queryVectorParam}), 0) as menu_similarity,
        (
          select count(*)
          from unnest(
            coalesce(m.food_tags, array[]::text[])
            || coalesce(m.taste_tags, array[]::text[])
            || coalesce(m.ingredient_tags, array[]::text[])
          ) as tag
          where tag = any(${foodTagsParam})
        ) as menu_tag_matches
      from public.menus m
      join public.restaurants r on r.id = m.restaurant_id
      where
        ${hardFilterSql}
    ),
    nearby_restaurants as (
      select
        r.*,
        ${distanceExpression} as distance_km,
        coalesce(1 - (r.${embeddingColumn} <=> ${queryVectorParam}), 0) as restaurant_similarity,
        cardinality(array(select unnest(r.view_tags) intersect select unnest(${viewTagsParam}))) as view_tag_matches,
        cardinality(array(select unnest(r.atmosphere_tags) intersect select unnest(${atmosphereTagsParam}))) as atmosphere_tag_matches,
        cardinality(array(select unnest(r.service_tags) intersect select unnest(${serviceTagsParam}))) as service_tag_matches,
        cardinality(array(select unnest(r.place_context_tags) intersect select unnest(${placeTagsParam}))) as place_tag_matches
      from public.restaurants r
      where r.is_open = true
    ),
    ranked_menus as (
      select
        *,
        row_number() over (
          partition by restaurant_id
          order by menu_similarity desc, menu_tag_matches desc
        ) as menu_rank
      from safe_menu_matches
    ),
    restaurant_candidates as (
      select
        r.id as restaurant_id,
        r.name_th,
        r.name_en,
        r.latitude,
        r.longitude,
        r.google_maps_url,
        r.view_tags,
        r.atmosphere_tags,
        r.service_tags,
        r.place_context_tags,
        r.restaurant_dietary_tags,
        r.distance_km,
        r.restaurant_similarity,
        r.view_tag_matches,
        r.atmosphere_tag_matches,
        r.service_tag_matches,
        r.place_tag_matches,
        max(s.menu_similarity) as best_menu_similarity,
        count(*) as matching_menu_count,
        jsonb_agg(
          jsonb_build_object(
            'menuId', s.menu_id,
            'nameTh', s.menu_name_th,
            'nameEn', s.menu_name_en,
            'price', s.price
          )
          order by s.menu_similarity desc, s.menu_tag_matches desc
        ) filter (where s.menu_rank <= 5) as recommended_menus
      from ranked_menus s
      join nearby_restaurants r on r.id = s.restaurant_id
      group by
        r.id,
        r.name_th,
        r.name_en,
        r.latitude,
        r.longitude,
        r.google_maps_url,
        r.view_tags,
        r.atmosphere_tags,
        r.service_tags,
        r.place_context_tags,
        r.restaurant_dietary_tags,
        r.distance_km,
        r.restaurant_similarity,
        r.view_tag_matches,
        r.atmosphere_tag_matches,
        r.service_tag_matches,
        r.place_tag_matches
    )
    select
      *,
      least(100, greatest(0,
        45 * best_menu_similarity
        + 10 * restaurant_similarity
        + 15 * least(matching_menu_count, 3) / 3.0
        + case
            when distance_km is null or ${constraints.maxDistanceKm ? Number(constraints.maxDistanceKm) : 0} = 0 then 5
            else 15 * greatest(0, 1 - distance_km / ${constraints.maxDistanceKm ? Number(constraints.maxDistanceKm) : 1})
          end
        + 3 * least(view_tag_matches, 2)
        + 3 * least(atmosphere_tag_matches, 2)
        + 3 * least(service_tag_matches, 2)
        + 3 * least(place_tag_matches, 2)
      )) as final_score
    from restaurant_candidates
    order by final_score desc
    limit ${limitParam}
  `;

  const result = await dbQuery(sql, params.values);

  const recommendations = result.rows.map((row) => mapRecommendation(row, constraints));

  return {
    query: textQuery,
    language,
    embeddingProvider: embeddingResult.provider,
    warnings: embeddingResult.warning ? [embeddingResult.warning] : [],
    data: await applyTransportScoring(recommendations, { point, constraints })
  };
}
