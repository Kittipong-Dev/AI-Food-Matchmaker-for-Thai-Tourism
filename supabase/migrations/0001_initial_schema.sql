create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "postgis";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  language text not null default 'en',
  nationality text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  food_tags text[] not null default '{}',
  view_tags text[] not null default '{}',
  atmosphere_tags text[] not null default '{}',
  service_tags text[] not null default '{}',
  place_context_tags text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  allergies text[] not null default '{}',
  transport_modes text[] not null default '{}',
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  max_distance_km numeric(8,2),
  learned_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  primary key (group_id, user_id)
);

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.users(id) on delete set null,
  name_th text not null,
  name_en text not null,
  story_th text,
  story_en text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  location geography(Point, 4326),
  address_th text,
  address_en text,
  google_maps_url text,
  google_place_id text,
  opening_hours jsonb not null default '[]'::jsonb,
  timezone text not null default 'Asia/Bangkok',
  is_open boolean not null default true,
  view_tags text[] not null default '{}',
  atmosphere_tags text[] not null default '{}',
  service_tags text[] not null default '{}',
  place_context_tags text[] not null default '{}',
  restaurant_dietary_tags text[] not null default '{}',
  price_min numeric(10,2),
  price_max numeric(10,2),
  price_currency text not null default 'THB',
  image_url text,
  image_type text not null default 'placeholder',
  embedding_th vector(384),
  embedding_en vector(384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_image_type_check
    check (image_type in ('real', 'ai_generated', 'placeholder')),
  constraint restaurants_price_range_check
    check (price_min is null or price_max is null or price_min <= price_max)
);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name_th text not null,
  name_en text not null,
  description_th text,
  description_en text,
  price numeric(10,2),
  food_tags text[] not null default '{}',
  taste_tags text[] not null default '{}',
  ingredient_tags text[] not null default '{}',
  allergen_tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  spicy_level integer,
  image_url text,
  image_type text not null default 'placeholder',
  ai_suggested boolean not null default false,
  confirmed_by_restaurant boolean not null default false,
  embedding_th vector(384),
  embedding_en vector(384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menus_image_type_check
    check (image_type in ('real', 'ai_generated', 'placeholder')),
  constraint menus_spicy_level_check
    check (spicy_level is null or spicy_level between 0 and 5),
  unique (restaurant_id, name_th)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  rating integer,
  review_bubbles text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now(),
  constraint reviews_rating_check
    check (rating is null or rating between 1 and 5)
);

create table if not exists public.match_histories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  action text not null,
  reject_reasons text[] not null default '{}',
  match_score numeric(5,2),
  query_context jsonb not null default '{}'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint match_histories_action_check
    check (action in ('viewed', 'selected', 'skipped')),
  constraint match_histories_score_check
    check (match_score is null or match_score between 0 and 100)
);

create table if not exists public.tag_catalogs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  tag_key text not null,
  label_th text not null,
  label_en text not null,
  description_th text,
  description_en text,
  is_active boolean not null default true,
  unique (category, tag_key)
);

create table if not exists public.menu_dictionary (
  id uuid primary key default gen_random_uuid(),
  menu_name_th text not null,
  menu_name_en text not null,
  food_tags text[] not null default '{}',
  taste_tags text[] not null default '{}',
  ingredient_tags text[] not null default '{}',
  allergen_tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  spicy_level integer,
  confidence numeric(4,3) not null default 0.800,
  created_at timestamptz not null default now(),
  constraint menu_dictionary_spicy_level_check
    check (spicy_level is null or spicy_level between 0 and 5),
  constraint menu_dictionary_confidence_check
    check (confidence between 0 and 1),
  unique (menu_name_th),
  unique (menu_name_en)
);

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_restaurants_updated_at on public.restaurants;
create trigger set_restaurants_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

drop trigger if exists set_menus_updated_at on public.menus;
create trigger set_menus_updated_at
before update on public.menus
for each row execute function public.set_updated_at();

create index if not exists user_preferences_user_id_idx
  on public.user_preferences(user_id);

create index if not exists user_preferences_food_tags_idx
  on public.user_preferences using gin(food_tags);

create index if not exists user_preferences_view_tags_idx
  on public.user_preferences using gin(view_tags);

create index if not exists user_preferences_atmosphere_tags_idx
  on public.user_preferences using gin(atmosphere_tags);

create index if not exists user_preferences_service_tags_idx
  on public.user_preferences using gin(service_tags);

create index if not exists user_preferences_place_context_tags_idx
  on public.user_preferences using gin(place_context_tags);

create index if not exists restaurants_owner_user_id_idx
  on public.restaurants(owner_user_id);

create index if not exists restaurants_location_gist_idx
  on public.restaurants using gist(location);

create index if not exists restaurants_view_tags_idx
  on public.restaurants using gin(view_tags);

create index if not exists restaurants_atmosphere_tags_idx
  on public.restaurants using gin(atmosphere_tags);

create index if not exists restaurants_place_context_tags_idx
  on public.restaurants using gin(place_context_tags);

create index if not exists restaurants_service_tags_idx
  on public.restaurants using gin(service_tags);

create index if not exists restaurants_dietary_tags_idx
  on public.restaurants using gin(restaurant_dietary_tags);

create index if not exists menus_restaurant_id_idx
  on public.menus(restaurant_id);

create index if not exists menus_food_tags_idx
  on public.menus using gin(food_tags);

create index if not exists menus_allergen_tags_idx
  on public.menus using gin(allergen_tags);

create index if not exists menus_dietary_tags_idx
  on public.menus using gin(dietary_tags);

create index if not exists reviews_restaurant_id_idx
  on public.reviews(restaurant_id);

create index if not exists match_histories_user_id_idx
  on public.match_histories(user_id);

create index if not exists match_histories_restaurant_id_idx
  on public.match_histories(restaurant_id);

create index if not exists tag_catalogs_category_idx
  on public.tag_catalogs(category);

create index if not exists menu_dictionary_menu_name_th_idx
  on public.menu_dictionary(lower(menu_name_th));

create index if not exists menu_dictionary_menu_name_en_idx
  on public.menu_dictionary(lower(menu_name_en));

-- Vector indexes are useful once embeddings exist. They are safe with nullable vectors.
create index if not exists restaurants_embedding_th_hnsw_idx
  on public.restaurants using hnsw (embedding_th vector_cosine_ops);

create index if not exists restaurants_embedding_en_hnsw_idx
  on public.restaurants using hnsw (embedding_en vector_cosine_ops);

create index if not exists menus_embedding_th_hnsw_idx
  on public.menus using hnsw (embedding_th vector_cosine_ops);

create index if not exists menus_embedding_en_hnsw_idx
  on public.menus using hnsw (embedding_en vector_cosine_ops);
