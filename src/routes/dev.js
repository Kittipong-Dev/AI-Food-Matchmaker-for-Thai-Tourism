import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getDemoIds } from '../services/demoService.js';

export const devRouter = express.Router();

devRouter.get(
  '/demo-ids',
  asyncHandler(async (_req, res) => {
    const ids = await getDemoIds();

    res.json({ data: ids });
  })
);
