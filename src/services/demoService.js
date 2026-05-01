import { query } from '../db/postgres.js';

export async function getDemoIds() {
  const [users, restaurants, menus] = await Promise.all([
    query(
      `
        select id, name, language, nationality
        from public.users
        order by created_at asc
        limit 5
      `
    ),
    query(
      `
        select id, name_th, name_en
        from public.restaurants
        order by created_at asc
        limit 5
      `
    ),
    query(
      `
        select id, restaurant_id, name_th, name_en
        from public.menus
        order by created_at asc
        limit 10
      `
    )
  ]);

  return {
    users: users.rows.map((row) => ({
      id: row.id,
      name: row.name,
      language: row.language,
      nationality: row.nationality
    })),
    restaurants: restaurants.rows.map((row) => ({
      id: row.id,
      nameTh: row.name_th,
      nameEn: row.name_en
    })),
    menus: menus.rows.map((row) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      nameTh: row.name_th,
      nameEn: row.name_en
    }))
  };
}
