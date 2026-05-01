import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { refreshEmbeddings } from '../services/embedding/embeddingService.js';

export const embeddingsRouter = express.Router();

embeddingsRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const result = await refreshEmbeddings({
      target: req.body?.target,
      language: req.body?.language,
      limit: req.body?.limit
    });

    res.json({ data: result });
  })
);
