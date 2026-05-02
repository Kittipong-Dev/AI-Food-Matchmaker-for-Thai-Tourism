import { env } from '../../config/env.js';
import { suggestMenuTagsWithMockLlm } from './mockLlmClient.js';

const MENU_TAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'nameTh',
    'nameEn',
    'foodTags',
    'tasteTags',
    'ingredientTags',
    'allergenTags',
    'dietaryTags',
    'spicyLevel',
    'confidence'
  ],
  properties: {
    nameTh: { type: 'string' },
    nameEn: { type: 'string' },
    foodTags: { type: 'array', items: { type: 'string' } },
    tasteTags: { type: 'array', items: { type: 'string' } },
    ingredientTags: { type: 'array', items: { type: 'string' } },
    allergenTags: { type: 'array', items: { type: 'string' } },
    dietaryTags: { type: 'array', items: { type: 'string' } },
    spicyLevel: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    confidence: { type: 'number' }
  }
};

const DASHBOARD_INSIGHT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'whatToImprove',
    'priorityActions',
    'riskFlags',
    'opportunities',
    'confidence'
  ],
  properties: {
    summary: { type: 'string' },
    whatToImprove: {
      type: 'array',
      items: { type: 'string' }
    },
    priorityActions: {
      type: 'array',
      items: { type: 'string' }
    },
    riskFlags: {
      type: 'array',
      items: { type: 'string' }
    },
    opportunities: {
      type: 'array',
      items: { type: 'string' }
    },
    confidence: { type: 'number' }
  }
};

const MENU_TAG_SYSTEM_PROMPT = [
  'You suggest conservative restaurant menu tags for Thai tourism.',
  'Return only structured JSON that matches the schema.',
  'Use snake_case tag keys.',
  'Never claim allergen or dietary safety is confirmed.',
  'Unknown allergy or dietary details should stay absent or low confidence.'
].join(' ');

const DASHBOARD_SYSTEM_PROMPT = [
  'You are an AI business advisor for small local restaurants in Thai tourism.',
  'Summarize dashboard data into practical owner-facing insight.',
  'Focus on menu clarity, allergen confidence, travel friction, service, atmosphere, and tourist conversion.',
  'Do not invent facts that are not in the data.',
  'Keep recommendations concrete and easy for a restaurant owner to act on.',
  'Use the requested output language. For Thai, write naturally for Thai restaurant owners.',
  'Return valid JSON only. Do not wrap the JSON in markdown.'
].join(' ');

function buildMenuTagPrompt(input) {
  return JSON.stringify({
    menuName: input.menuName,
    language: input.language || null,
    task:
      'Suggest Thai/English menu names, food/taste/ingredient/allergen/dietary tags, spicy level 0-5, and confidence 0-1.'
  });
}

function buildDashboardPrompt(input) {
  const language = input.insightLanguage === 'en' ? 'en' : 'th';

  return JSON.stringify({
    outputLanguage: language,
    restaurant: {
      id: input.restaurantId,
      nameTh: input.restaurantNameTh,
      nameEn: input.restaurantNameEn
    },
    periodDays: input.periodDays,
    funnel: input.funnel,
    ruleBasedInsight: input.aiInsight,
    menuHealth: input.sections?.menu?.items || [],
    topTalkedAbout: input.sections?.context?.topTalkedAbout || [],
    storySync: input.sections?.context?.storySync || '',
    opportunity: input.sections?.opportunity || {},
    reviewSummary: input.reviewSummary,
    skipSummary: input.skipSummary,
    touristMix: input.touristMix,
    outputGuidance: {
      summary: '1-2 sentences',
      whatToImprove: '3-5 concise issues the restaurant should improve',
      priorityActions: '3-5 direct action items',
      riskFlags: '0-4 risks',
      opportunities: '0-4 growth opportunities',
      language:
        language === 'th'
          ? 'Write all user-facing strings in Thai for Thai restaurant owners.'
          : 'Write all user-facing strings in English.'
    }
  });
}

function uniqueStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function normalizeSuggestion(raw, input) {
  return {
    nameTh: String(raw.nameTh || input.menuName || '').trim(),
    nameEn: String(raw.nameEn || input.menuName || '').trim(),
    foodTags: uniqueStringArray(raw.foodTags),
    tasteTags: uniqueStringArray(raw.tasteTags),
    ingredientTags: uniqueStringArray(raw.ingredientTags),
    allergenTags: uniqueStringArray(raw.allergenTags),
    dietaryTags: uniqueStringArray(raw.dietaryTags),
    spicyLevel: raw.spicyLevel === null ? null : Math.round(clampNumber(raw.spicyLevel, 0, 5, 0)),
    confidence: clampNumber(raw.confidence, 0, 1, 0.5)
  };
}

function normalizeDashboardInsight(raw) {
  return {
    summary: String(raw.summary || '').trim(),
    whatToImprove: uniqueStringArray(raw.whatToImprove).slice(0, 5),
    priorityActions: uniqueStringArray(raw.priorityActions).slice(0, 5),
    riskFlags: uniqueStringArray(raw.riskFlags).slice(0, 4),
    opportunities: uniqueStringArray(raw.opportunities).slice(0, 4),
    confidence: clampNumber(raw.confidence, 0, 1, 0.5)
  };
}

function extractOutputText(payload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  for (const outputItem of payload.output || []) {
    for (const contentItem of outputItem.content || []) {
      if (typeof contentItem.text === 'string') {
        return contentItem.text;
      }
    }
  }

  return '';
}

function extractChatMessageText(payload) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (typeof item.text === 'string') {
          return item.text;
        }

        return '';
      })
      .join('');
  }

  return '';
}

function stripMarkdownJson(text) {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonObjectText(text) {
  const stripped = stripMarkdownJson(text);
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return stripped;
  }

  return stripped.slice(firstBrace, lastBrace + 1);
}

function parseJsonObject(text) {
  const jsonText = extractJsonObjectText(text);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    const parseError = new Error(`Invalid JSON from LLM: ${error.message}`);
    parseError.cause = error;
    throw parseError;
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withRetry(fn, { attempts = 3, delayMs = 1000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await sleep(delayMs * attempt);
      }
    }
  }

  throw lastError;
}

async function suggestMenuTagsWithOpenAI(input) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.openaiModel,
      instructions: MENU_TAG_SYSTEM_PROMPT,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: buildMenuTagPrompt(input)
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'menu_tag_suggestion',
          schema: MENU_TAG_SCHEMA,
          strict: true
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `OpenAI request failed with ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractOutputText(payload);
  const parsed = parseJsonObject(outputText);

  return normalizeSuggestion(parsed, input);
}

async function suggestMenuTagsWithOpenRouter(input) {
  const headers = {
    Authorization: `Bearer ${env.openRouterApiKey}`,
    'Content-Type': 'application/json'
  };

  if (env.openRouterSiteUrl) {
    headers['HTTP-Referer'] = env.openRouterSiteUrl;
  }

  if (env.openRouterAppName) {
    headers['X-Title'] = env.openRouterAppName;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: env.openRouterModel,
      messages: [
        {
          role: 'system',
          content: MENU_TAG_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: buildMenuTagPrompt(input)
        }
      ],
      temperature: 0.2,
      max_tokens: 700,
      provider: {
        require_parameters: true
      },
      plugins: [
        {
          id: 'response-healing'
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'menu_tag_suggestion',
          strict: true,
          schema: MENU_TAG_SCHEMA
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `OpenRouter request failed with ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractChatMessageText(payload);
  const parsed = parseJsonObject(outputText);

  return normalizeSuggestion(parsed, input);
}

