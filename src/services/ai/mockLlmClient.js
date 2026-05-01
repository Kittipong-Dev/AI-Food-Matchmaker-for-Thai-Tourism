function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function titleCaseWords(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export async function suggestMenuTagsWithMockLlm({ menuName, language }) {
  const normalized = String(menuName || '').trim();
  const lower = normalized.toLowerCase();

  const suggestion = {
    nameTh: language === 'th' ? normalized : normalized,
    nameEn: language === 'en' ? titleCaseWords(normalized) : normalized,
    foodTags: ['thai_food'],
    tasteTags: [],
    ingredientTags: [],
    allergenTags: [],
    dietaryTags: [],
    spicyLevel: null,
    confidence: 0.35
  };

  if (includesAny(lower, ['ต้มยำ', 'tom yum'])) {
    suggestion.foodTags.push('soup', 'spicy');
    suggestion.tasteTags.push('spicy', 'sour');
    suggestion.spicyLevel = 4;
    suggestion.confidence = 0.55;
  }

  if (includesAny(lower, ['กุ้ง', 'shrimp', 'prawn'])) {
    suggestion.foodTags.push('seafood');
    suggestion.ingredientTags.push('shrimp');
    suggestion.allergenTags.push('shrimp', 'seafood');
    suggestion.dietaryTags.push('contains_seafood', 'not_vegetarian');
    suggestion.confidence = Math.max(suggestion.confidence, 0.55);
  }

  if (includesAny(lower, ['หมู', 'pork'])) {
    suggestion.ingredientTags.push('pork');
    suggestion.dietaryTags.push('contains_pork', 'not_vegetarian');
    suggestion.confidence = Math.max(suggestion.confidence, 0.5);
  }

  if (includesAny(lower, ['เห็ด', 'mushroom'])) {
    suggestion.ingredientTags.push('mushroom');
    suggestion.dietaryTags.push('vegetarian_possible');
    suggestion.confidence = Math.max(suggestion.confidence, 0.45);
  }

  if (includesAny(lower, ['ผัด', 'fried', 'stir'])) {
    suggestion.tasteTags.push('savory');
    suggestion.confidence = Math.max(suggestion.confidence, 0.42);
  }

  return {
    ...suggestion,
    foodTags: [...new Set(suggestion.foodTags)],
    tasteTags: [...new Set(suggestion.tasteTags)],
    ingredientTags: [...new Set(suggestion.ingredientTags)],
    allergenTags: [...new Set(suggestion.allergenTags)],
    dietaryTags: [...new Set(suggestion.dietaryTags)]
  };
}
