#!/usr/bin/env node

const DEFAULT_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

const DEMO = {
  userId: '10000000-0000-0000-0000-000000000001',
  groupId: '30000000-0000-0000-0000-000000000001',
  restaurantId: '20000000-0000-0000-0000-000000000001'
};

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    strictProviders: process.env.STRICT_PROVIDERS === 'true',
    includeWrites: false,
    skipEmbedding: false,
    timeoutMs: Number(process.env.API_TEST_TIMEOUT_MS || 90000)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--base-url') {
      options.baseUrl = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.split('=').slice(1).join('=');
    } else if (arg === '--strict-providers') {
      options.strictProviders = true;
    } else if (arg === '--include-writes') {
      options.includeWrites = true;
    } else if (arg === '--skip-embedding') {
      options.skipEmbedding = true;
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[index + 1]);
      index += 1;
    }
  }

  options.baseUrl = options.baseUrl.replace(/\/$/, '');
  return options;
}

const options = parseArgs(process.argv.slice(2));
let warnedLocalhostFallback = false;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertArray(value, message) {
  assert(Array.isArray(value), message);
}

function providerAssert(condition, message) {
  if (options.strictProviders) {
    assert(condition, message);
  }

  if (!condition) {
    return { warning: message };
  }

  return null;
}

