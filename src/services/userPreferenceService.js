import { query } from '../db/postgres.js';
import {
  optionalNumber,
  optionalStringArray
} from '../utils/input.js';

function mapUserPreference(row) {
  return {
    id: row.id,
    userId: row.user_id,
    foodTags: row.food_tags,
    viewTags: row.view_tags,
    atmosphereTags: row.atmosphere_tags,
    serviceTags: row.service_tags,
    placeContextTags: row.place_context_tags,
    dietaryRestrictions: row.dietary_restrictions,
    allergies: row.allergies,
    transportModes: row.transport_modes,
    budgetMin: row.budget_min === null ? null : Number(row.budget_min),
    budgetMax: row.budget_max === null ? null : Number(row.budget_max),
    maxDistanceKm: row.max_distance_km === null ? null : Number(row.max_distance_km),
    learnedPreferences: row.learned_preferences,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizePreferenceInput(input) {
  const normalized = {
    foodTags: optionalStringArray(input.foodTags),
    viewTags: optionalStringArray(input.viewTags),
    atmosphereTags: optionalStringArray(input.atmosphereTags),
    serviceTags: optionalStringArray(input.serviceTags),
    placeContextTags: optionalStringArray(input.placeContextTags),
    dietaryRestrictions: optionalStringArray(input.dietaryRestrictions),
    allergies: optionalStringArray(input.allergies),
    transportModes: optionalStringArray(input.transportModes),
    budgetMin: optionalNumber(input.budgetMin),
    budgetMax: optionalNumber(input.budgetMax),
    maxDistanceKm: optionalNumber(input.maxDistanceKm),
    learnedPreferences: input.learnedPreferences === undefined
      ? undefined
      : input.learnedPreferences
  };

  if (normalized.learnedPreferences !== undefined) {
    if (
      normalized.learnedPreferences === null ||
      Array.isArray(normalized.learnedPreferences) ||
      typeof normalized.learnedPreferences !== 'object'
    ) {
      const error = new Error('learnedPreferences must be an object');
      error.statusCode = 400;
      throw error;
    }
  }

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined)
  );
}

export async function getUserPreference(userId) {
  const result = await query(
    `
      select *
      from public.user_preferences
      where user_id = $1
      limit 1
    `,
    [userId]
  );

  return result.rows[0] ? mapUserPreference(result.rows[0]) : null;
}

export async function upsertUserPreference(userId, input) {
  const data = normalizePreferenceInput(input || {});
  const has = (key) => Object.prototype.hasOwnProperty.call(data, key);

  const result = await query(
    `
      insert into public.user_preferences (
        user_id,
        food_tags,
        view_tags,
        atmosphere_tags,
        service_tags,
        place_context_tags,
        dietary_restrictions,
        allergies,
        transport_modes,
        budget_min,
        budget_max,
        max_distance_km,
        learned_preferences
      )
      values (
        $1,
        coalesce($2::text[], '{}'),
        coalesce($4::text[], '{}'),
        coalesce($6::text[], '{}'),
        coalesce($8::text[], '{}'),
        coalesce($10::text[], '{}'),
        coalesce($12::text[], '{}'),
        coalesce($14::text[], '{}'),
        coalesce($16::text[], '{}'),
        $18,
        $20,
        $22,
        coalesce($24::jsonb, '{}'::jsonb)
      )
      on conflict (user_id)
      do update set
        food_tags = case when $3::boolean then $2::text[] else public.user_preferences.food_tags end,
        view_tags = case when $5::boolean then $4::text[] else public.user_preferences.view_tags end,
        atmosphere_tags = case when $7::boolean then $6::text[] else public.user_preferences.atmosphere_tags end,
        service_tags = case when $9::boolean then $8::text[] else public.user_preferences.service_tags end,
        place_context_tags = case when $11::boolean then $10::text[] else public.user_preferences.place_context_tags end,
        dietary_restrictions = case when $13::boolean then $12::text[] else public.user_preferences.dietary_restrictions end,
        allergies = case when $15::boolean then $14::text[] else public.user_preferences.allergies end,
        transport_modes = case when $17::boolean then $16::text[] else public.user_preferences.transport_modes end,
        budget_min = case when $19::boolean then $18::numeric else public.user_preferences.budget_min end,
        budget_max = case when $21::boolean then $20::numeric else public.user_preferences.budget_max end,
        max_distance_km = case when $23::boolean then $22::numeric else public.user_preferences.max_distance_km end,
        learned_preferences = case when $25::boolean then $24::jsonb else public.user_preferences.learned_preferences end
      returning *
    `,
    [
      userId,
      data.foodTags || [],
      has('foodTags'),
      data.viewTags || [],
      has('viewTags'),
      data.atmosphereTags || [],
      has('atmosphereTags'),
      data.serviceTags || [],
      has('serviceTags'),
      data.placeContextTags || [],
      has('placeContextTags'),
      data.dietaryRestrictions || [],
      has('dietaryRestrictions'),
      data.allergies || [],
      has('allergies'),
      data.transportModes || [],
      has('transportModes'),
      data.budgetMin,
      has('budgetMin'),
      data.budgetMax,
      has('budgetMax'),
      data.maxDistanceKm,
      has('maxDistanceKm'),
      data.learnedPreferences === undefined ? null : JSON.stringify(data.learnedPreferences),
      has('learnedPreferences')
    ]
  );

  return mapUserPreference(result.rows[0]);
}
