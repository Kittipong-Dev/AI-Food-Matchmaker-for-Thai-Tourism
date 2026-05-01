import crypto from 'crypto';

const EMBEDDING_DIMENSION = 384;

function hashToUnitFloat(text) {
  const hash = crypto.createHash('sha256').update(text).digest();
  const value = hash.readUInt32BE(0);
  return value / 0xffffffff;
}

function createMockEmbedding(text) {
  const values = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => {
    const unit = hashToUnitFloat(`${index}:${text}`);
    return unit * 2 - 1;
  });

  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => value / norm);
}

export async function embedTextsWithMock(texts) {
  return {
    provider: 'mock',
    model: 'deterministic-mock-384',
    dimension: EMBEDDING_DIMENSION,
    embeddings: texts.map(createMockEmbedding)
  };
}
