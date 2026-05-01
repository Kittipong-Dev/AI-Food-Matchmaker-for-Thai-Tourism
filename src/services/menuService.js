import { query } from '../db/postgres.js';
import {
  optionalBoolean,
  optionalImageType,
  optionalInteger,
  optionalNumber,
  optionalString,
  optionalStringArray,
  requiredString
} from '../utils/input.js';

function mapMenu(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    nameTh: row.name_th,
    nameEn: row.name_en,
    descriptionTh: row.description_th,
    descriptionEn: row.description_en,
    price: row.price === null ? null : Number(row.price),
    foodTags: row.food_tags,
    tasteTags: row.taste_tags,
    ingredientTags: row.ingredient_tags,
    allergenTags: row.allergen_tags,
    dietaryTags: row.dietary_tags,
    spicyLevel: row.spicy_level,
    imageUrl: row.image_url,
    imageType: row.image_type,
    aiSuggested: row.ai_suggested,
    confirmedByRestaurant: row.confirmed_by_restaurant,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeMenuInput(input, { partial = false } = {}) {
  const spicyLevel = optionalInteger(input.spicyLevel);

  if (spicyLevel !== undefined && spicyLevel !== null && (spicyLevel < 0 || spicyLevel > 5)) {
    const error = new Error('spicyLevel must be between 0 and 5');
    error.statusCode = 400;
    throw error;
  }

  const normalized = {
    nameTh: partial
      ? optionalString(input.nameTh)
      : requiredString(input.nameTh, 'nameTh'),
    nameEn: partial
      ? optionalString(input.nameEn)
      : requiredString(input.nameEn, 'nameEn'),
    descriptionTh: optionalString(input.descriptionTh),
    descriptionEn: optionalString(input.descriptionEn),
    price: optionalNumber(input.price),
    foodTags: optionalStringArray(input.foodTags),
    tasteTags: optionalStringArray(input.tasteTags),
    ingredientTags: optionalStringArray(input.ingredientTags),
    allergenTags: optionalStringArray(input.allergenTags),
    dietaryTags: optionalStringArray(input.dietaryTags),
    spicyLevel,
    imageUrl: optionalString(input.imageUrl),
    imageType: optionalImageType(input.imageType),
    aiSuggested: optionalBoolean(input.aiSuggested),
    confirmedByRestaurant: optionalBoolean(input.confirmedByRestaurant)
  };

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined)
  );
}

export async function listMenusByRestaurant(restaurantId) {
  const result = await query(
    `
      select *
      from public.menus
      where restaurant_id = $1
      order by created_at desc
    `,
    [restaurantId]
  );

  return result.rows.map(mapMenu);
}

export async function getMenuById(id) {
  const result = await query(
    `
      select *
      from public.menus
      where id = $1
      limit 1
    `,
    [id]
  );

  return result.rows[0] ? mapMenu(result.rows[0]) : null;
}

export async function createMenu(restaurantId, input) {
  const data = normalizeMenuInput(input);

  const result = await query(
    `
      insert into public.menus (
        restaurant_id,
        name_th,
        name_en,
        description_th,
        description_en,
        price,
        food_tags,
        taste_tags,
        ingredient_tags,
        allergen_tags,
        dietary_tags,
        spicy_level,
        image_url,
        image_type,
        ai_suggested,
        confirmed_by_restaurant
      )
      values (
        $1, $2, $3, $4, $5, $6,
        coalesce($7::text[], '{}'),
        coalesce($8::text[], '{}'),
        coalesce($9::text[], '{}'),
        coalesce($10::text[], '{}'),
        coalesce($11::text[], '{}'),
        $12, $13, coalesce($14, 'placeholder'), coalesce($15, false), coalesce($16, false)
      )
      returning *
    `,
    [
      restaurantId,
      data.nameTh,
      data.nameEn,
      data.descriptionTh || null,
      data.descriptionEn || null,
      data.price ?? null,
      data.foodTags || [],
      data.tasteTags || [],
      data.ingredientTags || [],
      data.allergenTags || [],
      data.dietaryTags || [],
      data.spicyLevel ?? null,
      data.imageUrl || null,
      data.imageType || null,
      data.aiSuggested ?? null,
      data.confirmedByRestaurant ?? null
    ]
  );

  return mapMenu(result.rows[0]);
}

export async function updateMenu(id, input) {
  const data = normalizeMenuInput(input, { partial: true });
  const fields = [];
  const values = [];

  const addField = (column, value) => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  const mappings = [
    ['name_th', 'nameTh'],
    ['name_en', 'nameEn'],
    ['description_th', 'descriptionTh'],
    ['description_en', 'descriptionEn'],
    ['price', 'price'],
    ['food_tags', 'foodTags'],
    ['taste_tags', 'tasteTags'],
    ['ingredient_tags', 'ingredientTags'],
    ['allergen_tags', 'allergenTags'],
    ['dietary_tags', 'dietaryTags'],
    ['spicy_level', 'spicyLevel'],
    ['image_url', 'imageUrl'],
    ['image_type', 'imageType'],
    ['ai_suggested', 'aiSuggested'],
    ['confirmed_by_restaurant', 'confirmedByRestaurant']
  ];

  for (const [column, key] of mappings) {
    if (key in data) {
      addField(column, data[key]);
    }
  }

  if (fields.length === 0) {
    return getMenuById(id);
  }

  values.push(id);

  const result = await query(
    `
      update public.menus
      set ${fields.join(', ')}
      where id = $${values.length}
      returning *
    `,
    values
  );

  return result.rows[0] ? mapMenu(result.rows[0]) : null;
}
