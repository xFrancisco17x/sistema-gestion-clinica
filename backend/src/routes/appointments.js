const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
const prisma = new PrismaClient();

// Helper: check for scheduling conflicts
const checkConflict = async (doctorId, dateTime, endTime, excludeId = null) => {
    const where = {
        doctorId,
        status: { notIn: ['cancelled'] },
        deletedAt: null,
        AND: [
            { dateTime: { lt: new Date(endTime) } },
            { endTime: { gt: new Date(dateTime) } }
        ]
    };

    if (excludeId) {
        where.id = { not: excludeId };
    }

    const conflict = await prisma.appointment.findFirst({ where });
    return conflict;
};

// GET /api/appointments — List with filters
router.get('/', authenticate, requirePermission('appointments', 'read'), async (req, res) => {
    try {
        const { doctorId, patientId, status, date, startDate, endDate, page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = { deletedAt: null };

        if (doctorId) where.doctorId = parseInt(doctorId);
        if (patientId) where.patientId = parseInt(patientId);
        if (status) where.status = status;

        // If user is a doctor, only show their appointments
        if (req.user.role === 'Médico') {
            const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
            if (doctor) where.doctorId = doctor.id;
        }

        if (date) {
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);
            where.dateTime = { gte: dayStart, lte: dayEnd };
        } else if (startDate && endDate) {
            where.dateTime = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const [appointments, total] = await Promise.all([
            prisma.appointment.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true, idNumber: true, medicalRecordNumber: true, phone: true } },
                    doctor: {
                        include: {
                            user: { select: { firstName: true, lastName: true } },
                            specialty: true
                        }
                    },
                    medicalAttention: { select: { id: true, status: true } }
                },
                orderBy: { dateTime: 'asc' }
            }),
            prisma.appointment.count({ where })
        ]);

        res.json({
            data: appointments,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Error al obtener citas', details: error.message });
    }
});

// GET /api/appointments/:id
router.get('/:id', authenticate, requirePermission('appointments', 'read'), async (req, res) => {
    try {
        const appointment = await prisma.appointment.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                patient: true,
                doctor: {
                    include: {
                        user: { select: { firstName: true, lastName: true } },
                        specialty: true
                    }
                },
                history: { orderBy: { changedAt: 'desc' } },
                medicalAttention: {
                    include: { diagnoses: true, prescriptions: true, clinicalNotes: true }
                }
            }
        });

        if (!appointment || appointment.deletedAt) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }

        res.json(appointment);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener cita' });
    }
});

// POST /api/appointments — Create
router.post('/', authenticate, requirePermission('appointments', 'create'), async (req, res) => {
    try {
        const { patientId, doctorId, dateTime, duration, reason } = req.body;

        if (!patientId || !doctorId || !dateTime) {
            return res.status(400).json({ error: 'patientId, doctorId y dateTime son requeridos' });
        }

        // Verify patient exists
        const patient = await prisma.patient.findUnique({ where: { id: parseInt(patientId) } });
        if (!patient || patient.deletedAt) {
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }

        // Verify doctor exists
        const doctor = await prisma.doctor.findUnique({ where: { id: parseInt(doctorId) } });
        if (!doctor || !doctor.isActive) {
            return res.status(404).json({ error: 'Médico no encontrado' });
        }

        const startTime = new Date(dateTime);
        const slotMinutes = duration || 30;
        const endTimeDate = new Date(startTime.getTime() + slotMinutes * 60000);

        // Check for schedule blocks
        const block = await prisma.scheduleBlock.findFirst({
            where: {
                doctorId: parseInt(doctorId),
                startDate: { lte: endTimeDate },
                endDate: { gte: startTime }
            }
        });

        if (block) {
            return res.status(409).json({
                error: `El médico tiene un bloqueo de horario: ${block.reason}`,
                block
            });
        }

        // Check for conflicts
        const conflict = await checkConflict(parseInt(doctorId), startTime.toISOString(), endTimeDate.toISOString());
        if (conflict) {
            return res.status(409).json({
                error: 'El médico ya tiene una cita en este horario',
                conflict: {
                    id: conflict.id,
                    dateTime: conflict.dateTime,
                    endTime: conflict.endTime
                }
            });
        }

        const appointment = await prisma.appointment.create({
            data: {
                patientId: parseInt(patientId),
                doctorId: parseInt(doctorId),
                dateTime: startTime,
                endTime: endTimeDate,
                reason: reason || null,
                status: 'scheduled'
            },
            include: {
                patient: { select: { firstName: true, lastName: true, idNumber: true } },
                doctor: {
                    include: {
                        user: { select: { firstName: true, lastName: true } },
                        specialty: true
                    }
                }
            }
        });

        // Create history entry
        await prisma.appointmentHistory.create({
            data: {
                appointmentId: appointment.id,
                previousStatus: 'none',
                newStatus: 'scheduled',
                changedBy: req.user.id
            }
        });

        await auditLog(req.user.id, 'CREATE', 'appointments', 'Appointment', appointment.id, null, appointment, req);

        res.status(201).json(appointment);
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Error al crear cita' });
    }
});

