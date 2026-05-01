import { query } from '../db/postgres.js';
import {
  optionalBoolean,
  optionalImageType,
  optionalJsonArray,
  optionalNumber,
  optionalString,
  optionalStringArray,
  requiredString
} from '../utils/input.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeLimit(limit) {
  const parsed = Number(limit || DEFAULT_LIMIT);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function mapRestaurant(row) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    nameTh: row.name_th,
    nameEn: row.name_en,
    storyTh: row.story_th,
    storyEn: row.story_en,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    addressTh: row.address_th,
    addressEn: row.address_en,
    googleMapsUrl: row.google_maps_url,
    googlePlaceId: row.google_place_id,
    openingHours: row.opening_hours,
    timezone: row.timezone,
    isOpen: row.is_open,
    viewTags: row.view_tags,
    atmosphereTags: row.atmosphere_tags,
    serviceTags: row.service_tags,
    placeContextTags: row.place_context_tags,
    restaurantDietaryTags: row.restaurant_dietary_tags,
    priceMin: row.price_min === null ? null : Number(row.price_min),
    priceMax: row.price_max === null ? null : Number(row.price_max),
    priceCurrency: row.price_currency,
    imageUrl: row.image_url,
    imageType: row.image_type,
    menuCount: row.menu_count === undefined ? undefined : Number(row.menu_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeRestaurantInput(input, { partial = false } = {}) {
  const normalized = {
    ownerUserId: optionalString(input.ownerUserId),
    nameTh: partial
      ? optionalString(input.nameTh)
      : requiredString(input.nameTh, 'nameTh'),
    nameEn: partial
      ? optionalString(input.nameEn)
      : requiredString(input.nameEn, 'nameEn'),
    storyTh: optionalString(input.storyTh),
    storyEn: optionalString(input.storyEn),
    latitude: optionalNumber(input.latitude),
    longitude: optionalNumber(input.longitude),
    addressTh: optionalString(input.addressTh),
    addressEn: optionalString(input.addressEn),
    googleMapsUrl: optionalString(input.googleMapsUrl),
    googlePlaceId: optionalString(input.googlePlaceId),
    openingHours: optionalJsonArray(input.openingHours),
    timezone: optionalString(input.timezone),
    isOpen: optionalBoolean(input.isOpen),
    viewTags: optionalStringArray(input.viewTags),
    atmosphereTags: optionalStringArray(input.atmosphereTags),
    serviceTags: optionalStringArray(input.serviceTags),
    placeContextTags: optionalStringArray(input.placeContextTags),
    restaurantDietaryTags: optionalStringArray(input.restaurantDietaryTags),
    priceMin: optionalNumber(input.priceMin),
    priceMax: optionalNumber(input.priceMax),
    priceCurrency: optionalString(input.priceCurrency),
    imageUrl: optionalString(input.imageUrl),
    imageType: optionalImageType(input.imageType)
  };

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined)
  );
}

export async function listRestaurants({ limit, includeClosed = false } = {}) {
  const result = await query(
    `
      select
        r.*,
        count(m.id) as menu_count
      from public.restaurants r
      left join public.menus m on m.restaurant_id = r.id
      where ($1::boolean = true or r.is_open = true)
      group by r.id
      order by r.created_at desc
      limit $2
    `,
    [includeClosed, normalizeLimit(limit)]
  );

  return result.rows.map(mapRestaurant);
}

export async function getRestaurantById(id) {
  const result = await query(
    `
      select
        r.*,
        count(m.id) as menu_count
      from public.restaurants r
      left join public.menus m on m.restaurant_id = r.id
      where r.id = $1
      group by r.id
      limit 1
    `,
    [id]
  );

  return result.rows[0] ? mapRestaurant(result.rows[0]) : null;
}

