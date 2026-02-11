const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// Helper: generate medical record number
const generateMRN = async () => {
    const count = await prisma.patient.count();
    return `HC-${String(count + 1).padStart(6, '0')}`;
};

// GET /api/patients — List + search
router.get('/', authenticate, requirePermission('patients', 'read'), async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = { deletedAt: null };

        if (search) {
            where.OR = [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { idNumber: { contains: search } },
                { phone: { contains: search } },
                { medicalRecordNumber: { contains: search } },
                { email: { contains: search } }
            ];
        }

        const [patients, total] = await Promise.all([
            prisma.patient.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.patient.count({ where })
        ]);

        res.json({
            data: patients,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ error: 'Error al obtener pacientes' });
    }
});

// GET /api/patients/:id — Patient 360° view
router.get('/:id', authenticate, requirePermission('patients', 'read'), async (req, res) => {
    try {
        const patient = await prisma.patient.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                documents: true,
                appointments: {
                    include: {
                        doctor: {
                            include: {
                                user: { select: { firstName: true, lastName: true } },
                                specialty: true
                            }
                        }
                    },
                    orderBy: { dateTime: 'desc' },
                    take: 20
                },
                medicalAttentions: {
                    include: {
                        doctor: {
                            include: {
                                user: { select: { firstName: true, lastName: true } },
                                specialty: true
                            }
                        },
                        diagnoses: true,
                        prescriptions: true,
                        clinicalNotes: true
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20
                },
                invoices: {
                    include: {
                        details: true,
                        payments: true
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20
                },
                insurancePolicies: {
                    include: { insurer: true }
                }
            }
        });

        if (!patient || patient.deletedAt) {
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }

        res.json(patient);
    } catch (error) {
        console.error('Error fetching patient:', error);
        res.status(500).json({ error: 'Error al obtener paciente' });
    }
});

// POST /api/patients — Create
router.post('/', authenticate, requirePermission('patients', 'create'), async (req, res) => {
    try {
        const { idNumber, firstName, lastName, dateOfBirth, gender, idType,
            phone, email, address, emergencyContactName, emergencyContactPhone,
            bloodType, allergies, notes } = req.body;

        // Validate required fields
        if (!idNumber || !firstName || !lastName || !dateOfBirth || !gender) {
            return res.status(400).json({
                error: 'Campos requeridos: idNumber, firstName, lastName, dateOfBirth, gender'
            });
        }

        // Check for duplicates
        const existing = await prisma.patient.findUnique({ where: { idNumber } });
        if (existing) {
            return res.status(409).json({ error: 'Ya existe un paciente con esta identificación' });
        }

        const medicalRecordNumber = await generateMRN();

        const patient = await prisma.patient.create({
            data: {
                medicalRecordNumber,
                idType: idType || 'cedula',
                idNumber,
                firstName,
                lastName,
                dateOfBirth: new Date(dateOfBirth),
                gender,
                phone: phone || null,
                email: email || null,
                address: address || null,
                emergencyContactName: emergencyContactName || null,
                emergencyContactPhone: emergencyContactPhone || null,
                bloodType: bloodType || null,
                allergies: allergies || null,
                notes: notes || null
            }
        });

        await auditLog(req.user.id, 'CREATE', 'patients', 'Patient', patient.id, null, patient, req);

        res.status(201).json(patient);
    } catch (error) {
        console.error('Error creating patient:', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Ya existe un paciente con esta identificación' });
        }
        res.status(500).json({ error: 'Error al crear paciente' });
    }
});

// PUT /api/patients/:id — Update
router.put('/:id', authenticate, requirePermission('patients', 'update'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma.patient.findUnique({ where: { id } });

        if (!existing || existing.deletedAt) {
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }

        const { idNumber, firstName, lastName, dateOfBirth, gender, idType,
            phone, email, address, emergencyContactName, emergencyContactPhone,
            bloodType, allergies, notes } = req.body;

        // Check unique idNumber if changed
        if (idNumber && idNumber !== existing.idNumber) {
            const dup = await prisma.patient.findUnique({ where: { idNumber } });
            if (dup) {
                return res.status(409).json({ error: 'Ya existe otro paciente con esta identificación' });
            }
        }

        const updated = await prisma.patient.update({
            where: { id },
            data: {
                ...(idNumber && { idNumber }),
                ...(idType && { idType }),
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
                ...(gender && { gender }),
                phone: phone !== undefined ? phone : existing.phone,
                email: email !== undefined ? email : existing.email,
                address: address !== undefined ? address : existing.address,
                emergencyContactName: emergencyContactName !== undefined ? emergencyContactName : existing.emergencyContactName,
                emergencyContactPhone: emergencyContactPhone !== undefined ? emergencyContactPhone : existing.emergencyContactPhone,
                bloodType: bloodType !== undefined ? bloodType : existing.bloodType,
                allergies: allergies !== undefined ? allergies : existing.allergies,
                notes: notes !== undefined ? notes : existing.notes
            }
        });

        await auditLog(req.user.id, 'UPDATE', 'patients', 'Patient', id, existing, updated, req);

        res.json(updated);
    } catch (error) {
        console.error('Error updating patient:', error);
        res.status(500).json({ error: 'Error al actualizar paciente' });
    }
});

// DELETE /api/patients/:id — Soft delete
router.delete('/:id', authenticate, requirePermission('patients', 'delete'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma.patient.findUnique({ where: { id } });

        if (!existing || existing.deletedAt) {
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }

        await prisma.patient.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        await auditLog(req.user.id, 'SOFT_DELETE', 'patients', 'Patient', id, existing, null, req);

        res.json({ message: 'Paciente eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar paciente' });
    }
});

module.exports = router;
