import { query } from '../../db/postgres.js';
import { buildMenuEmbeddingText, buildRestaurantEmbeddingText } from './embeddingTextBuilder.js';
import { embedTexts } from './embeddingClient.js';

const TARGETS = new Set(['all', 'menus', 'restaurants']);
const LANGUAGES = new Set(['both', 'th', 'en']);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function normalizeTarget(target) {
  const normalized = target || 'all';

  if (!TARGETS.has(normalized)) {
    const error = new Error('target must be all, menus, or restaurants');
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

function normalizeLanguage(language) {
  const normalized = language || 'both';

  if (!LANGUAGES.has(normalized)) {
    const error = new Error('language must be both, th, or en');
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

function normalizeLimit(limit) {
  if (limit === undefined || limit === null || limit === '') {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(limit);

  if (!Number.isFinite(parsed) || parsed < 1) {
    const error = new Error('limit must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function languagesFor(language) {
  return language === 'both' ? ['th', 'en'] : [language];
}

function vectorToPgvector(embedding) {
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(',')}]`;
}

async function loadMenus(limit) {
  const result = await query(
    `
      select
        id,
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
        spicy_level
      from public.menus
      order by updated_at desc
      limit $1
    `,
    [limit]
  );

  return result.rows;
}

async function loadRestaurants(limit) {
  const result = await query(
    `
      select
        id,
        name_th,
        name_en,
        story_th,
        story_en,
        address_th,
        address_en,
        view_tags,
        atmosphere_tags,
        service_tags,
        place_context_tags,
        restaurant_dietary_tags,
        price_min,
        price_max,
        price_currency
      from public.restaurants
      order by updated_at desc
      limit $1
    `,
    [limit]
  );

  return result.rows;
}

async function updateMenuEmbeddings(rows, language, embeddings) {
  for (let index = 0; index < rows.length; index += 1) {
    await query(
      `
        update public.menus
        set ${language === 'th' ? 'embedding_th' : 'embedding_en'} = $1::vector
        where id = $2
      `,
      [vectorToPgvector(embeddings[index]), rows[index].id]
    );
  }
}

async function updateRestaurantEmbeddings(rows, language, embeddings) {
  for (let index = 0; index < rows.length; index += 1) {
    await query(
      `
        update public.restaurants
        set ${language === 'th' ? 'embedding_th' : 'embedding_en'} = $1::vector
        where id = $2
      `,
      [vectorToPgvector(embeddings[index]), rows[index].id]
    );
  }
}

async function refreshMenus(language, limit) {
  const rows = await loadMenus(limit);
  const texts = rows.map((row) => buildMenuEmbeddingText(row, language));
  const embeddingResult = await embedTexts(texts);

  await updateMenuEmbeddings(rows, language, embeddingResult.embeddings);

  return {
    updated: rows.length,
    provider: embeddingResult.provider,
    model: embeddingResult.model,
    dimension: embeddingResult.dimension,
    warning: embeddingResult.warning
  };
}

async function refreshRestaurants(language, limit) {
  const rows = await loadRestaurants(limit);
  const texts = rows.map((row) => buildRestaurantEmbeddingText(row, language));
  const embeddingResult = await embedTexts(texts);

  await updateRestaurantEmbeddings(rows, language, embeddingResult.embeddings);

  return {
    updated: rows.length,
    provider: embeddingResult.provider,
    model: embeddingResult.model,
    dimension: embeddingResult.dimension,
    warning: embeddingResult.warning
  };
}

export async function refreshEmbeddings({ target, language, limit } = {}) {
  const normalizedTarget = normalizeTarget(target);
  const normalizedLanguage = normalizeLanguage(language);
  const normalizedLimit = normalizeLimit(limit);
  const languages = languagesFor(normalizedLanguage);
  const results = {};

  for (const lang of languages) {
    if (normalizedTarget === 'all' || normalizedTarget === 'menus') {
      results.menus ||= {};
      results.menus[lang] = await refreshMenus(lang, normalizedLimit);
    }

    if (normalizedTarget === 'all' || normalizedTarget === 'restaurants') {
      results.restaurants ||= {};
      results.restaurants[lang] = await refreshRestaurants(lang, normalizedLimit);
    }
  }

  return {
    target: normalizedTarget,
    language: normalizedLanguage,
    limit: normalizedLimit,
    results
  };
}