export async function createRestaurant(input) {
  const data = normalizeRestaurantInput(input);

  const result = await query(
    `
      insert into public.restaurants (
        owner_user_id,
        name_th,
        name_en,
        story_th,
        story_en,
        latitude,
        longitude,
        location,
        address_th,
        address_en,
        google_maps_url,
        google_place_id,
        opening_hours,
        timezone,
        is_open,
        view_tags,
        atmosphere_tags,
        service_tags,
        place_context_tags,
        restaurant_dietary_tags,
        price_min,
        price_max,
        price_currency,
        image_url,
        image_type
      )
      values (
        $1, $2, $3, $4, $5, $6, $7,
        case
          when $6::numeric is not null and $7::numeric is not null
          then st_setsrid(st_makepoint($7::float8, $6::float8), 4326)::geography
          else null
        end,
        $8, $9, $10, $11, $12::jsonb, coalesce($13, 'Asia/Bangkok'), coalesce($14, true),
        coalesce($15::text[], '{}'), coalesce($16::text[], '{}'),
        coalesce($17::text[], '{}'), coalesce($18::text[], '{}'),
        coalesce($19::text[], '{}'), $20, $21, coalesce($22, 'THB'), $23, coalesce($24, 'placeholder')
      )
      returning *
    `,
    [
      data.ownerUserId || null,
      data.nameTh,
      data.nameEn,
      data.storyTh || null,
      data.storyEn || null,
      data.latitude ?? null,
      data.longitude ?? null,
      data.addressTh || null,
      data.addressEn || null,
      data.googleMapsUrl || null,
      data.googlePlaceId || null,
      JSON.stringify(data.openingHours || []),
      data.timezone || null,
      data.isOpen ?? null,
      data.viewTags || [],
      data.atmosphereTags || [],
      data.serviceTags || [],
      data.placeContextTags || [],
      data.restaurantDietaryTags || [],
      data.priceMin ?? null,
      data.priceMax ?? null,
      data.priceCurrency || null,
      data.imageUrl || null,
      data.imageType || null
    ]
  );

  return mapRestaurant(result.rows[0]);
}

export async function updateRestaurant(id, input) {
  const data = normalizeRestaurantInput(input, { partial: true });
  const fields = [];
  const values = [];

  const addField = (column, value, cast = '') => {
    values.push(value);
    fields.push(`${column} = $${values.length}${cast}`);
  };

  const mappings = [
    ['owner_user_id', 'ownerUserId'],
    ['name_th', 'nameTh'],
    ['name_en', 'nameEn'],
    ['story_th', 'storyTh'],
    ['story_en', 'storyEn'],
    ['latitude', 'latitude'],
    ['longitude', 'longitude'],
    ['address_th', 'addressTh'],
    ['address_en', 'addressEn'],
    ['google_maps_url', 'googleMapsUrl'],
    ['google_place_id', 'googlePlaceId'],
    ['timezone', 'timezone'],
    ['is_open', 'isOpen'],
    ['view_tags', 'viewTags'],
    ['atmosphere_tags', 'atmosphereTags'],
    ['service_tags', 'serviceTags'],
    ['place_context_tags', 'placeContextTags'],
    ['restaurant_dietary_tags', 'restaurantDietaryTags'],
    ['price_min', 'priceMin'],
    ['price_max', 'priceMax'],
    ['price_currency', 'priceCurrency'],
    ['image_url', 'imageUrl'],
    ['image_type', 'imageType']
  ];

  for (const [column, key] of mappings) {
    if (key in data) {
      addField(column, data[key]);
    }
  }

  if ('openingHours' in data) {
    addField('opening_hours', JSON.stringify(data.openingHours), '::jsonb');
  }

  if ('latitude' in data || 'longitude' in data) {
    const lat = 'latitude' in data ? data.latitude : null;
    const lng = 'longitude' in data ? data.longitude : null;
    values.push(lat, lng);
    const latParam = `$${values.length - 1}`;
    const lngParam = `$${values.length}`;
    fields.push(`
      location = case
        when coalesce(${latParam}::numeric, latitude) is not null
         and coalesce(${lngParam}::numeric, longitude) is not null
        then st_setsrid(
          st_makepoint(
            coalesce(${lngParam}::numeric, longitude)::float8,
            coalesce(${latParam}::numeric, latitude)::float8
          ),
          4326
        )::geography
        else null
      end
    `);
  }

  if (fields.length === 0) {
    return getRestaurantById(id);
  }

  values.push(id);

  const result = await query(
    `
      update public.restaurants
      set ${fields.join(', ')}
      where id = $${values.length}
      returning *
    `,
    values
  );

  return result.rows[0] ? mapRestaurant(result.rows[0]) : null;
}
