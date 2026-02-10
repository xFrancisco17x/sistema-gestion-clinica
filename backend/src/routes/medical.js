const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/medical/attentions — Start medical attention from appointment
router.post('/attentions', authenticate, requireRole('Médico', 'Administrador'), async (req, res) => {
    try {
        const { appointmentId, patientId, chiefComplaint } = req.body;

        if (!patientId) {
            return res.status(400).json({ error: 'patientId es requerido' });
        }

        // Get doctor profile
        const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
        if (!doctor && req.user.role !== 'Administrador') {
            return res.status(403).json({ error: 'Solo médicos pueden registrar atenciones' });
        }

        const doctorId = doctor ? doctor.id : 1;

        // If from appointment, validate
        if (appointmentId) {
            const appointment = await prisma.appointment.findUnique({ where: { id: parseInt(appointmentId) } });
            if (!appointment) return res.status(404).json({ error: 'Cita no encontrada' });
            if (appointment.status === 'attended') return res.status(400).json({ error: 'Esta cita ya fue atendida' });

            // Check if attention already exists for this appointment
            const existingAttention = await prisma.medicalAttention.findUnique({ where: { appointmentId: parseInt(appointmentId) } });
            if (existingAttention) return res.status(409).json({ error: 'Ya existe una atención para esta cita', attentionId: existingAttention.id });
        }

        const attention = await prisma.medicalAttention.create({
            data: {
                appointmentId: appointmentId ? parseInt(appointmentId) : null,
                patientId: parseInt(patientId),
                doctorId,
                chiefComplaint: chiefComplaint || null,
                status: 'in_progress'
            },
            include: {
                patient: true,
                doctor: { include: { user: { select: { firstName: true, lastName: true } }, specialty: true } }
            }
        });

        // Update appointment status
        if (appointmentId) {
            await prisma.appointment.update({
                where: { id: parseInt(appointmentId) },
                data: { status: 'attended' }
            });
        }

        await auditLog(req.user.id, 'START_ATTENTION', 'medical', 'MedicalAttention', attention.id, null, attention, req);

        res.status(201).json(attention);
    } catch (error) {
        console.error('Error creating attention:', error);
        res.status(500).json({ error: 'Error al crear atención médica' });
    }
});

// GET /api/medical/attentions — List
router.get('/attentions', authenticate, requirePermission('medical', 'read'), async (req, res) => {
    try {
        const { patientId, doctorId, status, page = 1, limit = 20 } = req.query;
        const where = {};

        if (patientId) where.patientId = parseInt(patientId);
        if (status) where.status = status;

        if (req.user.role === 'Médico') {
            const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
            if (doctor) where.doctorId = doctor.id;
        } else if (doctorId) {
            where.doctorId = parseInt(doctorId);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [attentions, total] = await Promise.all([
            prisma.medicalAttention.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
                    doctor: { include: { user: { select: { firstName: true, lastName: true } }, specialty: true } },
                    diagnoses: true,
                    prescriptions: true,
                    clinicalNotes: true
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.medicalAttention.count({ where })
        ]);

        res.json({
            data: attentions,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener atenciones' });
    }
});

// GET /api/medical/attentions/:id
router.get('/attentions/:id', authenticate, requirePermission('medical', 'read'), async (req, res) => {
    try {
        const attention = await prisma.medicalAttention.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                patient: true,
                doctor: { include: { user: { select: { firstName: true, lastName: true } }, specialty: true } },
                appointment: true,
                diagnoses: true,
                prescriptions: true,
                clinicalNotes: { orderBy: { createdAt: 'desc' } }
            }
        });

        if (!attention) return res.status(404).json({ error: 'Atención no encontrada' });
        res.json(attention);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener atención' });
    }
});

