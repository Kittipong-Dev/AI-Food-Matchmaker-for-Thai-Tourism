import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listMenuDictionaryEntries,
  searchMenuDictionary
} from '../services/menuDictionaryService.js';

export const menuDictionaryRouter = express.Router();

menuDictionaryRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const entries = await searchMenuDictionary({
      q: req.query.q,
      limit: req.query.limit
    });

    res.json({ data: entries });
  })
);

menuDictionaryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const entries = await listMenuDictionaryEntries({
      limit: req.query.limit
    });

    res.json({ data: entries });
  })
);
