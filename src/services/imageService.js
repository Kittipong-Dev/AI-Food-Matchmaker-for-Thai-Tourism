import { query } from '../db/postgres.js';
import { optionalImageType, optionalString, requiredString } from '../utils/input.js';

const AI_IMAGE_LABEL = 'AI-generated illustration, not actual photo';

function normalizeImageInput(input) {
  return {
    imageUrl: optionalString(input.imageUrl),
    imageType: optionalImageType(input.imageType) || 'placeholder'
  };
}

function formatImageResponse({ target, id, image_url, image_type }) {
  return {
    target,
    id,
    imageUrl: image_url,
    imageType: image_type,
    label: image_type === 'ai_generated' ? AI_IMAGE_LABEL : null
  };
}

async function updateImage({ target, table, id, imageUrl, imageType }) {
  const result = await query(
    `
      update public.${table}
      set image_url = $1,
          image_type = $2
      where id = $3
      returning id, image_url, image_type
    `,
    [imageUrl, imageType, id]
  );

  if (!result.rows[0]) {
    const error = new Error(`${target} not found`);
    error.statusCode = 404;
    throw error;
  }

  return formatImageResponse({
    target,
    ...result.rows[0]
  });
}

export async function updateRestaurantImage(restaurantId, input) {
  const id = requiredString(restaurantId, 'restaurantId');
  const data = normalizeImageInput(input);

  return updateImage({
    target: 'restaurant',
    table: 'restaurants',
    id,
    imageUrl: data.imageUrl,
    imageType: data.imageType
  });
}

export async function updateMenuImage(menuId, input) {
  const id = requiredString(menuId, 'menuId');
  const data = normalizeImageInput(input);

  return updateImage({
    target: 'menu',
    table: 'menus',
    id,
    imageUrl: data.imageUrl,
    imageType: data.imageType
  });
}

export { AI_IMAGE_LABEL };
