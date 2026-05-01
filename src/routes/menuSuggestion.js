import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { suggestMenuDetails } from '../services/menuSuggestionService.js';

export const menuSuggestionRouter = express.Router();

menuSuggestionRouter.post(
  '/suggest-tags',
  asyncHandler(async (req, res) => {
    const suggestion = await suggestMenuDetails({
      menuName: req.body?.menuName,
      language: req.body?.language
    });

    res.json({ data: suggestion });
  })
);
