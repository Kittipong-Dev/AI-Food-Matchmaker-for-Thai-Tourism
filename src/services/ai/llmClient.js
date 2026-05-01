import { env } from '../../config/env.js';
import { suggestMenuTagsWithMockLlm } from './mockLlmClient.js';

export async function suggestMenuTagsWithLlm(input) {
  // Phase 3 keeps the provider behind this interface. A real vendor-specific
  // client can be added here later without changing route/service code.
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
