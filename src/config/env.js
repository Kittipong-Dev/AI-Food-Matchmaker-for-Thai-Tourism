import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  llmProvider: process.env.LLM_PROVIDER || '',
  llmApiKey: process.env.LLM_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL || '',
  openRouterAppName: process.env.OPENROUTER_APP_NAME || 'AI Local Food Matchmaker',
  embeddingApiKey: process.env.EMBEDDING_API_KEY || '',
  embeddingServiceUrl: process.env.EMBEDDING_SERVICE_URL || '',
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  serpApiKey: process.env.SERPAPI_API_KEY || '',
  transportDistanceProvider: process.env.TRANSPORT_DISTANCE_PROVIDER || ''
};

export function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
