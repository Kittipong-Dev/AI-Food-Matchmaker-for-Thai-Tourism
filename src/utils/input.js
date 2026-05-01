export function optionalString(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

export function requiredString(value, fieldName) {
  const normalized = optionalString(value);

  if (!normalized) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

export function optionalNumber(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    const error = new Error(`Expected number but received: ${value}`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

export function optionalInteger(value) {
  const parsed = optionalNumber(value);

  if (parsed === undefined || parsed === null) {
    return parsed;
  }

  if (!Number.isInteger(parsed)) {
    const error = new Error(`Expected integer but received: ${value}`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

export function optionalBoolean(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  const error = new Error(`Expected boolean but received: ${value}`);
  error.statusCode = 400;
  throw error;
}

export function optionalStringArray(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    const error = new Error('Expected an array of strings');
    error.statusCode = 400;
    throw error;
  }

  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

export function optionalJsonArray(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    const error = new Error('Expected an array');
    error.statusCode = 400;
    throw error;
  }

  return value;
}

export function optionalImageType(value) {
  const normalized = optionalString(value);

  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  if (!['real', 'ai_generated', 'placeholder'].includes(normalized)) {
    const error = new Error('imageType must be real, ai_generated, or placeholder');
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}
