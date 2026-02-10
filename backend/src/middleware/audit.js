const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Audit middleware — logs critical actions
 */
const auditLog = async (userId, action, module, entityType, entityId, before, after, req) => {
    try {
        await prisma.auditEvent.create({
            data: {
                userId,
                action,
                module,
                entityType: entityType || null,
                entityId: entityId || null,
                before: before ? JSON.stringify(before) : null,
                after: after ? JSON.stringify(after) : null,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
                userAgent: req?.headers?.['user-agent'] || null
            }
        });
    } catch (error) {
        console.error('Error logging audit event:', error);
    }
};

module.exports = { auditLog };
