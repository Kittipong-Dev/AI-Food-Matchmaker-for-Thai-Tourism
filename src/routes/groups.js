import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createGroup,
  getGroupById,
  listGroupMembers,
  listGroups,
  removeGroupMember,
  updateGroup,
  upsertGroupMember
} from '../services/groupService.js';

export const groupsRouter = express.Router();

groupsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const groups = await listGroups({ userId: req.query.userId });

    res.json({ data: groups });
  })
);

groupsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const group = await createGroup(req.body || {});

    res.status(201).json({ data: group });
  })
);

groupsRouter.get(
  '/:groupId',
  asyncHandler(async (req, res) => {
    const group = await getGroupById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ error: { message: 'Group not found' } });
    }

    res.json({ data: group });
  })
);

groupsRouter.put(
  '/:groupId',
  asyncHandler(async (req, res) => {
    const group = await updateGroup(req.params.groupId, req.body || {});

    if (!group) {
      return res.status(404).json({ error: { message: 'Group not found' } });
    }

    res.json({ data: group });
  })
);

groupsRouter.get(
  '/:groupId/members',
  asyncHandler(async (req, res) => {
    const members = await listGroupMembers(req.params.groupId);

    res.json({ data: members });
  })
);

groupsRouter.post(
  '/:groupId/members',
  asyncHandler(async (req, res) => {
    const member = await upsertGroupMember(req.params.groupId, req.body || {});

    res.status(201).json({ data: member });
  })
);

groupsRouter.delete(
  '/:groupId/members/:userId',
  asyncHandler(async (req, res) => {
    const deleted = await removeGroupMember(req.params.groupId, req.params.userId);

    if (!deleted) {
      return res.status(404).json({ error: { message: 'Group member not found' } });
    }

    res.status(204).send();
  })
);