// PUT /api/medical/attentions/:id — Update attention (diagnoses, prescriptions, etc.)
router.put('/attentions/:id', authenticate, requireRole('Médico', 'Administrador'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { chiefComplaint, vitalSigns, anamnesis, physicalExam, diagnoses, prescriptions, clinicalNotes } = req.body;

        const existing = await prisma.medicalAttention.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Atención no encontrada' });
        if (existing.status === 'closed') return res.status(400).json({ error: 'Esta atención está cerrada. Use enmienda para correcciones.' });

        // Update main fields
        const updated = await prisma.medicalAttention.update({
            where: { id },
            data: {
                chiefComplaint: chiefComplaint !== undefined ? chiefComplaint : existing.chiefComplaint,
                vitalSigns: vitalSigns !== undefined ? vitalSigns : existing.vitalSigns,
                anamnesis: anamnesis !== undefined ? anamnesis : existing.anamnesis,
                physicalExam: physicalExam !== undefined ? physicalExam : existing.physicalExam
            }
        });

        // Update diagnoses if provided
        if (diagnoses && Array.isArray(diagnoses)) {
            await prisma.diagnosis.deleteMany({ where: { attentionId: id } });
            for (const d of diagnoses) {
                await prisma.diagnosis.create({
                    data: { attentionId: id, code: d.code || null, description: d.description, type: d.type || 'primary' }
                });
            }
        }

        // Update prescriptions if provided
        if (prescriptions && Array.isArray(prescriptions)) {
            await prisma.prescription.deleteMany({ where: { attentionId: id } });
            for (const p of prescriptions) {
                await prisma.prescription.create({
                    data: {
                        attentionId: id,
                        medication: p.medication,
                        dosage: p.dosage || null,
                        frequency: p.frequency || null,
                        duration: p.duration || null,
                        instructions: p.instructions || null
                    }
                });
            }
        }

        // Add clinical notes if provided
        if (clinicalNotes && Array.isArray(clinicalNotes)) {
            for (const n of clinicalNotes) {
                await prisma.clinicalNote.create({
                    data: { attentionId: id, noteType: n.noteType || 'evolution', content: n.content, createdBy: req.user.id }
                });
            }
        }

        // Fetch complete updated record
        const result = await prisma.medicalAttention.findUnique({
            where: { id },
            include: { diagnoses: true, prescriptions: true, clinicalNotes: { orderBy: { createdAt: 'desc' } }, patient: true }
        });

        await auditLog(req.user.id, 'UPDATE', 'medical', 'MedicalAttention', id, existing, result, req);

        res.json(result);
    } catch (error) {
        console.error('Error updating attention:', error);
        res.status(500).json({ error: 'Error al actualizar atención' });
    }
});

// PUT /api/medical/attentions/:id/close — Close attention
router.put('/attentions/:id/close', authenticate, requireRole('Médico', 'Administrador'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma.medicalAttention.findUnique({
            where: { id },
            include: { diagnoses: true }
        });

        if (!existing) return res.status(404).json({ error: 'Atención no encontrada' });
        if (existing.status === 'closed') return res.status(400).json({ error: 'Ya está cerrada' });
        if (existing.diagnoses.length === 0) return res.status(400).json({ error: 'Debe registrar al menos un diagnóstico antes de cerrar' });

        const updated = await prisma.medicalAttention.update({
            where: { id },
            data: { status: 'closed', closedAt: new Date() }
        });

        // Mark appointment as attended
        if (existing.appointmentId) {
            await prisma.appointment.update({
                where: { id: existing.appointmentId },
                data: { status: 'attended' }
            });
        }

        await auditLog(req.user.id, 'CLOSE_ATTENTION', 'medical', 'MedicalAttention', id, existing, updated, req);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error al cerrar atención' });
    }
});

// POST /api/medical/attentions/:id/amendment — Amendment to closed attention
router.post('/attentions/:id/amendment', authenticate, requireRole('Médico', 'Administrador'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { content, reason } = req.body;

        if (!content) return res.status(400).json({ error: 'El contenido de la enmienda es requerido' });

        const existing = await prisma.medicalAttention.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Atención no encontrada' });
        if (existing.status !== 'closed') return res.status(400).json({ error: 'Solo se pueden enmendar atenciones cerradas' });

        const note = await prisma.clinicalNote.create({
            data: {
                attentionId: id,
                noteType: 'amendment',
                content: `[ENMIENDA] ${reason ? `Motivo: ${reason}\n` : ''}${content}`,
                createdBy: req.user.id
            }
        });

        await auditLog(req.user.id, 'AMENDMENT', 'medical', 'MedicalAttention', id, null, note, req);

        res.status(201).json(note);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear enmienda' });
    }
});

module.exports = router;
