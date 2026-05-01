import { findMenuDictionaryExact } from './menuDictionaryService.js';
import { suggestMenuTagsWithLlm } from './ai/llmClient.js';

const SAFETY_NOTICE =
  'Allergen and dietary information must be confirmed by the restaurant.';

function normalizeMenuName(menuName) {
  return String(menuName || '').replace(/\s+/g, ' ').trim();
}

function normalizeLanguage(language) {
  return language === 'th' || language === 'en' ? language : undefined;
}

function formatSuggestedTags(entry) {
  return {
    foodTags: entry.foodTags || [],
    tasteTags: entry.tasteTags || [],
    ingredientTags: entry.ingredientTags || [],
    allergenTags: entry.allergenTags || [],
    dietaryTags: entry.dietaryTags || []
  };
}

function buildDictionarySuggestion(entry) {
  return {
    nameTh: entry.menuNameTh,
    nameEn: entry.menuNameEn,
    suggestedTags: formatSuggestedTags(entry),
    spicyLevel: entry.spicyLevel,
    confidence: entry.confidence,
    source: ['dictionary'],
    requiresConfirmation: true,
    safetyNotice: SAFETY_NOTICE
  };
}

function buildLlmSuggestion({ menuName, language, source, suggestion }) {
  return {
    nameTh: suggestion.nameTh || (language === 'th' ? menuName : menuName),
    nameEn: suggestion.nameEn || (language === 'en' ? menuName : menuName),
    suggestedTags: {
      foodTags: suggestion.foodTags || [],
      tasteTags: suggestion.tasteTags || [],
      ingredientTags: suggestion.ingredientTags || [],
      allergenTags: suggestion.allergenTags || [],
      dietaryTags: suggestion.dietaryTags || []
    },
    spicyLevel: suggestion.spicyLevel,
    confidence: suggestion.confidence,
    source: [source],
    requiresConfirmation: true,
    safetyNotice: SAFETY_NOTICE
  };
}

export async function suggestMenuDetails({ menuName, language } = {}) {
  const normalizedMenuName = normalizeMenuName(menuName);
  const normalizedLanguage = normalizeLanguage(language);

  if (!normalizedMenuName) {
    const error = new Error('menuName is required');
    error.statusCode = 400;
    throw error;
  }

  const dictionaryEntry = await findMenuDictionaryExact(normalizedMenuName);

  if (dictionaryEntry) {
    return buildDictionarySuggestion(dictionaryEntry);
  }

  const llmResult = await suggestMenuTagsWithLlm({
    menuName: normalizedMenuName,
    language: normalizedLanguage
  });

  return buildLlmSuggestion({
    menuName: normalizedMenuName,
    language: normalizedLanguage,
    source: llmResult.source,
    suggestion: llmResult.suggestion
  });
}
