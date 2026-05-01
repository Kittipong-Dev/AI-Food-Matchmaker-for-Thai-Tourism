import { env } from '../config/env.js';

const MODE_MAP = {
  walking: 'WALK',
  walk: 'WALK',
  driving: 'DRIVE',
  drive: 'DRIVE',
  taxi: 'DRIVE',
  car: 'DRIVE',
  motorbike: 'TWO_WHEELER',
  motorcycle: 'TWO_WHEELER',
  two_wheeler: 'TWO_WHEELER',
  public_transit: 'TRANSIT',
  transit: 'TRANSIT'
};

const SERPAPI_MODE_MAP = {
  walking: '2',
  walk: '2',
  driving: '0',
  drive: '0',
  taxi: '0',
  car: '0',
  motorbike: '9',
  motorcycle: '9',
  two_wheeler: '9',
  public_transit: '3',
  transit: '3',
  cycling: '1',
  bicycle: '1'
};

function normalizeMode(mode) {
  return MODE_MAP[String(mode || '').toLowerCase()] || 'DRIVE';
}

function normalizeSerpApiMode(mode) {
  return SERPAPI_MODE_MAP[String(mode || '').toLowerCase()] || '0';
}

function parseDurationSeconds(duration) {
  const match = String(duration || '').match(/^(\d+(?:\.\d+)?)s$/);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function haversineDistanceKm(origin, destination) {
  const earthRadiusKm = 6371;
  const lat1 = Number(origin.lat);
  const lng1 = Number(origin.lng);
  const lat2 = Number(destination.lat);
  const lng2 = Number(destination.lng);

  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return null;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function estimateSpeedKmh(transportMode) {
  const normalized = String(transportMode || '').toLowerCase();

  if (['walking', 'walk'].includes(normalized)) {
    return 5;
  }

  if (['cycling', 'bicycle'].includes(normalized)) {
    return 14;
  }

  if (['motorbike', 'motorcycle', 'two_wheeler'].includes(normalized)) {
    return 28;
  }

  if (['public_transit', 'transit'].includes(normalized)) {
    return 20;
  }

  return 30;
}

function buildStraightLineFallback({ origin, destination, transportMode, provider, sourceWarning }) {
  const distanceKm = haversineDistanceKm(origin, destination);

  if (distanceKm === null) {
    return {
      provider,
      mode: transportMode || 'driving',
      warning: sourceWarning || 'Unable to estimate fallback route distance.'
    };
  }

  if (distanceKm < 0.05) {
    return {
      provider,
      mode: transportMode || 'driving',
      durationSeconds: 0,
      durationMinutes: 0,
      distanceMeters: Math.round(distanceKm * 1000),
      distanceKm: Math.round(distanceKm * 100) / 100,
      estimateType: 'same_or_nearby_location',
      sourceWarning
    };
  }

  const speedKmh = estimateSpeedKmh(transportMode);
  const durationMinutes = Math.round((distanceKm / speedKmh) * 60 * 10) / 10;

  return {
    provider,
    mode: transportMode || 'driving',
    durationSeconds: Math.round(durationMinutes * 60),
    durationMinutes,
    distanceMeters: Math.round(distanceKm * 1000),
    distanceKm: Math.round(distanceKm * 10) / 10,
    estimateType: 'straight_line_fallback',
    sourceWarning
  };
}

function canUseGoogleRoutes() {
  return env.googleMapsApiKey && env.transportDistanceProvider === 'google';
}

function canUseSerpApiDirections() {
  return env.serpApiKey && env.transportDistanceProvider === 'serpapi';
}

async function getGoogleRouteEstimate({ origin, destination, transportMode }) {
  const closeFallback = buildStraightLineFallback({
    origin,
    destination,
    transportMode,
    provider: 'google_routes'
  });

  if (closeFallback.estimateType === 'same_or_nearby_location') {
    return closeFallback;
  }

  const travelMode = normalizeMode(transportMode);
  const body = {
    origin: {
      location: {
        latLng: {
          latitude: Number(origin.lat),
          longitude: Number(origin.lng)
        }
      }
    },
    destination: {
      location: {
        latLng: {
          latitude: Number(destination.lat),
          longitude: Number(destination.lng)
        }
      }
    },
    travelMode
  };

  if (travelMode === 'DRIVE' || travelMode === 'TWO_WHEELER') {
    body.routingPreference = 'TRAFFIC_AWARE';
  }

  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': env.googleMapsApiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload.error?.message || `Google Routes request failed with ${response.status}`;
      throw new Error(message);
    }

    const route = payload.routes?.[0];

    if (!route) {
      return {
        provider: 'google_routes',
        mode: transportMode || 'driving',
        warning: 'No route returned by Google Routes API.'
      };
    }

    const durationSeconds = parseDurationSeconds(route.duration);
    const distanceMeters = Number(route.distanceMeters);

    return {
      provider: 'google_routes',
      mode: transportMode || 'driving',
      durationSeconds,
      durationMinutes:
        durationSeconds === null ? null : Math.round((durationSeconds / 60) * 10) / 10,
      distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
      distanceKm: Number.isFinite(distanceMeters)
        ? Math.round((distanceMeters / 1000) * 10) / 10
        : null
    };
  } catch (error) {
    return {
      provider: 'google_routes',
      mode: transportMode || 'driving',
      warning: error.message
    };
  }
}

