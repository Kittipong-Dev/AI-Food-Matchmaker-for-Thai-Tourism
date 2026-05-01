import { query } from '../db/postgres.js';

function incrementMap(map, keys, amount = 1) {
  const next = { ...(map || {}) };

  for (const key of keys || []) {
    next[key] = Number(next[key] || 0) + amount;
  }

  return next;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function getUserPreferences(userId) {
  const result = await query(
    `
      select id, learned_preferences
      from public.user_preferences
      where user_id = $1
      limit 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function getRestaurantTags(restaurantId) {
  const result = await query(
    `
      select
        view_tags,
        atmosphere_tags,
        service_tags,
        place_context_tags,
        restaurant_dietary_tags
      from public.restaurants
      where id = $1
      limit 1
    `,
    [restaurantId]
  );

  return result.rows[0] || null;
}

function collectRestaurantTags(row) {
  if (!row) {
    return [];
  }

  return [
    ...(row.view_tags || []),
    ...(row.atmosphere_tags || []),
    ...(row.service_tags || []),
    ...(row.place_context_tags || []),
    ...(row.restaurant_dietary_tags || [])
  ];
}

export async function updateLearnedPreferencesFromMatch({
  userId,
  restaurantId,
  action,
  rejectReasons = []
}) {
  const userPreferences = await getUserPreferences(userId);

  if (!userPreferences) {
    return null;
  }

  const restaurantTags = collectRestaurantTags(await getRestaurantTags(restaurantId));
  const learned = userPreferences.learned_preferences || {};
  const next = {
    ...learned,
    actionCounts: incrementMap(learned.actionCounts, [action]),
    skipReasonCounts: incrementMap(learned.skipReasonCounts, rejectReasons),
    selectedTagWeights: learned.selectedTagWeights || {},
    skippedTagWeights: learned.skippedTagWeights || {},
    distanceSensitivity: Number(learned.distanceSensitivity || 1),
    priceSensitivity: Number(learned.priceSensitivity || 1)
  };

  if (action === 'selected') {
    next.selectedTagWeights = incrementMap(next.selectedTagWeights, restaurantTags, 1);
  }

  if (action === 'skipped') {
    next.skippedTagWeights = incrementMap(next.skippedTagWeights, restaurantTags, 1);

    if (rejectReasons.includes('too_far')) {
      next.distanceSensitivity = clamp(next.distanceSensitivity + 0.1, 1, 2);
    }

    if (rejectReasons.includes('too_expensive')) {
      next.priceSensitivity = clamp(next.priceSensitivity + 0.1, 1, 2);
    }
  }

  await query(
    `
      update public.user_preferences
      set learned_preferences = $1::jsonb
      where id = $2
    `,
    [JSON.stringify(next), userPreferences.id]
  );

  return next;
}
