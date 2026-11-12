import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createCustomerSchema, customerIdSchema, listCustomersSchema, updateCustomerSchema } from './customers.schemas';
import * as service from './customers.service';

export const customersRouter = Router();
customersRouter.use(requireAuth);

customersRouter.get('/', asyncHandler(async (req, res) => {
  const { branchId, q } = listCustomersSchema.parse(req.query);
  res.json(await service.listCustomers(req.user!.id, branchId, q));
}));

customersRouter.post('/', asyncHandler(async (req, res) => {
  const input = createCustomerSchema.parse(req.body);
  res.status(201).json(await service.createCustomer(req.user!.id, input));
}));

customersRouter.patch('/:customerId', asyncHandler(async (req, res) => {
  const customerId = customerIdSchema.parse(req.params.customerId);
  const input = updateCustomerSchema.parse(req.body);
  res.json(await service.updateCustomer(req.user!.id, input.branchId, customerId, input));
}));

customersRouter.get('/:customerId/orders', asyncHandler(async (req, res) => {
  const customerId = customerIdSchema.parse(req.params.customerId);
  const { branchId } = listCustomersSchema.pick({ branchId: true }).parse(req.query);
  res.json(await service.listCustomerOrders(req.user!.id, branchId, customerId));
}));
