import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getRestaurantDashboard } from '../services/dashboardInsightService.js';

export const dashboardRouter = express.Router();

dashboardRouter.get(
  '/restaurants/:restaurantId',
  asyncHandler(async (req, res) => {
    const dashboard = await getRestaurantDashboard(req.params.restaurantId, {
      days: req.query.days
    });

    res.json({ data: dashboard });
  })
);
