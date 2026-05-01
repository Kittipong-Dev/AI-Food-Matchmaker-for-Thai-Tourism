import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createRestaurant,
  getRestaurantById,
  listRestaurants,
  updateRestaurant
} from '../services/restaurantService.js';
import {
  createMenu,
  listMenusByRestaurant
} from '../services/menuService.js';

export const restaurantsRouter = express.Router();

restaurantsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const restaurants = await listRestaurants({
      limit: req.query.limit,
      includeClosed: req.query.includeClosed === 'true'
    });

    res.json({ data: restaurants });
  })
);

restaurantsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const restaurant = await createRestaurant(req.body || {});

    res.status(201).json({ data: restaurant });
  })
);

restaurantsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const restaurant = await getRestaurantById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({ error: { message: 'Restaurant not found' } });
    }

    res.json({ data: restaurant });
  })
);

restaurantsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const restaurant = await updateRestaurant(req.params.id, req.body || {});

    if (!restaurant) {
      return res.status(404).json({ error: { message: 'Restaurant not found' } });
    }

    res.json({ data: restaurant });
  })
);

restaurantsRouter.get(
  '/:restaurantId/menus',
  asyncHandler(async (req, res) => {
    const menus = await listMenusByRestaurant(req.params.restaurantId);

    res.json({ data: menus });
  })
);

restaurantsRouter.post(
  '/:restaurantId/menus',
  asyncHandler(async (req, res) => {
    const menu = await createMenu(req.params.restaurantId, req.body || {});

    res.status(201).json({ data: menu });
  })
);
