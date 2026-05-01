import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getUserPreference,
  upsertUserPreference
} from '../services/userPreferenceService.js';

export const userPreferencesRouter = express.Router();

userPreferencesRouter.get(
  '/:userId',
  asyncHandler(async (req, res) => {
    const preference = await getUserPreference(req.params.userId);

    if (!preference) {
      return res.status(404).json({ error: { message: 'User preference not found' } });
    }

    res.json({ data: preference });
  })
);

userPreferencesRouter.put(
  '/:userId',
  asyncHandler(async (req, res) => {
    const preference = await upsertUserPreference(req.params.userId, req.body || {});

    res.json({ data: preference });
  })
);