// PUT /api/appointments/:id/reschedule — Reschedule
router.put('/:id/reschedule', authenticate, requirePermission('appointments', 'update'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { dateTime, duration, reason } = req.body;

        if (!dateTime || !reason) {
            return res.status(400).json({ error: 'dateTime y motivo de reprogramación son requeridos' });
        }

        const existing = await prisma.appointment.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }

        if (['attended', 'cancelled'].includes(existing.status)) {
            return res.status(400).json({ error: 'No se puede reprogramar una cita atendida o cancelada' });
        }

        const startTime = new Date(dateTime);
        const slotMinutes = duration || 30;
        const endTimeDate = new Date(startTime.getTime() + slotMinutes * 60000);

        // Check conflict
        const conflict = await checkConflict(existing.doctorId, startTime.toISOString(), endTimeDate.toISOString(), id);
        if (conflict) {
            return res.status(409).json({
                error: 'El médico ya tiene una cita en este horario',
                conflict: { id: conflict.id, dateTime: conflict.dateTime, endTime: conflict.endTime }
            });
        }

        const updated = await prisma.appointment.update({
            where: { id },
            data: {
                dateTime: startTime,
                endTime: endTimeDate,
                status: 'rescheduled',
                notes: reason
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
                doctor: { include: { user: { select: { firstName: true, lastName: true } }, specialty: true } }
            }
        });

        await prisma.appointmentHistory.create({
            data: {
                appointmentId: id,
                previousStatus: existing.status,
                newStatus: 'rescheduled',
                reason,
                changedBy: req.user.id
            }
        });

        await auditLog(req.user.id, 'RESCHEDULE', 'appointments', 'Appointment', id, existing, updated, req);

        res.json(updated);
    } catch (error) {
        console.error('Error rescheduling:', error);
        res.status(500).json({ error: 'Error al reprogramar cita' });
    }
});

// PUT /api/appointments/:id/cancel — Cancel
router.put('/:id/cancel', authenticate, requirePermission('appointments', 'update'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'El motivo de cancelación es requerido' });
        }

        const existing = await prisma.appointment.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }

        if (existing.status === 'attended') {
            return res.status(400).json({ error: 'No se puede cancelar una cita ya atendida' });
        }

        const updated = await prisma.appointment.update({
            where: { id },
            data: { status: 'cancelled', notes: reason }
        });

        await prisma.appointmentHistory.create({
            data: {
                appointmentId: id,
                previousStatus: existing.status,
                newStatus: 'cancelled',
                reason,
                changedBy: req.user.id
            }
        });

        await auditLog(req.user.id, 'CANCEL', 'appointments', 'Appointment', id, existing, updated, req);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error al cancelar cita' });
    }
});

// PUT /api/appointments/:id/confirm
router.put('/:id/confirm', authenticate, requirePermission('appointments', 'update'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma.appointment.findUnique({ where: { id } });

        if (!existing || existing.deletedAt) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }

        const updated = await prisma.appointment.update({
            where: { id },
            data: { status: 'confirmed' }
        });

        await prisma.appointmentHistory.create({
            data: {
                appointmentId: id,
                previousStatus: existing.status,
                newStatus: 'confirmed',
                changedBy: req.user.id
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error al confirmar cita' });
    }
});

// PUT /api/appointments/:id/no-show
router.put('/:id/no-show', authenticate, requirePermission('appointments', 'update'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma.appointment.findUnique({ where: { id } });

        if (!existing || existing.deletedAt) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }

        const updated = await prisma.appointment.update({
            where: { id },
            data: { status: 'no_show' }
        });

        await prisma.appointmentHistory.create({
            data: {
                appointmentId: id,
                previousStatus: existing.status,
                newStatus: 'no_show',
                changedBy: req.user.id
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error al marcar no-show' });
    }
});

module.exports = router;
