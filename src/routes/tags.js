import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listTagCategories, listTags } from '../services/tagCatalogService.js';

export const tagsRouter = express.Router();

tagsRouter.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    const categories = await listTagCategories({ includeInactive });

    res.json({ data: categories });
  })
);

tagsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    const category = req.query.category ? String(req.query.category) : undefined;
    const tags = await listTags({ category, includeInactive });

    res.json({ data: tags });
  })
);
