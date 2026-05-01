import { query } from '../db/postgres.js';
import {
  optionalNumber,
  optionalString,
  optionalStringArray,
  requiredString
} from '../utils/input.js';
import { updateLearnedPreferencesFromMatch } from './preferenceLearnerService.js';

const ACTIONS = new Set(['viewed', 'selected', 'skipped']);

function normalizeJson(value) {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error('Expected object');
    error.statusCode = 400;
    throw error;
  }

  return value;
}

function normalizeMatchInput(input) {
  const action = requiredString(input.action, 'action');

  if (!ACTIONS.has(action)) {
    const error = new Error('action must be viewed, selected, or skipped');
    error.statusCode = 400;
    throw error;
  }

  const matchScore = optionalNumber(input.matchScore);

  if (matchScore !== undefined && matchScore !== null && (matchScore < 0 || matchScore > 100)) {
    const error = new Error('matchScore must be between 0 and 100');
    error.statusCode = 400;
    throw error;
  }

  return {
    userId: requiredString(input.userId, 'userId'),
    groupId: optionalString(input.groupId),
    restaurantId: requiredString(input.restaurantId, 'restaurantId'),
    action,
    rejectReasons: optionalStringArray(input.rejectReasons) || [],
    matchScore: matchScore ?? null,
    queryContext: normalizeJson(input.queryContext),
    scoreBreakdown: normalizeJson(input.scoreBreakdown)
  };
}

function mapMatchHistory(row) {
  return {
    id: row.id,
    userId: row.user_id,
    groupId: row.group_id,
    restaurantId: row.restaurant_id,
    action: row.action,
    rejectReasons: row.reject_reasons,
    matchScore: row.match_score === null ? null : Number(row.match_score),
    queryContext: row.query_context,
    scoreBreakdown: row.score_breakdown,
    createdAt: row.created_at
  };
}

export async function createMatchHistory(input) {
  const data = normalizeMatchInput(input);

  const result = await query(
    `
      insert into public.match_histories (
        user_id,
        group_id,
        restaurant_id,
        action,
        reject_reasons,
        match_score,
        query_context,
        score_breakdown
      )
      values ($1, $2, $3, $4, $5::text[], $6, $7::jsonb, $8::jsonb)
      returning *
    `,
    [
      data.userId,
      data.groupId || null,
      data.restaurantId,
      data.action,
      data.rejectReasons,
      data.matchScore,
      JSON.stringify(data.queryContext),
      JSON.stringify(data.scoreBreakdown)
    ]
  );

  const learnedPreferences = await updateLearnedPreferencesFromMatch(data);

  return {
    matchHistory: mapMatchHistory(result.rows[0]),
    learnedPreferences
  };
}
