/**
 * RBAC Middleware — Role-Based Access Control
 * Usage: requirePermission('patients', 'read')
 */
const requirePermission = (module, action) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        // Admins have access to everything
        if (req.user.role === 'Administrador') {
            return next();
        }

        const hasPermission = req.user.permissions.some(
            p => p.module === module && (p.action === action || p.action === 'all')
        );

        if (!hasPermission) {
            return res.status(403).json({
                error: 'No tiene permisos para realizar esta acción',
                required: { module, action }
            });
        }

        next();
    };
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'No tiene el rol necesario para esta acción'
            });
        }

        next();
    };
};

module.exports = { requirePermission, requireRole };
