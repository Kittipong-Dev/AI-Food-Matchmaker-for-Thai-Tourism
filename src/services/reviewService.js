import { query } from '../db/postgres.js';
import {
  optionalInteger,
  optionalString,
  optionalStringArray,
  requiredString
} from '../utils/input.js';

function normalizeReviewInput(input) {
  const rating = optionalInteger(input.rating);

  if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) {
    const error = new Error('rating must be between 1 and 5');
    error.statusCode = 400;
    throw error;
  }

  return {
    userId: requiredString(input.userId, 'userId'),
    restaurantId: requiredString(input.restaurantId, 'restaurantId'),
    rating: rating ?? null,
    reviewBubbles: optionalStringArray(input.reviewBubbles) || [],
    comment: optionalString(input.comment) || null
  };
}

function mapReview(row) {
  return {
    id: row.id,
    userId: row.user_id,
    restaurantId: row.restaurant_id,
    rating: row.rating,
    reviewBubbles: row.review_bubbles,
    comment: row.comment,
    createdAt: row.created_at
  };
}

export async function createReview(input) {
  const data = normalizeReviewInput(input);

  const result = await query(
    `
      insert into public.reviews (
        user_id,
        restaurant_id,
        rating,
        review_bubbles,
        comment
      )
      values ($1, $2, $3, $4::text[], $5)
      returning *
    `,
    [
      data.userId,
      data.restaurantId,
      data.rating,
      data.reviewBubbles,
      data.comment
    ]
  );

  return mapReview(result.rows[0]);
}

export async function listReviewsByRestaurant(restaurantId, { limit = 50 } = {}) {
  const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const result = await query(
    `
      select *
      from public.reviews
      where restaurant_id = $1
      order by created_at desc
      limit $2
    `,
    [restaurantId, parsedLimit]
  );

  return result.rows.map(mapReview);
}
