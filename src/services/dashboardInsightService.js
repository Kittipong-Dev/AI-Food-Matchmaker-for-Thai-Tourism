import { query } from '../db/postgres.js';

const DEFAULT_DAYS = 30;

function normalizeDays(days) {
  const parsed = Number(days || DEFAULT_DAYS);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_DAYS;
  }

  return Math.min(Math.floor(parsed), 365);
}

function countItems(items) {
  const counts = {};

  for (const item of items || []) {
    counts[item] = Number(counts[item] || 0) + 1;
  }

  return counts;
}

function topEntries(counts, limit = 5) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function percent(part, total) {
  if (!total) {
    return 0;
  }

  return Math.round((Number(part || 0) / Number(total)) * 100);
}

function buildPrimaryInsight({ skippedCount, skipReasonCounts, menuRiskItems }) {
  const allergyConcern = Number(skipReasonCounts.not_safe_allergy || 0);

  if (allergyConcern > 0) {
    return {
      type: 'risk',
      title: 'AI Insight',
      message: `Your restaurant is getting attention, but ${allergyConcern} recent skip event${allergyConcern === 1 ? '' : 's'} mention allergy or safety concerns. Confirm allergen tags on main menus first.`
    };
  }

  if (menuRiskItems.length > 0) {
    return {
      type: 'menu_health',
      title: 'AI Insight',
      message: `${menuRiskItems.length} menu item${menuRiskItems.length === 1 ? '' : 's'} still need restaurant confirmation. Confirming them will help tourists trust dietary and allergy information.`
    };
  }

  if (skippedCount > 0) {
    return {
      type: 'conversion',
      title: 'AI Insight',
      message: `You had ${skippedCount} skip event${skippedCount === 1 ? '' : 's'} in this period. Check skip reasons and add clearer menu, price, and travel information.`
    };
  }

  return {
    type: 'positive',
    title: 'AI Insight',
    message: 'Your restaurant profile has no major warning signs in the selected period. Keep menu tags and review responses fresh.'
  };
}

function buildMenuHealth(menus, skipReasonCounts) {
  const items = [];

  for (const menu of menus) {
    if (!menu.confirmed_by_restaurant) {
      items.push({
        menuId: menu.id,
        nameTh: menu.name_th,
        nameEn: menu.name_en,
        status: 'needs_confirmation',
        severity: 'warning',
        title: 'Waiting for confirmation',
        message: 'Confirm ingredients, allergens, and dietary tags so tourists can trust this menu.'
      });
    }

    if ((menu.allergen_tags || []).length > 0) {
      items.push({
        menuId: menu.id,
        nameTh: menu.name_th,
        nameEn: menu.name_en,
        status: 'allergen_visible',
        severity: 'info',
        title: 'Allergen information visible',
        message: `This menu lists allergen tags: ${(menu.allergen_tags || []).join(', ')}.`
      });
    }
  }

  if (Number(skipReasonCounts.not_safe_allergy || 0) > 0) {
    items.unshift({
      menuId: null,
      nameTh: null,
      nameEn: null,
      status: 'allergy_skip_risk',
      severity: 'urgent',
      title: 'Allergy clarity risk',
      message: `${skipReasonCounts.not_safe_allergy} skip event${skipReasonCounts.not_safe_allergy === 1 ? '' : 's'} mention allergy concerns. Prioritize confirming high-traffic menu tags.`
    });
  }

  return items.slice(0, 8);
}

function buildContextInsight(reviewBubbleCounts, restaurant) {
  const topReviewTags = topEntries(reviewBubbleCounts, 6);
  const intendedQuiet = (restaurant.atmosphere_tags || []).includes('quiet');
  const energeticSignals = ['photo_spot', 'friendly_staff', 'good_local_taste'];
  const energeticCount = energeticSignals.reduce(
    (sum, tag) => sum + Number(reviewBubbleCounts[tag] || 0),
    0
  );

  return {
    topTalkedAbout: topReviewTags.map((entry) => ({
      tag: entry.key,
      count: entry.count
    })),
    storySync:
      intendedQuiet && energeticCount > 0
        ? 'Tourists may be responding more to your lively/local experience than the quiet positioning you intended.'
        : 'Tourist perception is broadly aligned with your current restaurant tags.'
  };
}

function buildOpportunity(touristMix) {
  const japanese = touristMix.find((item) => item.nationality?.toLowerCase() === 'japan');

  if (japanese && japanese.percentage >= 20) {
    return {
      type: 'tourist_segment',
      title: 'Opportunity from Japanese tourists',
      message: 'Japanese tourists are a meaningful share of recent interactions. Consider adding Japanese menu descriptions for top menus.',
      actionLabel: 'Prepare for this segment'
    };
  }

  return {
    type: 'menu_translation',
    title: 'Translation opportunity',
    message: 'Add clearer English menu descriptions and allergy notes to increase tourist confidence.',
    actionLabel: 'Improve menu descriptions'
  };
}

