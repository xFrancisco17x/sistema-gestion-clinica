const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/reports/dashboard — Dashboard KPIs
router.get('/dashboard', authenticate, requirePermission('reports', 'read'), async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        const [
            totalPatients,
            todayAppointments,
            monthAppointments,
            cancelledAppointments,
            attendedAppointments,
            monthRevenue,
            pendingInvoices,
            activeUsers
        ] = await Promise.all([
            prisma.patient.count({ where: { deletedAt: null } }),
            prisma.appointment.count({ where: { dateTime: { gte: today, lt: tomorrow }, deletedAt: null } }),
            prisma.appointment.count({ where: { dateTime: { gte: monthStart, lte: monthEnd }, deletedAt: null } }),
            prisma.appointment.count({ where: { dateTime: { gte: monthStart, lte: monthEnd }, status: 'cancelled', deletedAt: null } }),
            prisma.appointment.count({ where: { dateTime: { gte: monthStart, lte: monthEnd }, status: 'attended', deletedAt: null } }),
            prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart, lte: monthEnd } } }),
            prisma.invoice.count({ where: { paymentStatus: { in: ['pending', 'partial'] }, status: { not: 'cancelled' }, deletedAt: null } }),
            prisma.user.count({ where: { isActive: true, deletedAt: null } })
        ]);

        res.json({
            totalPatients,
            todayAppointments,
            monthAppointments,
            cancelledAppointments,
            attendedAppointments,
            noShowAppointments: monthAppointments - attendedAppointments - cancelledAppointments,
            monthRevenue: monthRevenue._sum.amount || 0,
            pendingInvoices,
            activeUsers,
            occupancyRate: monthAppointments > 0 ? ((attendedAppointments / monthAppointments) * 100).toFixed(1) : 0
        });
    } catch (error) {
        console.error('Error getting dashboard:', error);
        res.status(500).json({ error: 'Error al generar dashboard' });
    }
});

// GET /api/reports/clinical — Clinical reports
router.get('/clinical', authenticate, requirePermission('reports', 'read'), async (req, res) => {
    try {
        const { startDate, endDate, doctorId, specialtyId } = req.query;

        const where = {};
        if (startDate && endDate) {
            where.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
        }
        if (doctorId) where.doctorId = parseInt(doctorId);

        const attentions = await prisma.medicalAttention.findMany({
            where,
            include: {
                doctor: { include: { user: { select: { firstName: true, lastName: true } }, specialty: true } },
                diagnoses: true,
                patient: { select: { firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Group by doctor
        const byDoctor = {};
        attentions.forEach(a => {
            const doctorName = `${a.doctor.user.firstName} ${a.doctor.user.lastName}`;
            if (!byDoctor[doctorName]) byDoctor[doctorName] = { count: 0, specialty: a.doctor.specialty.name };
            byDoctor[doctorName].count++;
        });

        // Group by diagnosis
        const byDiagnosis = {};
        attentions.forEach(a => {
            a.diagnoses.forEach(d => {
                if (!byDiagnosis[d.description]) byDiagnosis[d.description] = 0;
                byDiagnosis[d.description]++;
            });
        });

        res.json({
            totalAttentions: attentions.length,
            byDoctor: Object.entries(byDoctor).map(([name, data]) => ({ doctor: name, ...data })),
            topDiagnoses: Object.entries(byDiagnosis)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([diagnosis, count]) => ({ diagnosis, count })),
            details: attentions
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al generar reporte clínico' });
    }
});

// GET /api/reports/financial — Financial reports
router.get('/financial', authenticate, requirePermission('reports', 'read'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
        }

        const [invoices, payments] = await Promise.all([
            prisma.invoice.findMany({
                where: { ...dateFilter, deletedAt: null },
                include: { payments: true, patient: { select: { firstName: true, lastName: true } } }
            }),
            prisma.payment.findMany({
                where: startDate && endDate ? { paidAt: { gte: new Date(startDate), lte: new Date(endDate) } } : {},
                include: { invoice: { select: { invoiceNumber: true } } }
            })
        ]);

        const totalInvoiced = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0);
        const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
        const totalPending = totalInvoiced - totalCollected;

        // Payments by method
        const byMethod = {};
        payments.forEach(p => {
            if (!byMethod[p.method]) byMethod[p.method] = 0;
            byMethod[p.method] += p.amount;
        });

        res.json({
            totalInvoiced,
            totalCollected,
            totalPending,
            invoiceCount: invoices.length,
            cancelledCount: invoices.filter(i => i.status === 'cancelled').length,
            paymentsByMethod: Object.entries(byMethod).map(([method, total]) => ({ method, total })),
            invoices: invoices.map(i => ({
                invoiceNumber: i.invoiceNumber,
                patient: `${i.patient.firstName} ${i.patient.lastName}`,
                total: i.total,
                status: i.status,
                paymentStatus: i.paymentStatus,
                paid: i.payments.reduce((s, p) => s + p.amount, 0)
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al generar reporte financiero' });
    }
});

// GET /api/reports/appointments — Appointment reports
router.get('/appointments', authenticate, requirePermission('reports', 'read'), async (req, res) => {
    try {
        const { startDate, endDate, doctorId } = req.query;

        const where = { deletedAt: null };
        if (startDate && endDate) {
            where.dateTime = { gte: new Date(startDate), lte: new Date(endDate) };
        }
        if (doctorId) where.doctorId = parseInt(doctorId);

        const appointments = await prisma.appointment.findMany({
            where,
            include: {
                doctor: { include: { user: { select: { firstName: true, lastName: true } }, specialty: true } }
            }
        });

        const byStatus = {};
        appointments.forEach(a => {
            if (!byStatus[a.status]) byStatus[a.status] = 0;
            byStatus[a.status]++;
        });

        const byDoctor = {};
        appointments.forEach(a => {
            const name = `${a.doctor.user.firstName} ${a.doctor.user.lastName}`;
            if (!byDoctor[name]) byDoctor[name] = { total: 0, attended: 0, cancelled: 0, noShow: 0 };
            byDoctor[name].total++;
            if (a.status === 'attended') byDoctor[name].attended++;
            if (a.status === 'cancelled') byDoctor[name].cancelled++;
            if (a.status === 'no_show') byDoctor[name].noShow++;
        });

        res.json({
            total: appointments.length,
            byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
            byDoctor: Object.entries(byDoctor).map(([doctor, data]) => ({ doctor, ...data }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al generar reporte de citas' });
    }
});

module.exports = router;
