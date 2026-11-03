import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createDiningAreaSchema,
  createRestaurantTableSchema,
  updateDiningAreaSchema,
  updateRestaurantTableSchema,
} from './tables.schemas';
import * as svc from './tables.service';

export const tablesRouter = Router();
tablesRouter.use(requireAuth);

const idSchema = z.string().uuid();

tablesRouter.get('/branches/:branchId/areas', asyncHandler(async (req, res) => {
  const branchId = idSchema.safeParse(req.params.branchId);
  if (!branchId.success) return res.status(400).json({ error: 'Invalid branch ID' });

  res.json({ areas: await svc.listDiningAreas(branchId.data, req.user!.id) });
}));

tablesRouter.post(
  '/branches/:branchId/areas',
  validate(createDiningAreaSchema),
  asyncHandler(async (req, res) => {
    const branchId = idSchema.safeParse(req.params.branchId);
    if (!branchId.success) return res.status(400).json({ error: 'Invalid branch ID' });

    const area = await svc.createDiningArea(branchId.data, req.user!.id, req.body);
    res.status(201).json(area);
  }),
);

tablesRouter.patch(
  '/branches/:branchId/areas/:areaId',
  validate(updateDiningAreaSchema),
  asyncHandler(async (req, res) => {
    const branchId = idSchema.safeParse(req.params.branchId);
    const areaId = idSchema.safeParse(req.params.areaId);
    if (!branchId.success || !areaId.success) {
      return res.status(400).json({ error: 'Invalid branch or dining area ID' });
    }

    res.json(await svc.updateDiningArea(branchId.data, areaId.data, req.user!.id, req.body));
  }),
);

tablesRouter.delete('/branches/:branchId/areas/:areaId', asyncHandler(async (req, res) => {
  const branchId = idSchema.safeParse(req.params.branchId);
  const areaId = idSchema.safeParse(req.params.areaId);
  if (!branchId.success || !areaId.success) {
    return res.status(400).json({ error: 'Invalid branch or dining area ID' });
  }

  await svc.deleteDiningArea(branchId.data, areaId.data, req.user!.id);
  res.status(204).send();
}));

tablesRouter.get('/branches/:branchId/tables', asyncHandler(async (req, res) => {
  const branchId = idSchema.safeParse(req.params.branchId);
  if (!branchId.success) return res.status(400).json({ error: 'Invalid branch ID' });

  res.json({ tables: await svc.listRestaurantTables(branchId.data, req.user!.id) });
}));

tablesRouter.post(
  '/branches/:branchId/tables',
  validate(createRestaurantTableSchema),
  asyncHandler(async (req, res) => {
    const branchId = idSchema.safeParse(req.params.branchId);
    if (!branchId.success) return res.status(400).json({ error: 'Invalid branch ID' });

    const table = await svc.createRestaurantTable(branchId.data, req.user!.id, req.body);
    res.status(201).json(table);
  }),
);

tablesRouter.patch(
  '/branches/:branchId/tables/:tableId',
  validate(updateRestaurantTableSchema),
  asyncHandler(async (req, res) => {
    const branchId = idSchema.safeParse(req.params.branchId);
    const tableId = idSchema.safeParse(req.params.tableId);
    if (!branchId.success || !tableId.success) {
      return res.status(400).json({ error: 'Invalid branch or table ID' });
    }

    res.json(await svc.updateRestaurantTable(branchId.data, tableId.data, req.user!.id, req.body));
  }),
);

tablesRouter.delete('/branches/:branchId/tables/:tableId', asyncHandler(async (req, res) => {
  const branchId = idSchema.safeParse(req.params.branchId);
  const tableId = idSchema.safeParse(req.params.tableId);
  if (!branchId.success || !tableId.success) {
    return res.status(400).json({ error: 'Invalid branch or table ID' });
  }

  await svc.deleteRestaurantTable(branchId.data, tableId.data, req.user!.id);
  res.status(204).send();
}));
