import express from 'express';
import { query } from '../db/postgres.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const dbHealthRouter = express.Router();

dbHealthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const result = await query('select now() as now');

    res.json({
      ok: true,
      databaseTime: result.rows[0].now
    });
  })
);
