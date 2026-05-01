import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { recommendRestaurants } from '../services/recommendationService.js';

export const recommendationsRouter = express.Router();

recommendationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = await recommendRestaurants(req.body || {});

    res.json(result);
  })
);