async function summarizeDashboardWithOpenAI(input) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.openaiModel,
      instructions: DASHBOARD_SYSTEM_PROMPT,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: buildDashboardPrompt(input)
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'dashboard_business_insight',
          schema: DASHBOARD_INSIGHT_SCHEMA,
          strict: true
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `OpenAI request failed with ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractOutputText(payload);
  const parsed = parseJsonObject(outputText);

  return normalizeDashboardInsight(parsed);
}

async function summarizeDashboardWithOpenRouter(input) {
  const headers = {
    Authorization: `Bearer ${env.openRouterApiKey}`,
    'Content-Type': 'application/json'
  };

  if (env.openRouterSiteUrl) {
    headers['HTTP-Referer'] = env.openRouterSiteUrl;
  }

  if (env.openRouterAppName) {
    headers['X-Title'] = env.openRouterAppName;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: env.openRouterModel,
      messages: [
        {
          role: 'system',
          content: DASHBOARD_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: buildDashboardPrompt(input)
        }
      ],
      temperature: 0.2,
      max_tokens: 1800,
      provider: {
        require_parameters: true
      },
      plugins: [
        {
          id: 'response-healing'
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'dashboard_business_insight',
          strict: true,
          schema: DASHBOARD_INSIGHT_SCHEMA
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `OpenRouter request failed with ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractChatMessageText(payload);
  const parsed = parseJsonObject(outputText);

  return normalizeDashboardInsight(parsed);
}

export async function suggestMenuTagsWithLlm(input) {
  const shouldUseOpenRouter = env.openRouterApiKey && env.llmProvider === 'openrouter';
  const shouldUseOpenAI =
    env.openaiApiKey && (!env.llmProvider || env.llmProvider === 'openai');

  if (shouldUseOpenRouter) {
    try {
      return {
        source: 'openrouter',
        suggestion: await withRetry(() => suggestMenuTagsWithOpenRouter(input))
      };
    } catch (error) {
      return {
        source: 'mock_fallback',
        warning: error.message,
        suggestion: await suggestMenuTagsWithMockLlm(input)
      };
    }
  }

  if (shouldUseOpenAI) {
    try {
      return {
        source: 'openai',
        suggestion: await suggestMenuTagsWithOpenAI(input)
      };
    } catch (error) {
      return {
        source: 'mock_fallback',
        warning: error.message,
        suggestion: await suggestMenuTagsWithMockLlm(input)
      };
    }
  }

  if (!env.llmApiKey) {
    return {
      source: 'mock_llm',
      suggestion: await suggestMenuTagsWithMockLlm(input)
    };
  }

  return {
    source: 'mock_llm',
    suggestion: await suggestMenuTagsWithMockLlm(input)
  };
}