async function loadRestaurant(restaurantId) {
  const result = await query(
    `
      select *
      from public.restaurants
      where id = $1
      limit 1
    `,
    [restaurantId]
  );

  return result.rows[0] || null;
}

async function loadMenus(restaurantId) {
  const result = await query(
    `
      select *
      from public.menus
      where restaurant_id = $1
      order by created_at desc
    `,
    [restaurantId]
  );

  return result.rows;
}

async function loadFunnel(restaurantId, days) {
  const result = await query(
    `
      select
        count(*) filter (where action = 'viewed') as viewed,
        count(*) filter (where action = 'selected') as selected,
        count(*) filter (where action = 'skipped') as skipped
      from public.match_histories
      where restaurant_id = $1
        and created_at >= now() - ($2::int * interval '1 day')
    `,
    [restaurantId, days]
  );

  const row = result.rows[0] || {};
  const viewed = Number(row.viewed || 0);
  const selected = Number(row.selected || 0);
  const skipped = Number(row.skipped || 0);

  return {
    viewed,
    selected,
    skipped,
    selectionRate: percent(selected, viewed || selected + skipped)
  };
}

async function loadReviewStats(restaurantId, days) {
  const result = await query(
    `
      select
        count(*) as review_count,
        avg(rating) as average_rating,
        coalesce(array_agg(review_bubbles), '{}') as bubble_arrays
      from public.reviews
      where restaurant_id = $1
        and created_at >= now() - ($2::int * interval '1 day')
    `,
    [restaurantId, days]
  );

  const row = result.rows[0] || {};
  const bubbles = (row.bubble_arrays || []).flat();

  return {
    reviewCount: Number(row.review_count || 0),
    averageRating: row.average_rating === null ? null : Number(row.average_rating),
    reviewBubbleCounts: countItems(bubbles)
  };
}

async function loadSkipReasonCounts(restaurantId, days) {
  const result = await query(
    `
      select coalesce(array_agg(reject_reasons), '{}') as reason_arrays
      from public.match_histories
      where restaurant_id = $1
        and action = 'skipped'
        and created_at >= now() - ($2::int * interval '1 day')
    `,
    [restaurantId, days]
  );

  return countItems((result.rows[0]?.reason_arrays || []).flat());
}

async function loadTouristMix(restaurantId, days) {
  const result = await query(
    `
      select
        coalesce(u.nationality, 'Unknown') as nationality,
        count(*) as count
      from public.match_histories mh
      join public.users u on u.id = mh.user_id
      where mh.restaurant_id = $1
        and mh.created_at >= now() - ($2::int * interval '1 day')
      group by coalesce(u.nationality, 'Unknown')
      order by count desc
      limit 5
    `,
    [restaurantId, days]
  );

  const total = result.rows.reduce((sum, row) => sum + Number(row.count || 0), 0);

  return result.rows.map((row) => ({
    nationality: row.nationality,
    count: Number(row.count),
    percentage: percent(row.count, total)
  }));
}

export async function getRestaurantDashboard(restaurantId, { days } = {}) {
  const normalizedDays = normalizeDays(days);
  const restaurant = await loadRestaurant(restaurantId);

  if (!restaurant) {
    const error = new Error('Restaurant not found');
    error.statusCode = 404;
    throw error;
  }

  const [menus, funnel, reviewStats, skipReasonCounts, touristMix] = await Promise.all([
    loadMenus(restaurantId),
    loadFunnel(restaurantId, normalizedDays),
    loadReviewStats(restaurantId, normalizedDays),
    loadSkipReasonCounts(restaurantId, normalizedDays),
    loadTouristMix(restaurantId, normalizedDays)
  ]);

  const menuHealth = buildMenuHealth(menus, skipReasonCounts);
  const aiInsight = buildPrimaryInsight({
    skippedCount: funnel.skipped,
    skipReasonCounts,
    menuRiskItems: menuHealth.filter((item) => item.severity === 'urgent' || item.severity === 'warning')
  });

  return {
    restaurantId,
    restaurantNameTh: restaurant.name_th,
    restaurantNameEn: restaurant.name_en,
    periodDays: normalizedDays,
    latestDataAt: new Date().toISOString(),
    funnel: {
      impressions: funnel.viewed,
      selected: funnel.selected,
      reviews: reviewStats.reviewCount,
      skipped: funnel.skipped,
      selectionRate: funnel.selectionRate
    },
    aiInsight,
    sections: {
      menu: {
        title: 'Menu health',
        items: menuHealth
      },
      context: buildContextInsight(reviewStats.reviewBubbleCounts, restaurant),
      opportunity: buildOpportunity(touristMix)
    },
    reviewSummary: {
      averageRating: reviewStats.averageRating,
      reviewBubbleCounts: reviewStats.reviewBubbleCounts,
      topReviewBubbles: topEntries(reviewStats.reviewBubbleCounts, 5)
    },
    skipSummary: {
      skipReasonCounts,
      topSkipReasons: topEntries(skipReasonCounts, 5)
    },
    touristMix
  };
}
