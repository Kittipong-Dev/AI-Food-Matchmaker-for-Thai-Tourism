function joinTags(label, tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '';
  }

  return `${label}: ${tags.join(', ')}`;
}

function joinParts(parts) {
  return parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim()))
    .filter(Boolean)
    .join('. ');
}

export function buildMenuEmbeddingText(menu, language) {
  const isThai = language === 'th';
  const name = isThai ? menu.name_th : menu.name_en;
  const description = isThai ? menu.description_th : menu.description_en;

  return joinParts([
    name,
    description,
    joinTags('food tags', menu.food_tags),
    joinTags('taste tags', menu.taste_tags),
    joinTags('ingredient tags', menu.ingredient_tags),
    joinTags('allergen tags', menu.allergen_tags),
    joinTags('dietary tags', menu.dietary_tags),
    menu.spicy_level === null ? '' : `spicy level: ${menu.spicy_level} of 5`,
    menu.price === null ? '' : `price: ${menu.price} THB`
  ]);
}

export function buildRestaurantEmbeddingText(restaurant, language) {
  const isThai = language === 'th';
  const name = isThai ? restaurant.name_th : restaurant.name_en;
  const story = isThai ? restaurant.story_th : restaurant.story_en;
  const address = isThai ? restaurant.address_th : restaurant.address_en;

  return joinParts([
    name,
    story,
    address,
    joinTags('view tags', restaurant.view_tags),
    joinTags('atmosphere tags', restaurant.atmosphere_tags),
    joinTags('service tags', restaurant.service_tags),
    joinTags('place context tags', restaurant.place_context_tags),
    joinTags('restaurant dietary tags', restaurant.restaurant_dietary_tags),
    restaurant.price_min === null && restaurant.price_max === null
      ? ''
      : `price range: ${restaurant.price_min ?? '?'}-${restaurant.price_max ?? '?'} ${restaurant.price_currency || 'THB'}`
  ]);
}
