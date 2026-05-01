import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createReview, listReviewsByRestaurant } from '../services/reviewService.js';

export const reviewsRouter = express.Router();

reviewsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const review = await createReview(req.body || {});

    res.status(201).json({ data: review });
  })
);

reviewsRouter.get(
  '/restaurant/:restaurantId',
  asyncHandler(async (req, res) => {
    const reviews = await listReviewsByRestaurant(req.params.restaurantId, {
      limit: req.query.limit
    });

    res.json({ data: reviews });
  })
);
