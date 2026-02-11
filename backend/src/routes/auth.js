const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// GET /api/auth/login (test endpoint - browser verification)
router.get('/login', (req, res) => {
    res.json({ message: 'Login route alive', method: 'Use POST to login', endpoint: 'POST /api/auth/login' });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }

        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                },
                doctor: { include: { specialty: true } }
            }
        });

        if (!user || user.deletedAt) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (!user.isActive) {
            return res.status(401).json({ error: 'Usuario desactivado' });
        }

        // Check lock
        if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
            return res.status(423).json({ error: 'Cuenta bloqueada temporalmente. Intente más tarde.' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);

        if (!validPassword) {
            // Increment failed attempts
            const attempts = user.failedAttempts + 1;
            const updateData = { failedAttempts: attempts };
            if (attempts >= 5) {
                updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
            }
            await prisma.user.update({ where: { id: user.id }, data: updateData });
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Reset failed attempts on success
        await prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: null, lastLogin: new Date() }
        });

        const token = jwt.sign(
            { userId: user.id, role: user.role.name },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        // Store session
        await prisma.session.create({
            data: {
                token,
                userId: user.id,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
            }
        });

        await auditLog(user.id, 'LOGIN', 'auth', 'User', user.id, null, null, req);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role.name,
                roleId: user.roleId,
                doctor: user.doctor ? {
                    id: user.doctor.id,
                    specialty: user.doctor.specialty.name,
                    specialtyId: user.doctor.specialtyId
                } : null,
                permissions: user.role.permissions.map(rp => ({
                    module: rp.permission.module,
                    action: rp.permission.action
                }))
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                role: true,
                doctor: { include: { specialty: true } }
            }
        });

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role.name,
            roleId: user.roleId,
            doctor: user.doctor ? {
                id: user.doctor.id,
                specialty: user.doctor.specialty.name,
                specialtyId: user.doctor.specialtyId
            } : null,
            permissions: req.user.permissions
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuario' });
    }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        await prisma.session.deleteMany({ where: { token } });
        await auditLog(req.user.id, 'LOGOUT', 'auth', 'User', req.user.id, null, null, req);
        res.json({ message: 'Sesión cerrada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al cerrar sesión' });
    }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);

        if (!valid) {
            return res.status(400).json({ error: 'Contraseña actual incorrecta' });
        }

        const hash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: req.user.id },
            data: { passwordHash: hash }
        });

        await auditLog(req.user.id, 'CHANGE_PASSWORD', 'auth', 'User', req.user.id, null, null, req);

        res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
});

module.exports = router;
