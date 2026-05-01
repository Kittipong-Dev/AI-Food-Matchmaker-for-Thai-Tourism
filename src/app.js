import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { tagsRouter } from './routes/tags.js';
import { menuDictionaryRouter } from './routes/menuDictionary.js';
import { dbHealthRouter } from './routes/dbHealth.js';
import { menuSuggestionRouter } from './routes/menuSuggestion.js';
import { restaurantsRouter } from './routes/restaurants.js';
import { menusRouter } from './routes/menus.js';
import { embeddingsRouter } from './routes/embeddings.js';
import { recommendationsRouter } from './routes/recommendations.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'thai-food-matchmaker',
    phase: 6
  });
});

app.use('/api/tags', tagsRouter);
app.use('/api/menu-dictionary', menuDictionaryRouter);
app.use('/api/menu', menuSuggestionRouter);
app.use('/api/restaurants', restaurantsRouter);
app.use('/api/menus', menusRouter);
app.use('/api/embeddings', embeddingsRouter);
app.use('/api/recommend', recommendationsRouter);
app.use('/api/db', dbHealthRouter);

app.use((req, res) => {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
});

app.use((error, _req, res, _next) => {
  const missingDatabaseUrl = error.message?.includes('DATABASE_URL');
  const statusCode = error.statusCode || (missingDatabaseUrl ? 503 : 500);
  const developmentDetails =
    env.nodeEnv === 'development'
      ? {
          name: error.name,
          message: error.message || String(error),
          code: error.code,
          detail: error.detail,
          hint: error.hint,
          table: error.table,
          column: error.column,
          constraint: error.constraint
        }
      : undefined;

  if (statusCode >= 500) {
    console.error('Request failed:', {
      name: error.name,
      message: error.message || String(error),
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
  }

  res.status(statusCode).json({
    error: {
      message: missingDatabaseUrl
        ? 'Database is not configured. Set DATABASE_URL in .env.'
        : statusCode >= 500
          ? 'Internal server error'
          : error.message,
      detail: developmentDetails
    }
  });
});

export default app;
