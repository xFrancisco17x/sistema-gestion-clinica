const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/doctors — List all active doctors
router.get('/', authenticate, async (req, res) => {
    try {
        const { specialtyId } = req.query;
        const where = { isActive: true };
        if (specialtyId) where.specialtyId = parseInt(specialtyId);

        const doctors = await prisma.doctor.findMany({
            where,
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                specialty: true,
                schedules: true
            }
        });

        res.json(doctors);
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ error: 'Error al obtener médicos', details: error.message });
    }
});

// GET /api/doctors/:id/availability — Get availability for a specific date
router.get('/:id/availability', authenticate, async (req, res) => {
    try {
        const doctorId = parseInt(req.params.id);
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'Parámetro date es requerido (YYYY-MM-DD)' });
        }

        const doctor = await prisma.doctor.findUnique({
            where: { id: doctorId },
            include: { schedules: true }
        });

        if (!doctor) {
            return res.status(404).json({ error: 'Médico no encontrado' });
        }

        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        // Get schedule for this day
        const schedule = doctor.schedules.find(s => s.dayOfWeek === dayOfWeek);
        if (!schedule) {
            return res.json({ available: false, slots: [], message: 'El médico no trabaja este día' });
        }

        // Get existing appointments for this day
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const appointments = await prisma.appointment.findMany({
            where: {
                doctorId,
                dateTime: { gte: dayStart, lte: dayEnd },
                status: { notIn: ['cancelled'] },
                deletedAt: null
            }
        });

        // Get blocks for this day
        const blocks = await prisma.scheduleBlock.findMany({
            where: {
                doctorId,
                startDate: { lte: dayEnd },
                endDate: { gte: dayStart }
            }
        });

        // Generate time slots
        const slots = [];
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);
        const slotDuration = schedule.slotDuration;

        let current = new Date(date);
        current.setHours(startH, startM, 0, 0);

        const scheduleEnd = new Date(date);
        scheduleEnd.setHours(endH, endM, 0, 0);

        while (current < scheduleEnd) {
            const slotEnd = new Date(current.getTime() + slotDuration * 60000);

            // Check if slot is blocked
            const isBlocked = blocks.some(b =>
                current < new Date(b.endDate) && slotEnd > new Date(b.startDate)
            );

            // Check if slot has appointment
            const isBooked = appointments.some(a =>
                current < new Date(a.endTime) && slotEnd > new Date(a.dateTime)
            );

            slots.push({
                startTime: current.toISOString(),
                endTime: slotEnd.toISOString(),
                available: !isBlocked && !isBooked,
                reason: isBlocked ? 'blocked' : isBooked ? 'booked' : null
            });

            current = slotEnd;
        }

        res.json({ available: true, slots, schedule });
    } catch (error) {
        console.error('Error getting availability:', error);
        res.status(500).json({ error: 'Error al obtener disponibilidad' });
    }
});

// GET /api/doctors/specialties — List specialties
router.get('/specialties/list', authenticate, async (req, res) => {
    try {
        const specialties = await prisma.specialty.findMany({
            where: { isActive: true },
            include: { doctors: { where: { isActive: true }, select: { id: true } } }
        });

        res.json(specialties);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener especialidades' });
    }
});

module.exports = router;
