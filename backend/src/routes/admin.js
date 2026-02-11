const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// ============ USER MANAGEMENT ============

// GET /api/admin/users
router.get('/users', authenticate, requireRole('Administrador'), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { deletedAt: null },
            select: {
                id: true, username: true, email: true, firstName: true, lastName: true,
                isActive: true, lastLogin: true, createdAt: true,
                role: { select: { id: true, name: true } },
                doctor: { select: { id: true, specialtyId: true, specialty: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// POST /api/admin/users — Create user
router.post('/users', authenticate, requireRole('Administrador'), async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, roleId, specialtyId, licenseNumber } = req.body;

        if (!username || !email || !password || !firstName || !lastName || !roleId) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }

        const hash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                username, email, passwordHash: hash, firstName, lastName, roleId: parseInt(roleId)
            },
            include: { role: true }
        });

        // If role Médico, create doctor profile
        if (specialtyId) {
            await prisma.doctor.create({
                data: {
                    userId: user.id,
                    specialtyId: parseInt(specialtyId),
                    licenseNumber: licenseNumber || null
                }
            });
        }

        await auditLog(req.user.id, 'CREATE_USER', 'admin', 'User', user.id, null, { username, email, role: user.role.name }, req);

        res.status(201).json({
            id: user.id, username: user.username, email: user.email,
            firstName: user.firstName, lastName: user.lastName,
            role: user.role
        });
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'El usuario o email ya existe' });
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// PUT /api/admin/users/:id
router.put('/users/:id', authenticate, requireRole('Administrador'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { email, firstName, lastName, roleId, isActive } = req.body;

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

        const updated = await prisma.user.update({
            where: { id },
            data: {
                ...(email && { email }),
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(roleId && { roleId: parseInt(roleId) }),
                ...(isActive !== undefined && { isActive })
            },
            include: { role: true }
        });

        await auditLog(req.user.id, 'UPDATE_USER', 'admin', 'User', id, existing, updated, req);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// PUT /api/admin/users/:id/reset-password
router.put('/users/:id/reset-password', authenticate, requireRole('Administrador'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }

        const hash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id },
            data: { passwordHash: hash, failedAttempts: 0, lockedUntil: null }
        });

        await auditLog(req.user.id, 'RESET_PASSWORD', 'admin', 'User', id, null, null, req);
        res.json({ message: 'Contraseña reseteada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al resetear contraseña' });
    }
});

// DELETE /api/admin/users/:id — Soft delete
router.delete('/users/:id', authenticate, requireRole('Administrador'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.user.id) return res.status(400).json({ error: 'No puede eliminar su propio usuario' });

        await prisma.user.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false }
        });

        await auditLog(req.user.id, 'DELETE_USER', 'admin', 'User', id, null, null, req);
        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// ============ ROLES ============

router.get('/roles', authenticate, requireRole('Administrador'), async (req, res) => {
    try {
        const roles = await prisma.role.findMany({
            include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } }
        });
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener roles' });
    }
});

// ============ SPECIALTIES ============

router.get('/specialties', authenticate, async (req, res) => {
    try {
        const specialties = await prisma.specialty.findMany({ orderBy: { name: 'asc' } });
        res.json(specialties);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener especialidades' });
    }
});

router.post('/specialties', authenticate, requireRole('Administrador'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const specialty = await prisma.specialty.create({ data: { name, description } });
        res.status(201).json(specialty);
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'La especialidad ya existe' });
        res.status(500).json({ error: 'Error al crear especialidad' });
    }
});

// ============ SYSTEM PARAMETERS ============

router.get('/parameters', authenticate, requireRole('Administrador'), async (req, res) => {
    try {
        const params = await prisma.systemParameter.findMany();
        res.json(params);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener parámetros' });
    }
});

router.put('/parameters/:key', authenticate, requireRole('Administrador'), async (req, res) => {
    try {
        const { value } = req.body;
        const param = await prisma.systemParameter.upsert({
            where: { key: req.params.key },
            update: { value },
            create: { key: req.params.key, value, description: req.body.description }
        });
        res.json(param);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar parámetro' });
    }
});

module.exports = router;
