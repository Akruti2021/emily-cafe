import crypto from 'crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../middleware/errorhandler';
import { roleHasPermission, type BranchPermission, type BranchRole } from '../organization/branch-access';

interface OrderAccessRow extends RowDataPacket {
  id: string;
  restaurantId: string;
  branchId: string;
  orderNumber: string;
  orderType: string;
  status: string;
  subtotal: string;
  discountType: 'NONE' | 'PERCENTAGE' | 'FLAT';
  discountValue: string;
  discountTotal: string;
  serviceChargeRate: string;
  serviceChargeTotal: string;
  taxTotal: string;
  roundOff: string;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  customerId: string | null;
  createdAt: Date;
  role: BranchRole;
  branchServiceChargeRate: string;
}

const toPaise = (amount: string | number) => Math.round(Number(amount) * 100);
const fromPaise = (paise: number) => Number((paise / 100).toFixed(2));

async function lockOrderWithPermission(
  connection: PoolConnection,
  userId: string,
  orderId: string,
  permission: BranchPermission,
): Promise<OrderAccessRow> {
  const [rows] = await connection.query<OrderAccessRow[]>(
    `SELECT o.id, o.restaurant_id AS restaurantId, o.branch_id AS branchId,
            o.order_number AS orderNumber, o.order_type AS orderType, o.status,
            o.subtotal, o.discount_type AS discountType, o.discount_value AS discountValue,
            o.discount_total AS discountTotal, o.service_charge_rate AS serviceChargeRate,
            o.service_charge_total AS serviceChargeTotal, o.tax_total AS taxTotal,
            o.round_off AS roundOff, o.grand_total AS grandTotal,
            o.amount_paid AS amountPaid, o.balance_due AS balanceDue,
            o.payment_status AS paymentStatus, o.customer_id AS customerId,
            o.created_at AS createdAt,
            b.service_charge_rate AS branchServiceChargeRate,
            CASE WHEN r.owner_user_id = ? THEN 'OWNER' ELSE bu.role END AS role
       FROM orders o
       JOIN branches b ON b.id = o.branch_id AND b.status = 'active'
       JOIN restaurants r ON r.id = o.restaurant_id AND r.status = 'active'
       LEFT JOIN branch_users bu ON bu.branch_id = b.id AND bu.user_id = ?
      WHERE o.id = ? AND (r.owner_user_id = ? OR bu.user_id = ?)
      LIMIT 1
      FOR UPDATE`,
    [userId, userId, orderId, userId, userId],
  );
  const order = rows[0];
  if (!order) throw new AppError(404, 'Order not found');
  if (!roleHasPermission(order.role, permission)) throw new AppError(403, 'Forbidden');
  return order;
}