async function request(path, { method = 'GET', body, expectedStatus } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetchWithLocalhostFallback(`${options.baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    const allowedStatuses = Array.isArray(expectedStatus)
      ? expectedStatus
      : [expectedStatus || 200];

    if (!allowedStatuses.includes(response.status)) {
      const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
      throw new Error(`${method} ${path} returned ${response.status}: ${detail}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function buildLocalhostFallbackUrl(url) {
  const parsed = new URL(url);

  if (parsed.hostname !== 'localhost') {
    return null;
  }

  parsed.hostname = '127.0.0.1';
  return parsed.toString();
}

async function fetchWithLocalhostFallback(url, init) {
  try {
    return await fetch(url, init);
  } catch (error) {
    const fallbackUrl = buildLocalhostFallbackUrl(url);

    if (!fallbackUrl || init?.signal?.aborted) {
      throw error;
    }

    if (!warnedLocalhostFallback) {
      console.warn('WARN localhost fetch failed; retrying with 127.0.0.1');
      warnedLocalhostFallback = true;
    }

    return fetch(fallbackUrl, init);
  }
}

function collectEmbeddingResults(refreshPayload) {
  const results = refreshPayload?.data?.results || {};
  const entries = [];

  for (const target of Object.keys(results)) {
    for (const language of Object.keys(results[target] || {})) {
      entries.push({
        target,
        language,
        ...results[target][language]
      });
    }
  }

  return entries;
}

function findFirstTransport(recommendations) {
  return (recommendations || []).find((item) => item.transport)?.transport || null;
}

async function runTest(results, name, fn) {
  const startedAt = Date.now();

  try {
    const detail = await fn();
    const elapsedMs = Date.now() - startedAt;
    results.push({ name, status: 'PASS', elapsedMs, detail });
    console.log(`PASS ${name}${detail ? ` - ${detail}` : ''}`);
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    results.push({ name, status: 'FAIL', elapsedMs, error: error.message });
    console.error(`FAIL ${name} - ${error.message}`);
  }
}

async function main() {
  const results = [];
  const context = {};

  console.log(`API base URL: ${options.baseUrl}`);
  console.log(`Strict provider checks: ${options.strictProviders ? 'on' : 'off'}`);

  await runTest(results, 'Root endpoint', async () => {
    const payload = await request('/');
    assert(
      payload?.ok === true || payload?.status === 'ok',
      'Root endpoint did not return ok=true or status=ok'
    );
    return payload.service || 'ok';
  });

  await runTest(results, 'API health', async () => {
    const payload = await request('/api/health');
    assert(payload?.ok === true, 'Health endpoint did not return ok=true');
    return `phase ${payload.phase}`;
  });

  await runTest(results, 'DATABASE_URL / PostgreSQL health', async () => {
    const payload = await request('/api/db/health');
    assert(payload?.ok === true, 'Database health did not return ok=true');
    assert(payload.databaseTime, 'Database health did not return databaseTime');
    return `databaseTime ${payload.databaseTime}`;
  });

  await runTest(results, 'Demo IDs', async () => {
    const payload = await request('/api/dev/demo-ids');
    assert(isObject(payload?.data), 'Demo IDs response missing data');
    return 'demo ids loaded';
  });

  await runTest(results, 'Tag categories', async () => {
    const payload = await request('/api/tags/categories');
    assertArray(payload?.data, 'Tag categories data is not an array');
    assert(payload.data.length > 0, 'No tag categories returned');
    return `${payload.data.length} categories`;
  });

  await runTest(results, 'Food tags', async () => {
    const payload = await request('/api/tags?category=food');
    assertArray(payload?.data, 'Food tags data is not an array');
    assert(payload.data.some((tag) => tag.tagKey === 'local_food'), 'local_food tag missing');
    return `${payload.data.length} food tags`;
  });

  await runTest(results, 'Menu dictionary search', async () => {
    const payload = await request('/api/menu-dictionary/search?q=Tom%20Yum&limit=5');
    assertArray(payload?.data, 'Menu dictionary data is not an array');
    assert(payload.data.length > 0, 'Menu dictionary search returned no entries');
    return `${payload.data.length} entries`;
  });

  await runTest(results, 'Restaurant list/get', async () => {
    const listPayload = await request('/api/restaurants?limit=5');
    assertArray(listPayload?.data, 'Restaurant list data is not an array');
    assert(listPayload.data.length > 0, 'Restaurant list returned no rows');

    const restaurantPayload = await request(`/api/restaurants/${DEMO.restaurantId}`);
    assert(restaurantPayload?.data?.id === DEMO.restaurantId, 'Demo restaurant not found');
    context.restaurant = restaurantPayload.data;
    return `${restaurantPayload.data.nameEn}`;
  });

  await runTest(results, 'Menu list/get', async () => {
    const listPayload = await request(`/api/restaurants/${DEMO.restaurantId}/menus`);
    assertArray(listPayload?.data, 'Menu list data is not an array');
    assert(listPayload.data.length > 0, 'Demo restaurant has no menus');
    context.menu = listPayload.data[0];

    const menuPayload = await request(`/api/menus/${context.menu.id}`);
    assert(menuPayload?.data?.id === context.menu.id, 'Menu get did not return selected menu');
    return `${listPayload.data.length} menus`;
  });

  await runTest(results, 'User preference get', async () => {
    const payload = await request(`/api/user-preferences/${DEMO.userId}`);
    assert(payload?.data?.userId === DEMO.userId, 'Demo user preference not found');
    context.preference = payload.data;
    return `transport modes: ${(payload.data.transportModes || []).join(', ')}`;
  });

  await runTest(results, 'Group get/members', async () => {
    const groupPayload = await request(`/api/groups/${DEMO.groupId}`);
    assert(groupPayload?.data?.id === DEMO.groupId, 'Demo group not found');

    const membersPayload = await request(`/api/groups/${DEMO.groupId}/members`);
    assertArray(membersPayload?.data, 'Group members data is not an array');
    assert(membersPayload.data.length > 0, 'Demo group has no members');
    return `${membersPayload.data.length} members`;
  });

  await runTest(results, 'Menu suggestion dictionary path', async () => {
    const payload = await request('/api/menu/suggest-tags', {
      method: 'POST',
      body: { menuName: 'Tom Yum Kung', language: 'en' }
    });

    assert(payload?.data?.source?.includes('dictionary'), 'Dictionary suggestion did not use dictionary source');
    assert(payload.data.requiresConfirmation === true, 'Suggestion must require restaurant confirmation');
    return `source ${payload.data.source.join(',')}`;
  });

  await runTest(results, 'OPENROUTER_API_KEY / unknown menu LLM path', async () => {
    const payload = await request('/api/menu/suggest-tags', {
      method: 'POST',
      body: { menuName: `Demo Strange Menu ${Date.now()}`, language: 'en' }
    });

    const source = payload?.data?.source?.[0];
    assert(source, 'Suggestion source missing');

    const warning = providerAssert(
      source === 'openrouter' || source === 'openai',
      `LLM fell back to ${source}. Check LLM_PROVIDER=openrouter and OPENROUTER_API_KEY.`
    );

    return warning?.warning || `source ${source}`;
  });

  if (!options.skipEmbedding) {
    await runTest(results, 'EMBEDDING_SERVICE_URL / embedding refresh', async () => {
      const payload = await request('/api/embeddings/refresh', {
        method: 'POST',
        body: { target: 'menus', language: 'en', limit: 1 }
      });

      const entries = collectEmbeddingResults(payload);
      assert(entries.length > 0, 'Embedding refresh returned no result entries');
      assert(entries.every((entry) => entry.dimension === 384), 'Embedding dimension is not 384');

      const fallbackEntry = entries.find((entry) => entry.provider !== 'service');
      const warning = providerAssert(
        !fallbackEntry,
        `Embedding provider is ${fallbackEntry?.provider}. Check EMBEDDING_SERVICE_URL.${fallbackEntry?.warning ? ` Warning: ${fallbackEntry.warning}` : ''}`
      );

      return warning?.warning || entries.map((entry) => `${entry.target}.${entry.language}:${entry.provider}`).join(', ');
    });
  }

  await runTest(results, 'Recommendation engine + SERPAPI_API_KEY transport', async () => {
    const payload = await request('/api/recommend', {
      method: 'POST',
      body: {
        userId: DEMO.userId,
        groupId: DEMO.groupId,
        currentLocation: { lat: 18.795, lng: 98.98 },
        query: 'spicy local food with mountain view, no pork, no shrimp',
        limit: 3
      }
    });

    assertArray(payload?.data, 'Recommendation data is not an array');
    assert(payload.data.length > 0, 'Recommendation returned no restaurants');
    assert(payload.data[0].recommendedMenus?.length > 0, 'Top recommendation has no menu examples');

    const transport = findFirstTransport(payload.data);
    const warning = providerAssert(
      transport &&
        transport.provider === 'serpapi_google_maps' &&
        !transport.warning &&
        transport.estimateType !== 'straight_line_fallback',
      `Transport did not use real SerpApi route. Got ${JSON.stringify(transport)}. Check TRANSPORT_DISTANCE_PROVIDER=serpapi and SERPAPI_API_KEY.`
    );

    return warning?.warning || `top ${payload.data[0].restaurantNameEn}, transport ${transport.provider}`;
  });

  await runTest(results, 'Reviews list', async () => {
    const payload = await request(`/api/reviews/restaurant/${DEMO.restaurantId}?limit=5`);
    assertArray(payload?.data, 'Reviews data is not an array');
    return `${payload.data.length} reviews`;
  });

  await runTest(results, 'Dashboard rule-based summary', async () => {
    const payload = await request(`/api/dashboard/restaurants/${DEMO.restaurantId}?days=30&includeLlm=false`);
    assert(payload?.data?.funnel?.impressions >= 1, 'Dashboard funnel has no impressions');
    assertArray(payload.data.skipSummary?.topSkipReasons, 'Dashboard skip reasons missing');
    return `${payload.data.funnel.impressions} impressions`;
  });

  await runTest(results, 'OPENROUTER_API_KEY / dashboard Thai LLM insight', async () => {
    const payload = await request(`/api/dashboard/restaurants/${DEMO.restaurantId}?days=30&includeLlm=true&language=th`);
    const provider = payload?.data?.llmInsight?.provider;
    assert(provider, 'Dashboard llmInsight.provider missing');

    const warning = providerAssert(
      provider === 'openrouter' || provider === 'openai',
      `Dashboard LLM fell back to ${provider}. Check LLM_PROVIDER=openrouter and OPENROUTER_API_KEY.`
    );

    assert(payload.data.llmInsight.summary, 'Dashboard LLM summary missing');
    return warning?.warning || `provider ${provider}`;
  });

  if (options.includeWrites) {
    await runTest(results, 'Group create/update/member/delete APIs', async () => {
      const groupName = `API Smoke Group ${Date.now()}`;
      const createPayload = await request('/api/groups', {
        method: 'POST',
        expectedStatus: 201,
        body: {
          name: groupName,
          ownerUserId: DEMO.userId
        }
      });

      const groupId = createPayload?.data?.id;
      assert(groupId, 'Group create did not return an id');

      const updatePayload = await request(`/api/groups/${groupId}`, {
        method: 'PUT',
        body: {
          name: `${groupName} Updated`
        }
      });
      assert(updatePayload?.data?.name?.endsWith('Updated'), 'Group update failed');

      const memberPayload = await request(`/api/groups/${groupId}/members`, {
        method: 'POST',
        expectedStatus: 201,
        body: {
          userId: '10000000-0000-0000-0000-000000000003',
          role: 'member'
        }
      });
      assert(memberPayload?.data?.userId, 'Group member upsert failed');

      await request(`/api/groups/${groupId}/members/10000000-0000-0000-0000-000000000003`, {
        method: 'DELETE',
        expectedStatus: 204
      });

      return groupId;
    });

    await runTest(results, 'Restaurant create API', async () => {
      const suffix = Date.now();
      const payload = await request('/api/restaurants', {
        method: 'POST',
        expectedStatus: 201,
        body: {
          ownerUserId: '10000000-0000-0000-0000-000000000002',
          nameTh: `ร้านทดสอบ API ${suffix}`,
          nameEn: `API Smoke Restaurant ${suffix}`,
          storyTh: 'ข้อมูลทดสอบสำหรับตรวจ API',
          storyEn: 'Smoke-test restaurant created by API test.',
          latitude: 18.789,
          longitude: 98.987,
          addressTh: 'เชียงใหม่',
          addressEn: 'Chiang Mai',
          googleMapsUrl: 'https://maps.google.com/?q=18.789,98.987',
          openingHours: [{ day: 'mon', open: '09:00', close: '18:00' }],
          isOpen: true,
          viewTags: ['mountain_view'],
          atmosphereTags: ['quiet'],
          serviceTags: ['english_menu_available'],
          placeContextTags: ['hidden_gem'],
          restaurantDietaryTags: ['vegetarian_friendly'],
          priceMin: 50,
          priceMax: 180,
          priceCurrency: 'THB',
          imageType: 'placeholder'
        }
      });

      assert(payload?.data?.id, 'Restaurant create did not return an id');
      context.createdRestaurant = payload.data;
      return payload.data.id;
    });

    await runTest(results, 'Menu create API', async () => {
      assert(context.createdRestaurant?.id, 'Created restaurant context missing');
      const suffix = Date.now();
      const payload = await request(`/api/restaurants/${context.createdRestaurant.id}/menus`, {
        method: 'POST',
        expectedStatus: 201,
        body: {
          nameTh: `เมนูทดสอบ API ${suffix}`,
          nameEn: `API Smoke Menu ${suffix}`,
          descriptionTh: 'เมนูทดสอบ ไม่มีหมู',
          descriptionEn: 'Smoke-test menu with no pork.',
          price: 99,
          foodTags: ['thai_food', 'local_food'],
          tasteTags: ['savory'],
          ingredientTags: ['mushroom'],
          allergenTags: [],
          dietaryTags: ['no_pork', 'vegetarian_possible'],
          spicyLevel: 2,
          imageType: 'placeholder',
          aiSuggested: true,
          confirmedByRestaurant: true
        }
      });

      assert(payload?.data?.id, 'Menu create did not return an id');
      context.createdMenu = payload.data;
      return payload.data.id;
    });

    await runTest(results, 'Review create API', async () => {
      assert(context.createdRestaurant?.id, 'Created restaurant context missing');
      const payload = await request('/api/reviews', {
        method: 'POST',
        expectedStatus: 201,
        body: {
          userId: DEMO.userId,
          restaurantId: context.createdRestaurant.id,
          rating: 5,
          reviewBubbles: ['good_local_taste', 'friendly_staff'],
          comment: '[api_smoke_test] Review create endpoint check'
        }
      });

      assert(payload?.data?.id, 'Review create did not return an id');
      return payload.data.id;
    });

    await runTest(results, 'Restaurant image metadata API', async () => {
      assert(context.createdRestaurant?.id, 'Created restaurant context missing');
      const payload = await request(`/api/images/restaurants/${context.createdRestaurant.id}`, {
        method: 'PUT',
        body: {
          imageUrl: 'https://example.com/api-smoke-restaurant.jpg',
          imageType: 'real'
        }
      });

      assert(payload?.data?.id === context.createdRestaurant.id, 'Restaurant image update failed');
      return payload.data.imageType;
    });

    await runTest(results, 'Menu AI image metadata label API', async () => {
      assert(context.createdMenu?.id, 'Created menu context missing');
      const payload = await request(`/api/images/menus/${context.createdMenu.id}`, {
        method: 'PUT',
        body: {
          imageUrl: 'https://example.com/api-smoke-menu.png',
          imageType: 'ai_generated'
        }
      });

      assert(payload?.data?.id === context.createdMenu.id, 'Menu image update failed');
      assert(payload.data.label === 'AI-generated illustration, not actual photo', 'AI image label missing');
      return payload.data.label;
    });

    await runTest(results, 'User preference idempotent PUT', async () => {
      assert(context.preference, 'Preference context missing');
      const payload = await request(`/api/user-preferences/${DEMO.userId}`, {
        method: 'PUT',
        body: {
          foodTags: context.preference.foodTags,
          viewTags: context.preference.viewTags,
          atmosphereTags: context.preference.atmosphereTags,
          serviceTags: context.preference.serviceTags,
          placeContextTags: context.preference.placeContextTags,
          dietaryRestrictions: context.preference.dietaryRestrictions,
          allergies: context.preference.allergies,
          transportModes: context.preference.transportModes,
          budgetMin: context.preference.budgetMin,
          budgetMax: context.preference.budgetMax,
          maxDistanceKm: context.preference.maxDistanceKm,
          learnedPreferences: context.preference.learnedPreferences || {}
        }
      });
      assert(payload?.data?.userId === DEMO.userId, 'Preference PUT failed');
      return 'updated same values';
    });

    await runTest(results, 'Restaurant idempotent PUT', async () => {
      assert(context.restaurant, 'Restaurant context missing');
      const payload = await request(`/api/restaurants/${DEMO.restaurantId}`, {
        method: 'PUT',
        body: {
          nameTh: context.restaurant.nameTh,
          nameEn: context.restaurant.nameEn,
          isOpen: context.restaurant.isOpen
        }
      });
      assert(payload?.data?.id === DEMO.restaurantId, 'Restaurant PUT failed');
      return 'updated same values';
    });

    await runTest(results, 'Menu idempotent PUT', async () => {
      assert(context.menu, 'Menu context missing');
      const payload = await request(`/api/menus/${context.menu.id}`, {
        method: 'PUT',
        body: {
          nameTh: context.menu.nameTh,
          nameEn: context.menu.nameEn,
          confirmedByRestaurant: context.menu.confirmedByRestaurant
        }
      });
      assert(payload?.data?.id === context.menu.id, 'Menu PUT failed');
      return 'updated same values';
    });

    await runTest(results, 'Image metadata label', async () => {
      assert(context.menu, 'Menu context missing');
      const payload = await request(`/api/images/menus/${context.menu.id}`, {
        method: 'PUT',
        body: {
          imageUrl: context.menu.imageUrl,
          imageType: context.menu.imageType || 'placeholder'
        }
      });
      assert(payload?.data?.id === context.menu.id, 'Menu image update failed');
      return `imageType ${payload.data.imageType}`;
    });

    await runTest(results, 'Match history create + learner', async () => {
      const payload = await request('/api/match-history', {
        method: 'POST',
        expectedStatus: 201,
        body: {
          userId: DEMO.userId,
          groupId: DEMO.groupId,
          restaurantId: DEMO.restaurantId,
          action: 'viewed',
          rejectReasons: [],
          matchScore: 80,
          queryContext: { apiSmokeTest: true },
          scoreBreakdown: { apiSmokeTest: 1 }
        }
      });
      assert(payload?.data?.matchHistory?.id, 'Match history create failed');
      return payload.data.matchHistory.id;
    });
  }

  const failed = results.filter((result) => result.status === 'FAIL');
  const passed = results.length - failed.length;

  console.log('');
  console.log(`Summary: ${passed}/${results.length} passed`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
