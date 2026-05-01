import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { updateMenuImage, updateRestaurantImage } from '../services/imageService.js';

export const imagesRouter = express.Router();

imagesRouter.put(
  '/restaurants/:restaurantId',
  asyncHandler(async (req, res) => {
    const image = await updateRestaurantImage(req.params.restaurantId, req.body || {});

    res.json({ data: image });
  })
);

imagesRouter.put(
  '/menus/:menuId',
  asyncHandler(async (req, res) => {
    const image = await updateMenuImage(req.params.menuId, req.body || {});

    res.json({ data: image });
  })
);