function buildMockDashboardInsight(input) {
  const language = input.insightLanguage === 'en' ? 'en' : 'th';
  const skipReasons = input.skipSummary?.topSkipReasons || [];
  const menuItems = input.sections?.menu?.items || [];
  const topBubbles = input.reviewSummary?.topReviewBubbles || [];
  const actions = [];
  const improvements = [];
  const risks = [];
  const opportunities = [];

  if (menuItems.some((item) => item.severity === 'urgent' || item.severity === 'warning')) {
    improvements.push(
      language === 'th'
        ? 'ยืนยันส่วนผสม แท็กสารก่อภูมิแพ้ และแท็กข้อจำกัดอาหารของเมนูที่ยังรอตรวจสอบ'
        : 'Confirm ingredients, allergen tags, and dietary tags on menus that still need review.'
    );
    actions.push(
      language === 'th'
        ? 'ตรวจสอบและยืนยันเมนูที่มีความเสี่ยงสูงก่อน'
        : 'Review and confirm the highest-risk menu items first.'
    );
    risks.push(
      language === 'th'
        ? 'ข้อมูลแพ้อาหารหรือข้อจำกัดอาหารที่ยังไม่ยืนยันอาจทำให้นักท่องเที่ยวไม่มั่นใจ'
        : 'Unconfirmed allergy or dietary details may reduce tourist trust.'
    );
  }

  if (skipReasons.length > 0) {
    improvements.push(
      language === 'th'
        ? `ลดสาเหตุที่ลูกค้าปัดข้ามมากที่สุด: ${skipReasons[0].key}`
        : `Reduce the top skip reason: ${skipReasons[0].key}.`
    );
    actions.push(
      language === 'th'
        ? 'เพิ่มข้อมูลราคา ระยะทาง การเดินทาง และความปลอดภัยของเมนูให้ชัดเจนขึ้น'
        : 'Add clearer price, distance, travel, and menu safety information to the restaurant profile.'
    );
  }

  if (topBubbles.length > 0) {
    opportunities.push(
      language === 'th'
        ? `นำจุดเด่นที่นักท่องเที่ยวพูดถึงมากที่สุดไปโปรโมต: ${topBubbles[0].key}`
        : `Promote what tourists already mention most: ${topBubbles[0].key}.`
    );
  }

  if (input.sections?.opportunity?.message) {
    opportunities.push(
      language === 'th'
        ? 'เพิ่มคำอธิบายเมนูและข้อมูลสำหรับนักท่องเที่ยวให้ชัดเจนขึ้น'
        : input.sections.opportunity.message
    );
    actions.push(
      language === 'th'
        ? 'ปรับข้อมูลตามโอกาสที่ระบบแนะนำ'
        : input.sections.opportunity.actionLabel || 'Act on the top opportunity.'
    );
  }

  if (improvements.length === 0) {
    improvements.push(
      language === 'th'
        ? 'อัปเดตรายละเอียดเมนู เวลาเปิดร้าน และคำแปลให้สดใหม่อยู่เสมอ'
        : 'Keep menu details, opening information, and translations fresh.'
    );
  }

  if (actions.length === 0) {
    actions.push(
      language === 'th'
        ? 'ปรับคำอธิบายเมนูยอดนิยมและตรวจสอบแท็กร้านให้ถูกต้อง'
        : 'Refresh top menu descriptions and keep restaurant tags accurate.'
    );
  }

  return {
    summary:
      language === 'th'
        ? 'ภาพรวมร้านยังอยู่ในเกณฑ์ดี ให้เน้นทำข้อมูลเมนู การเดินทาง และความชัดเจนเรื่องอาหารให้ครบขึ้นเพื่อเพิ่มความมั่นใจของนักท่องเที่ยว'
        : input.aiInsight?.message || 'The restaurant profile is stable, with no major warning signs in this period.',
    whatToImprove: improvements.slice(0, 5),
    priorityActions: actions.slice(0, 5),
    riskFlags: risks.slice(0, 4),
    opportunities: opportunities.slice(0, 4),
    confidence: 0.45
  };
}

export async function summarizeDashboardInsightWithLlm(input) {
  const shouldUseOpenRouter = env.openRouterApiKey && env.llmProvider === 'openrouter';
  const shouldUseOpenAI =
    env.openaiApiKey && (!env.llmProvider || env.llmProvider === 'openai');

  if (shouldUseOpenRouter) {
    try {
      return {
        source: 'openrouter',
        insight: await withRetry(() => summarizeDashboardWithOpenRouter(input))
      };
    } catch (error) {
      return {
        source: 'mock_fallback',
        warning: error.message,
        insight: buildMockDashboardInsight(input)
      };
    }
  }

  if (shouldUseOpenAI) {
    try {
      return {
        source: 'openai',
        insight: await summarizeDashboardWithOpenAI(input)
      };
    } catch (error) {
      return {
        source: 'mock_fallback',
        warning: error.message,
        insight: buildMockDashboardInsight(input)
      };
    }
  }

  return {
    source: 'mock_llm',
    insight: buildMockDashboardInsight(input)
  };
}
