import { query } from '../db/postgres.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeLimit(limit) {
  const parsed = Number(limit || DEFAULT_LIMIT);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function mapMenuDictionaryEntry(row) {
  return {
    id: row.id,
    menuNameTh: row.menu_name_th,
    menuNameEn: row.menu_name_en,
    foodTags: row.food_tags,
    tasteTags: row.taste_tags,
    ingredientTags: row.ingredient_tags,
    allergenTags: row.allergen_tags,
    dietaryTags: row.dietary_tags,
    spicyLevel: row.spicy_level,
    confidence: row.confidence === null ? null : Number(row.confidence),
    createdAt: row.created_at
  };
}

export async function listMenuDictionaryEntries({ limit } = {}) {
  const result = await query(
    `
      select
        id,
        menu_name_th,
        menu_name_en,
        food_tags,
        taste_tags,
        ingredient_tags,
        allergen_tags,
        dietary_tags,
        spicy_level,
        confidence,
        created_at
      from public.menu_dictionary
      order by menu_name_en asc
      limit $1
    `,
    [normalizeLimit(limit)]
  );

  return result.rows.map(mapMenuDictionaryEntry);
}

export async function findMenuDictionaryExact(menuName) {
  const normalizedName = String(menuName || '').trim();

  if (!normalizedName) {
    return null;
  }

  const result = await query(
    `
      select
        id,
        menu_name_th,
        menu_name_en,
        food_tags,
        taste_tags,
        ingredient_tags,
        allergen_tags,
        dietary_tags,
        spicy_level,
        confidence,
        created_at
      from public.menu_dictionary
      where lower(menu_name_th) = lower($1)
         or lower(menu_name_en) = lower($1)
      order by confidence desc
      limit 1
    `,
    [normalizedName]
  );

  return result.rows[0] ? mapMenuDictionaryEntry(result.rows[0]) : null;
}

export async function searchMenuDictionary({ q, limit } = {}) {
  const searchText = String(q || '').trim();

  if (!searchText) {
    return [];
  }

  const result = await query(
    `
      select
        id,
        menu_name_th,
        menu_name_en,
        food_tags,
        taste_tags,
        ingredient_tags,
        allergen_tags,
        dietary_tags,
        spicy_level,
        confidence,
        created_at
      from public.menu_dictionary
      where menu_name_th ilike $1
         or menu_name_en ilike $1
      order by
        case
          when lower(menu_name_th) = lower($2) then 0
          when lower(menu_name_en) = lower($2) then 0
          when menu_name_th ilike $3 then 1
          when menu_name_en ilike $3 then 1
          else 2
        end,
        confidence desc,
        menu_name_en asc
      limit $4
    `,
    [`%${searchText}%`, searchText, `${searchText}%`, normalizeLimit(limit)]
  );

  return result.rows.map(mapMenuDictionaryEntry);
}
