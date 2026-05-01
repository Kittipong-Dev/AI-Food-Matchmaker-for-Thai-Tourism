import { query } from '../db/postgres.js';

function mapTag(row) {
  return {
    id: row.id,
    category: row.category,
    tagKey: row.tag_key,
    labelTh: row.label_th,
    labelEn: row.label_en,
    descriptionTh: row.description_th,
    descriptionEn: row.description_en,
    isActive: row.is_active
  };
}

export async function listTags({ category, includeInactive = false } = {}) {
  const params = [];
  const where = [];

  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }

  if (!includeInactive) {
    where.push('is_active = true');
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';

  const result = await query(
    `
      select
        id,
        category,
        tag_key,
        label_th,
        label_en,
        description_th,
        description_en,
        is_active
      from public.tag_catalogs
      ${whereSql}
      order by category asc, label_en asc
    `,
    params
  );

  return result.rows.map(mapTag);
}

export async function listTagCategories({ includeInactive = false } = {}) {
  const result = await query(
    `
      select distinct category
      from public.tag_catalogs
      where ($1::boolean = true or is_active = true)
      order by category asc
    `,
    [includeInactive]
  );

  return result.rows.map((row) => row.category);
}