async function writeAuditLog(
  connection: PoolConnection,
  params: {
    restaurantId: string;
    branchId: string;
    entityType: string;
    entityId: string;
    actorUserId: string;
    beforeState: unknown;
    afterState: unknown;
  },
) {
  await connection.query(
    `INSERT INTO financial_audit_logs
       (id, restaurant_id, branch_id, entity_type, entity_id, actor_user_id, before_state, after_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      params.restaurantId,
      params.branchId,
      params.entityType,
      params.entityId,
      params.actorUserId,
      params.beforeState ? JSON.stringify(params.beforeState) : null,
      JSON.stringify(params.afterState),
    ],
  );
}

export async function getOrderBilling(userId: string, orderId: string) {
  const connection = await pool.getConnection();
  try {
    const order = await lockOrderWithPermission(connection, userId, orderId, 'billing.view');

    const [items] = await connection.query<RowDataPacket[]>(
      `SELECT oi.id, oi.item_name_snapshot AS name, oi.unit_price AS unitPrice,
              oi.quantity, oi.line_total AS lineTotal,
              COALESCE(mi.tax_rate, 0) AS taxRate
         FROM order_items oi
         LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.order_id = ?`,
      [orderId],
    );

    const [taxBreakdowns] = await connection.query<RowDataPacket[]>(
      `SELECT tax_name AS taxName, tax_rate AS taxRate,
              taxable_amount AS taxableAmount, tax_amount AS taxAmount
         FROM order_tax_breakdowns WHERE order_id = ?`,
      [orderId],
    );

    const [payments] = await connection.query<RowDataPacket[]>(
      `SELECT p.id, p.payment_method AS paymentMethod, p.amount,
              p.tendered_amount AS tenderedAmount, p.change_returned AS changeReturned,
              p.reference_number AS referenceNumber, p.status, p.notes,
              p.created_at AS createdAt, u.name AS recordedByName
         FROM order_payments p
         JOIN users u ON u.id = p.recorded_by_id
        WHERE p.order_id = ?
        ORDER BY p.created_at ASC`,
      [orderId],
    );

    const [refunds] = await connection.query<RowDataPacket[]>(
      `SELECT rf.id, rf.payment_id AS paymentId, rf.refund_method AS refundMethod,
              rf.amount, rf.reason, rf.reference_number AS referenceNumber,
              rf.created_at AS createdAt, u.name AS refundedByName
         FROM payment_refunds rf
         JOIN users u ON u.id = rf.refunded_by_id
        WHERE rf.order_id = ?
        ORDER BY rf.created_at ASC`,
      [orderId],
    );

    const [invoices] = await connection.query<RowDataPacket[]>(
      `SELECT id, invoice_number AS invoiceNumber, issued_at AS issuedAt
         FROM invoices WHERE order_id = ? LIMIT 1`,
      [orderId],
    );

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: Number(order.subtotal),
        discountType: order.discountType,
        discountValue: Number(order.discountValue),
        discountTotal: Number(order.discountTotal),
        serviceChargeRate: Number(order.serviceChargeRate),
        serviceChargeTotal: Number(order.serviceChargeTotal),
        taxTotal: Number(order.taxTotal),
        roundOff: Number(order.roundOff),
        grandTotal: Number(order.grandTotal),
        amountPaid: Number(order.amountPaid),
        balanceDue: Number(order.balanceDue),
        paymentStatus: order.paymentStatus,
      },
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        unitPrice: Number(i.unitPrice),
        quantity: Number(i.quantity),
        lineTotal: Number(i.lineTotal),
        taxRate: Number(i.taxRate),
      })),
      taxBreakdowns: taxBreakdowns.map((t) => ({
        taxName: t.taxName,
        taxRate: Number(t.taxRate),
        taxableAmount: Number(t.taxableAmount),
        taxAmount: Number(t.taxAmount),
      })),
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        tenderedAmount: p.tenderedAmount !== null ? Number(p.tenderedAmount) : null,
        changeReturned: Number(p.changeReturned),
      })),
      refunds: refunds.map((r) => ({ ...r, amount: Number(r.amount) })),
      invoice: invoices[0] ?? null,
    };
  } finally {
    connection.release();
  }
}

export async function calculateOrderBill(
  userId: string,
  orderId: string,
  input: {
    discountType: 'NONE' | 'PERCENTAGE' | 'FLAT';
    discountValue: number;
    applyServiceCharge: boolean;
    applyRoundOff: boolean;
  },
) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const order = await lockOrderWithPermission(connection, userId, orderId, 'billing.view');

    if (input.discountType !== 'NONE' && input.discountValue > 0) {
      if (!roleHasPermission(order.role, 'discounts.apply')) {
        throw new AppError(403, 'You do not have permission to apply discounts');
      }
    }
    if (order.status === 'CANCELLED') {
      throw new AppError(409, 'Cannot recalculate a cancelled order');
    }

    // Recompute subtotal strictly from stored order_items snapshots
    const [items] = await connection.query<Array<RowDataPacket & { lineTotal: string; taxRate: string }>>(
      `SELECT oi.line_total AS lineTotal, COALESCE(mi.tax_rate, 0) AS taxRate
         FROM order_items oi
         LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.order_id = ?`,
      [orderId],
    );

    const subtotalPaise = items.reduce((sum, item) => sum + toPaise(item.lineTotal), 0);

    // Discount calculation in integer paise
    let discountPaise = 0;
    if (input.discountType === 'PERCENTAGE') {
      if (input.discountValue > 100) throw new AppError(400, 'Percentage discount cannot exceed 100%');
      const bps = Math.round(input.discountValue * 100);
      discountPaise = Math.round((subtotalPaise * bps) / 10000);
    } else if (input.discountType === 'FLAT') {
      discountPaise = Math.min(toPaise(input.discountValue), subtotalPaise);
    }

    const discountedSubtotalPaise = Math.max(0, subtotalPaise - discountPaise);

    // Service charge
    const scRate = input.applyServiceCharge ? Number(order.branchServiceChargeRate) : 0;
    const serviceChargePaise = Math.round((discountedSubtotalPaise * Math.round(scRate * 100)) / 10000);

    // Proportional tax calculation per item after discount
    let totalTaxPaise = 0;
    const taxBuckets = new Map<string, { taxName: string; taxRate: number; taxablePaise: number; taxPaise: number }>();

    for (const item of items) {
      const itemPaise = toPaise(item.lineTotal);
      const itemShareOfDiscount = subtotalPaise > 0 ? Math.round((discountPaise * itemPaise) / subtotalPaise) : 0;
      const itemTaxablePaise = Math.max(0, itemPaise - itemShareOfDiscount);
      const fullRate = Number(item.taxRate);
      if (fullRate > 0) {
        const halfRate = Number((fullRate / 2).toFixed(2));
        const cgstPaise = Math.round((itemTaxablePaise * Math.round(halfRate * 100)) / 10000);
        const sgstPaise = Math.round((itemTaxablePaise * Math.round(halfRate * 100)) / 10000);
        totalTaxPaise += cgstPaise + sgstPaise;

        for (const [label, paise] of [['CGST', cgstPaise], ['SGST', sgstPaise]] as const) {
          const key = `${label}_${halfRate}`;
          const existing = taxBuckets.get(key) ?? { taxName: label, taxRate: halfRate, taxablePaise: 0, taxPaise: 0 };
          existing.taxablePaise += itemTaxablePaise;
          existing.taxPaise += paise;
          taxBuckets.set(key, existing);
        }
      }
    }

    const rawTotalPaise = discountedSubtotalPaise + serviceChargePaise + totalTaxPaise;
    const roundedTotalPaise = input.applyRoundOff ? Math.round(rawTotalPaise / 100) * 100 : rawTotalPaise;
    const roundOffPaise = roundedTotalPaise - rawTotalPaise;

    const paidPaise = toPaise(order.amountPaid);
    const balanceDuePaise = Math.max(0, roundedTotalPaise - paidPaise);

    let paymentStatus = order.paymentStatus;
    if (paidPaise === 0) paymentStatus = 'UNPAID';
    else if (paidPaise < roundedTotalPaise) paymentStatus = 'PARTIALLY_PAID';
    else if (paymentStatus !== 'PARTIALLY_REFUNDED' && paymentStatus !== 'REFUNDED') paymentStatus = 'PAID';

    await connection.query(
      `UPDATE orders
          SET subtotal = ?, discount_type = ?, discount_value = ?, discount_total = ?,
              service_charge_rate = ?, service_charge_total = ?, tax_total = ?,
              round_off = ?, grand_total = ?, balance_due = ?, payment_status = ?
        WHERE id = ?`,
      [
        fromPaise(subtotalPaise),
        input.discountType,
        input.discountValue,
        fromPaise(discountPaise),
        scRate,
        fromPaise(serviceChargePaise),
        fromPaise(totalTaxPaise),
        fromPaise(roundOffPaise),
        fromPaise(roundedTotalPaise),
        fromPaise(balanceDuePaise),
        paymentStatus,
        orderId,
      ],
    );

    await connection.query('DELETE FROM order_tax_breakdowns WHERE order_id = ?', [orderId]);
    for (const bucket of taxBuckets.values()) {
      await connection.query(
        `INSERT INTO order_tax_breakdowns (id, order_id, tax_name, tax_rate, taxable_amount, tax_amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), orderId, bucket.taxName, bucket.taxRate, fromPaise(bucket.taxablePaise), fromPaise(bucket.taxPaise)],
      );
    }

    await writeAuditLog(connection, {
      restaurantId: order.restaurantId,
      branchId: order.branchId,
      entityType: 'BILL_RECALCULATION',
      entityId: orderId,
      actorUserId: userId,
      beforeState: { grandTotal: Number(order.grandTotal), discountTotal: Number(order.discountTotal) },
      afterState: { grandTotal: fromPaise(roundedTotalPaise), discountTotal: fromPaise(discountPaise) },
    });

    await connection.commit();
    return getOrderBilling(userId, orderId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function recordOrderPayments(
  userId: string,
  orderId: string,
  input: {
    idempotencyKey: string;
    payments: Array<{
      paymentMethod: 'CASH' | 'CARD' | 'UPI';
      amount: number;
      tenderedAmount?: number;
      referenceNumber?: string;
      notes?: string;
    }>;
  },
) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const order = await lockOrderWithPermission(connection, userId, orderId, 'payments.record');

    if (order.status === 'CANCELLED') {
      throw new AppError(409, 'Cannot record payment for a cancelled order');
    }

    // Idempotency check
    const [existing] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM order_payments WHERE branch_id = ? AND idempotency_key LIKE ? LIMIT 1`,
      [order.branchId, `${input.idempotencyKey}%`],
    );
    if (existing.length > 0) {
      await connection.commit();
      return getOrderBilling(userId, orderId);
    }

    const currentBalancePaise = toPaise(order.balanceDue);
    if (currentBalancePaise <= 0) {
      throw new AppError(409, 'Order is already fully paid');
    }

    const batchTotalPaise = input.payments.reduce((sum, p) => sum + toPaise(p.amount), 0);
    if (batchTotalPaise > currentBalancePaise) {
      throw new AppError(400, `Payment total (${fromPaise(batchTotalPaise)}) exceeds balance due (${fromPaise(currentBalancePaise)})`);
    }

    for (let idx = 0; idx < input.payments.length; idx++) {
      const p = input.payments[idx];
      const amountPaise = toPaise(p.amount);
      let tenderedPaise: number | null = null;
      let changePaise = 0;

      if (p.paymentMethod === 'CASH' && p.tenderedAmount !== undefined) {
        tenderedPaise = toPaise(p.tenderedAmount);
        if (tenderedPaise < amountPaise) {
          throw new AppError(400, 'Cash tendered amount cannot be less than applied cash payment');
        }
        changePaise = tenderedPaise - amountPaise;
      }

      const paymentId = crypto.randomUUID();
      const rowKey = input.payments.length === 1 ? input.idempotencyKey : `${input.idempotencyKey}:${idx}`;

      await connection.query(
        `INSERT INTO order_payments
           (id, restaurant_id, branch_id, order_id, payment_method, amount,
            tendered_amount, change_returned, reference_number, status,
            idempotency_key, notes, recorded_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)`,
        [
          paymentId,
          order.restaurantId,
          order.branchId,
          orderId,
          p.paymentMethod,
          fromPaise(amountPaise),
          tenderedPaise !== null ? fromPaise(tenderedPaise) : null,
          fromPaise(changePaise),
          p.referenceNumber ?? null,
          rowKey,
          p.notes ?? null,
          userId,
        ],
      );

      await writeAuditLog(connection, {
        restaurantId: order.restaurantId,
        branchId: order.branchId,
        entityType: 'PAYMENT_RECORDED',
        entityId: paymentId,
        actorUserId: userId,
        beforeState: null,
        afterState: { orderId, method: p.paymentMethod, amount: fromPaise(amountPaise) },
      });
    }

    const newPaidPaise = toPaise(order.amountPaid) + batchTotalPaise;
    const grandTotalPaise = toPaise(order.grandTotal);
    const newBalancePaise = Math.max(0, grandTotalPaise - newPaidPaise);
    const newPaymentStatus = newBalancePaise === 0 ? 'PAID' : 'PARTIALLY_PAID';

    await connection.query(
      `UPDATE orders SET amount_paid = ?, balance_due = ?, payment_status = ? WHERE id = ?`,
      [fromPaise(newPaidPaise), fromPaise(newBalancePaise), newPaymentStatus, orderId],
    );

    await connection.commit();
    return getOrderBilling(userId, orderId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function refundOrderPayment(
  userId: string,
  orderId: string,
  paymentId: string,
  input: {
    idempotencyKey: string;
    refundMethod: 'CASH' | 'CARD' | 'UPI';
    amount: number;
    reason: string;
    referenceNumber?: string;
  },
) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const order = await lockOrderWithPermission(connection, userId, orderId, 'payments.refund');

    const [dup] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM payment_refunds WHERE branch_id = ? AND idempotency_key = ? LIMIT 1`,
      [order.branchId, input.idempotencyKey],
    );
    if (dup.length > 0) {
      await connection.commit();
      return getOrderBilling(userId, orderId);
    }

    const [payRows] = await connection.query<Array<RowDataPacket & { id: string; amount: string; status: string }>>(
      `SELECT id, amount, status FROM order_payments WHERE id = ? AND order_id = ? LIMIT 1 FOR UPDATE`,
      [paymentId, orderId],
    );
    const payment = payRows[0];
    if (!payment || payment.status !== 'COMPLETED') {
      throw new AppError(404, 'Completed payment record not found');
    }

    const [refundSumRows] = await connection.query<Array<RowDataPacket & { refunded: string }>>(
      `SELECT COALESCE(SUM(amount), 0) AS refunded FROM payment_refunds WHERE payment_id = ?`,
      [paymentId],
    );
    const alreadyRefundedPaise = toPaise(refundSumRows[0]?.refunded ?? 0);
    const paymentPaise = toPaise(payment.amount);
    const refundPaise = toPaise(input.amount);

    if (refundPaise > paymentPaise - alreadyRefundedPaise) {
      throw new AppError(400, `Refund exceeds remaining refundable amount (${fromPaise(paymentPaise - alreadyRefundedPaise)})`);
    }

    const refundId = crypto.randomUUID();
    await connection.query(
      `INSERT INTO payment_refunds
         (id, restaurant_id, branch_id, order_id, payment_id, refund_method,
          amount, reason, reference_number, idempotency_key, refunded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        refundId,
        order.restaurantId,
        order.branchId,
        orderId,
        paymentId,
        input.refundMethod,
        fromPaise(refundPaise),
        input.reason,
        input.referenceNumber ?? null,
        input.idempotencyKey,
        userId,
      ],
    );

    const newPaidPaise = Math.max(0, toPaise(order.amountPaid) - refundPaise);
    const newBalancePaise = Math.max(0, toPaise(order.grandTotal) - newPaidPaise);
    const newPaymentStatus = newPaidPaise === 0 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    await connection.query(
      `UPDATE orders SET amount_paid = ?, balance_due = ?, payment_status = ? WHERE id = ?`,
      [fromPaise(newPaidPaise), fromPaise(newBalancePaise), newPaymentStatus, orderId],
    );

    await writeAuditLog(connection, {
      restaurantId: order.restaurantId,
      branchId: order.branchId,
      entityType: 'REFUND_ISSUED',
      entityId: refundId,
      actorUserId: userId,
      beforeState: { paymentStatus: order.paymentStatus, amountPaid: Number(order.amountPaid) },
      afterState: { refundId, paymentId, amount: fromPaise(refundPaise), reason: input.reason },
    });

    await connection.commit();
    return getOrderBilling(userId, orderId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function generateOrGetInvoice(userId: string, orderId: string) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const order = await lockOrderWithPermission(connection, userId, orderId, 'billing.view');

    const [existing] = await connection.query<RowDataPacket[]>(
      `SELECT id, invoice_number AS invoiceNumber, gstin, customer_name AS customerName,
              customer_phone AS customerPhone, invoice_snapshot AS invoiceSnapshot, issued_at AS issuedAt
         FROM invoices WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    if (existing[0]) {
      await connection.commit();
      return {
        ...existing[0],
        invoiceSnapshot: typeof existing[0].invoiceSnapshot === 'string'
          ? JSON.parse(existing[0].invoiceSnapshot)
          : existing[0].invoiceSnapshot,
      };
    }

    const [metaRows] = await connection.query<RowDataPacket[]>(
      `SELECT r.name AS restaurantName, r.address AS restaurantAddress, r.gstin AS restaurantGstin,
              b.code AS branchCode, b.name AS branchName, b.address AS branchAddress,
              b.gstin AS branchGstin, b.phone AS branchPhone,
              c.name AS customerName, c.phone AS customerPhone
         FROM branches b
         JOIN restaurants r ON r.id = b.restaurant_id
         LEFT JOIN customers c ON c.id = ?
        WHERE b.id = ? LIMIT 1`,
      [order.customerId, order.branchId],
    );
    const meta = metaRows[0];

    const [countRows] = await connection.query<Array<RowDataPacket & { cnt: number }>>(
      `SELECT COUNT(*) AS cnt FROM invoices WHERE branch_id = ? FOR UPDATE`,
      [order.branchId],
    );
    const seq = String(Number(countRows[0]?.cnt ?? 0) + 1).padStart(4, '0');
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
    const invoiceNumber = `INV-${meta.branchCode}-${yyyymm}-${seq}`;
    const gstin = meta.branchGstin || meta.restaurantGstin || null;

    const billingData = await getOrderBilling(userId, orderId);
    const snapshot = {
      restaurantName: meta.restaurantName,
      restaurantAddress: meta.restaurantAddress,
      branchName: meta.branchName,
      branchAddress: meta.branchAddress,
      branchPhone: meta.branchPhone,
      gstin,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      customerName: meta.customerName ?? null,
      customerPhone: meta.customerPhone ?? null,
      ...billingData,
    };

    const invoiceId = crypto.randomUUID();
    await connection.query(
      `INSERT INTO invoices
         (id, restaurant_id, branch_id, order_id, invoice_number, gstin,
          customer_name, customer_phone, invoice_snapshot, issued_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        order.restaurantId,
        order.branchId,
        orderId,
        invoiceNumber,
        gstin,
        meta.customerName ?? null,
        meta.customerPhone ?? null,
        JSON.stringify(snapshot),
        userId,
      ],
    );

    await writeAuditLog(connection, {
      restaurantId: order.restaurantId,
      branchId: order.branchId,
      entityType: 'INVOICE_GENERATED',
      entityId: invoiceId,
      actorUserId: userId,
      beforeState: null,
      afterState: { invoiceNumber, orderId },
    });

    await connection.commit();
    return {
      id: invoiceId,
      invoiceNumber,
      gstin,
      customerName: meta.customerName ?? null,
      customerPhone: meta.customerPhone ?? null,
      invoiceSnapshot: snapshot,
      issuedAt: new Date(),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}