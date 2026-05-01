import { env } from '../../config/env.js';
import { embedTextsWithMock } from './mockEmbeddingClient.js';

const EMBEDDING_DIMENSION = 384;
const EMBEDDING_TIMEOUT_MS = 30000;

function validateEmbeddings(embeddings) {
  if (!Array.isArray(embeddings)) {
    throw new Error('Embedding service response must include embeddings array');
  }

  for (const embedding of embeddings) {
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Embedding dimension must be ${EMBEDDING_DIMENSION}`);
    }
  }
}

async function embedTextsWithService(texts) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.embeddingServiceUrl.replace(/\/$/, '')}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, normalize: true }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Embedding service returned ${response.status}`);
    }

    const payload = await response.json();
    validateEmbeddings(payload.embeddings);

    return {
      provider: 'service',
      model: payload.model,
      dimension: payload.dimension || EMBEDDING_DIMENSION,
      embeddings: payload.embeddings
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function embedTexts(texts) {
  const normalizedTexts = texts.map((text) => String(text || ''));

  if (!env.embeddingServiceUrl) {
    return embedTextsWithMock(normalizedTexts);
  }

  try {
    return await embedTextsWithService(normalizedTexts);
  } catch (error) {
    const fallback = await embedTextsWithMock(normalizedTexts);

    return {
      ...fallback,
      provider: 'mock_fallback',
      warning: error.message || String(error)
    };
  }
}

export { EMBEDDING_DIMENSION };
