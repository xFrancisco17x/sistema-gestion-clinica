const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'clinica-vida-salud-secret-key-2024';

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de acceso requerido' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                }
            }
        });

        if (!user || !user.isActive || user.deletedAt) {
            return res.status(401).json({ error: 'Usuario no válido o desactivado' });
        }

        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role.name,
            roleId: user.roleId,
            permissions: user.role.permissions.map(rp => ({
                module: rp.permission.module,
                action: rp.permission.action
            }))
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token inválido' });
        }
        return res.status(500).json({ error: 'Error de autenticación' });
    }
};

module.exports = { authenticate, JWT_SECRET };
