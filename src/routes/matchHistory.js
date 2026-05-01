import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createMatchHistory } from '../services/matchHistoryService.js';

export const matchHistoryRouter = express.Router();

matchHistoryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = await createMatchHistory(req.body || {});

    res.status(201).json({ data: result });
  })
);
