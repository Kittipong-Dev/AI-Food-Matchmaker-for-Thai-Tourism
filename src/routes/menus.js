import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getMenuById, updateMenu } from '../services/menuService.js';

export const menusRouter = express.Router();

menusRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const menu = await getMenuById(req.params.id);

    if (!menu) {
      return res.status(404).json({ error: { message: 'Menu not found' } });
    }

    res.json({ data: menu });
  })
);

menusRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const menu = await updateMenu(req.params.id, req.body || {});

    if (!menu) {
      return res.status(404).json({ error: { message: 'Menu not found' } });
    }

    res.json({ data: menu });
  })
);