async function getSerpApiRouteEstimate({ origin, destination, transportMode }) {
  const closeFallback = buildStraightLineFallback({
    origin,
    destination,
    transportMode,
    provider: 'serpapi_google_maps'
  });

  if (closeFallback.estimateType === 'same_or_nearby_location') {
    return closeFallback;
  }

  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('engine', 'google_maps_directions');
  url.searchParams.set('api_key', env.serpApiKey);
  url.searchParams.set('start_coords', `${Number(origin.lat)},${Number(origin.lng)}`);
  url.searchParams.set('end_coords', `${Number(destination.lat)},${Number(destination.lng)}`);
  url.searchParams.set('travel_mode', normalizeSerpApiMode(transportMode));
  url.searchParams.set('distance_unit', '0');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('gl', 'th');
  url.searchParams.set('output', 'json');

  try {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.error) {
      const message = payload.error || `SerpApi request failed with ${response.status}`;
      throw new Error(message);
    }

    const direction = payload.directions?.[0];

    if (!direction) {
      return {
        provider: 'serpapi_google_maps',
        mode: transportMode || 'driving',
        warning: 'No route returned by SerpApi Google Maps Directions API.'
      };
    }

    const durationSeconds = Number(direction.duration);
    const distanceMeters = Number(direction.distance);

    return {
      provider: 'serpapi_google_maps',
      mode: transportMode || 'driving',
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
      durationMinutes: Number.isFinite(durationSeconds)
        ? Math.round((durationSeconds / 60) * 10) / 10
        : null,
      distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
      distanceKm: Number.isFinite(distanceMeters)
        ? Math.round((distanceMeters / 1000) * 10) / 10
        : null,
      formattedDuration: direction.formatted_duration,
      formattedDistance: direction.formatted_distance
    };
  } catch (error) {
    if (String(error.message || '').toLowerCase().includes("hasn't returned any results")) {
      return buildStraightLineFallback({
        origin,
        destination,
        transportMode,
        provider: 'serpapi_google_maps_fallback',
        sourceWarning: error.message
      });
    }

    return {
      provider: 'serpapi_google_maps',
      mode: transportMode || 'driving',
      warning: error.message
    };
  }
}

export async function getRouteEstimate({ origin, destination, transportMode }) {
  if (!origin || !destination) {
    return null;
  }

  if (canUseSerpApiDirections()) {
    return getSerpApiRouteEstimate({ origin, destination, transportMode });
  }

  if (canUseGoogleRoutes()) {
    return getGoogleRouteEstimate({ origin, destination, transportMode });
  }

  return null;
}
