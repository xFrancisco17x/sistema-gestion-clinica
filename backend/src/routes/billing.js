const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// Helper: generate invoice number
const generateInvoiceNumber = async () => {
    const year = new Date().getFullYear();
    const count = await prisma.invoice.count({ where: { invoiceNumber: { startsWith: `FAC-${year}` } } });
    return `FAC-${year}-${String(count + 1).padStart(6, '0')}`;
};

// ============ SERVICES CATALOG ============

// GET /api/billing/services
router.get('/services', authenticate, async (req, res) => {
    try {
        const { category, search } = req.query;
        const where = { isActive: true };
        if (category) where.category = category;
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { code: { contains: search } }
            ];
        }
        const services = await prisma.service.findMany({ where, orderBy: { name: 'asc' } });
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener servicios' });
    }
});

// POST /api/billing/services
router.post('/services', authenticate, requirePermission('billing', 'create'), async (req, res) => {
    try {
        const { code, name, description, price, category } = req.body;
        if (!code || !name || price === undefined) {
            return res.status(400).json({ error: 'code, name y price son requeridos' });
        }
        const service = await prisma.service.create({
            data: { code, name, description, price: parseFloat(price), category: category || 'consultation' }
        });
        res.status(201).json(service);
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'Ya existe un servicio con este código' });
        res.status(500).json({ error: 'Error al crear servicio' });
    }
});

// ============ INVOICES ============

// GET /api/billing/invoices
router.get('/invoices', authenticate, requirePermission('billing', 'read'), async (req, res) => {
    try {
        const { patientId, status, paymentStatus, startDate, endDate, page = 1, limit = 20 } = req.query;
        const where = { deletedAt: null };

        if (patientId) where.patientId = parseInt(patientId);
        if (status) where.status = status;
        if (paymentStatus) where.paymentStatus = paymentStatus;
        if (startDate && endDate) {
            where.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true, idNumber: true } },
                    details: { include: { service: true } },
                    payments: true
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.invoice.count({ where })
        ]);

        res.json({
            data: invoices,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener facturas' });
    }
});

// GET /api/billing/invoices/:id
router.get('/invoices/:id', authenticate, requirePermission('billing', 'read'), async (req, res) => {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                patient: true,
                attention: true,
                details: { include: { service: true } },
                payments: true
            }
        });
        if (!invoice || invoice.deletedAt) return res.status(404).json({ error: 'Factura no encontrada' });
        res.json(invoice);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener factura' });
    }
});

// POST /api/billing/invoices — Create invoice
router.post('/invoices', authenticate, requirePermission('billing', 'create'), async (req, res) => {
    try {
        const { patientId, attentionId, items, notes, taxRate = 0 } = req.body;

        if (!patientId || !items || !items.length) {
            return res.status(400).json({ error: 'patientId e items son requeridos' });
        }

        const invoiceNumber = await generateInvoiceNumber();

        let subtotal = 0;
        const detailsData = items.map(item => {
            const itemSubtotal = item.quantity * item.unitPrice;
            subtotal += itemSubtotal;
            return {
                serviceId: item.serviceId || null,
                description: item.description,
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice,
                subtotal: itemSubtotal
            };
        });

        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber,
                patientId: parseInt(patientId),
                attentionId: attentionId ? parseInt(attentionId) : null,
                subtotal,
                tax,
                total,
                notes: notes || null,
                status: 'draft',
                paymentStatus: 'pending',
                details: { create: detailsData }
            },
            include: {
                patient: { select: { firstName: true, lastName: true, idNumber: true } },
                details: { include: { service: true } },
                payments: true
            }
        });

        await auditLog(req.user.id, 'CREATE', 'billing', 'Invoice', invoice.id, null, invoice, req);
        res.status(201).json(invoice);
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Error al crear factura' });
    }
});

// PUT /api/billing/invoices/:id/issue — Issue (emit) invoice
router.put('/invoices/:id/issue', authenticate, requirePermission('billing', 'update'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma.invoice.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Factura no encontrada' });
        if (existing.status !== 'draft') return res.status(400).json({ error: 'Solo se pueden emitir facturas en borrador' });

        const updated = await prisma.invoice.update({
            where: { id },
            data: { status: 'issued', issuedAt: new Date() }
        });

        await auditLog(req.user.id, 'ISSUE', 'billing', 'Invoice', id, existing, updated, req);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error al emitir factura' });
    }
});

// PUT /api/billing/invoices/:id/cancel — Cancel invoice
router.put('/invoices/:id/cancel', authenticate, requirePermission('billing', 'update'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { reason } = req.body;

        const existing = await prisma.invoice.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Factura no encontrada' });

        const updated = await prisma.invoice.update({
            where: { id },
            data: { status: 'cancelled', notes: reason ? `[ANULADA] ${reason}` : '[ANULADA]' }
        });

        await auditLog(req.user.id, 'CANCEL', 'billing', 'Invoice', id, existing, updated, req);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error al anular factura' });
    }
});

// ============ PAYMENTS ============

// POST /api/billing/invoices/:id/payments — Register payment
router.post('/invoices/:id/payments', authenticate, requirePermission('billing', 'create'), async (req, res) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const { amount, method, reference, notes } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'amount debe ser mayor a 0' });
        }

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { payments: true }
        });

        if (!invoice || invoice.deletedAt) return res.status(404).json({ error: 'Factura no encontrada' });
        if (invoice.status === 'cancelled') return res.status(400).json({ error: 'No se puede pagar una factura anulada' });

        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = invoice.total - totalPaid;

        if (amount > remaining + 0.01) {
            return res.status(400).json({ error: `El monto excede el saldo pendiente ($${remaining.toFixed(2)})` });
        }

        const payment = await prisma.payment.create({
            data: {
                invoiceId,
                amount: parseFloat(amount),
                method: method || 'cash',
                reference: reference || null,
                receivedBy: req.user.id,
                notes: notes || null
            }
        });

        // Update payment status
        const newTotalPaid = totalPaid + parseFloat(amount);
        const paymentStatus = newTotalPaid >= invoice.total - 0.01 ? 'paid' : 'partial';

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                paymentStatus,
                status: invoice.status === 'draft' ? 'issued' : invoice.status,
                issuedAt: invoice.issuedAt || new Date()
            }
        });

        await auditLog(req.user.id, 'PAYMENT', 'billing', 'Payment', payment.id, null, payment, req);

        res.status(201).json({
            payment,
            invoiceBalance: {
                total: invoice.total,
                paid: newTotalPaid,
                remaining: invoice.total - newTotalPaid,
                status: paymentStatus
            }
        });
    } catch (error) {
        console.error('Error registering payment:', error);
        res.status(500).json({ error: 'Error al registrar pago' });
    }
});

// GET /api/billing/accounts-receivable — Accounts receivable
router.get('/accounts-receivable', authenticate, requirePermission('billing', 'read'), async (req, res) => {
    try {
        const invoices = await prisma.invoice.findMany({
            where: {
                deletedAt: null,
                status: { not: 'cancelled' },
                paymentStatus: { in: ['pending', 'partial'] }
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, idNumber: true } },
                payments: true
            },
            orderBy: { createdAt: 'asc' }
        });

        const result = invoices.map(inv => {
            const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
            return {
                ...inv,
                totalPaid: paid,
                balance: inv.total - paid
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener cuentas por cobrar' });
    }
});

module.exports = router;
