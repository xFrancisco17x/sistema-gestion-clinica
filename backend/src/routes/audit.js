const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/audit — Query audit events
router.get('/', authenticate, requireRole('Administrador', 'Gerencia'), async (req, res) => {
    try {
        const { userId, module, action, startDate, endDate, page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (userId) where.userId = parseInt(userId);
        if (module) where.module = module;
        if (action) where.action = action;
        if (startDate && endDate) {
            where.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
        }

        const [events, total] = await Promise.all([
            prisma.auditEvent.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    user: { select: { id: true, username: true, firstName: true, lastName: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.auditEvent.count({ where })
        ]);

        res.json({
            data: events,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener eventos de auditoría' });
    }
});

// GET /api/audit/modules — Available modules for filter
router.get('/modules', authenticate, requireRole('Administrador', 'Gerencia'), async (req, res) => {
    try {
        const modules = await prisma.auditEvent.findMany({
            distinct: ['module'],
            select: { module: true }
        });
        res.json(modules.map(m => m.module));
    } catch (error) {
        res.status(500).json({ error: 'Error' });
    }
});

module.exports = router;
