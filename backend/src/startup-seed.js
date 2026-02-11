const prisma = require('./lib/prisma');
const bcrypt = require('bcryptjs');

async function seedIfEmpty() {
    try {
        const roleCount = await prisma.role.count();
        if (roleCount > 0) {
            console.log('📦 Database already seeded, skipping...');
            return;
        }

        console.log('🌱 Seeding database (first run)...');

        // ROLES
        const adminRole = await prisma.role.create({ data: { name: 'Administrador', description: 'Administrador del sistema' } });
        const recepcionRole = await prisma.role.create({ data: { name: 'Recepción', description: 'Recepción y admisión' } });
        const medicoRole = await prisma.role.create({ data: { name: 'Médico', description: 'Médico tratante' } });
        const facturacionRole = await prisma.role.create({ data: { name: 'Facturación', description: 'Facturación y caja' } });
        const gerenciaRole = await prisma.role.create({ data: { name: 'Gerencia', description: 'Gerencia y reportes' } });

        // PERMISSIONS
        const modules = ['patients', 'appointments', 'medical', 'billing', 'admin', 'reports', 'audit'];
        const actions = ['read', 'create', 'update', 'delete'];
        const permissions = [];
        for (const mod of modules) {
            for (const act of actions) {
                const perm = await prisma.permission.create({ data: { module: mod, action: act, description: `${act} ${mod}` } });
                permissions.push(perm);
            }
        }

        // Assign permissions
        const rolePermsMap = {
            [adminRole.id]: permissions,
            [recepcionRole.id]: permissions.filter(p => ['patients', 'appointments'].includes(p.module) || (p.module === 'medical' && p.action === 'read') || (p.module === 'billing' && p.action === 'read')),
            [medicoRole.id]: permissions.filter(p => (p.module === 'patients' && p.action === 'read') || (p.module === 'appointments' && ['read', 'update'].includes(p.action)) || p.module === 'medical' || (p.module === 'billing' && p.action === 'read')),
            [facturacionRole.id]: permissions.filter(p => (p.module === 'patients' && p.action === 'read') || (p.module === 'appointments' && p.action === 'read') || p.module === 'billing'),
            [gerenciaRole.id]: permissions.filter(p => p.module === 'reports' || (p.module === 'audit' && p.action === 'read') || (['patients', 'appointments', 'billing', 'medical'].includes(p.module) && p.action === 'read')),
        };
        for (const [roleId, perms] of Object.entries(rolePermsMap)) {
            for (const perm of perms) {
                await prisma.rolePermission.create({ data: { roleId: parseInt(roleId), permissionId: perm.id } });
            }
        }

        // USERS
        const passwordHash = await bcrypt.hash('Admin123!', 12);
        const medicoHash = await bcrypt.hash('Medico123!', 12);

        await prisma.user.create({ data: { username: 'admin', email: 'admin@clinicavidasalud.com', passwordHash, firstName: 'Carlos', lastName: 'Administrador', roleId: adminRole.id } });
        const drMartinez = await prisma.user.create({ data: { username: 'dra.martinez', email: 'martinez@clinicavidasalud.com', passwordHash: medicoHash, firstName: 'Ana', lastName: 'Martínez', roleId: medicoRole.id } });
        const drLopez = await prisma.user.create({ data: { username: 'dr.lopez', email: 'lopez@clinicavidasalud.com', passwordHash: medicoHash, firstName: 'Roberto', lastName: 'López', roleId: medicoRole.id } });
        const drRamirez = await prisma.user.create({ data: { username: 'dra.ramirez', email: 'ramirez@clinicavidasalud.com', passwordHash: medicoHash, firstName: 'María', lastName: 'Ramírez', roleId: medicoRole.id } });
        await prisma.user.create({ data: { username: 'recepcion', email: 'recepcion@clinicavidasalud.com', passwordHash: await bcrypt.hash('Recep123!', 12), firstName: 'Laura', lastName: 'García', roleId: recepcionRole.id } });
        await prisma.user.create({ data: { username: 'caja', email: 'caja@clinicavidasalud.com', passwordHash: await bcrypt.hash('Caja123!', 12), firstName: 'Pedro', lastName: 'Sánchez', roleId: facturacionRole.id } });
        await prisma.user.create({ data: { username: 'gerencia', email: 'gerencia@clinicavidasalud.com', passwordHash: await bcrypt.hash('Geren123!', 12), firstName: 'Diana', lastName: 'Torres', roleId: gerenciaRole.id } });

        // SPECIALTIES
        const specGeneral = await prisma.specialty.create({ data: { name: 'Medicina General', description: 'Atención médica general' } });
        const specPediatria = await prisma.specialty.create({ data: { name: 'Pediatría', description: 'Atención médica infantil' } });
        const specCardiologia = await prisma.specialty.create({ data: { name: 'Cardiología', description: 'Enfermedades del corazón' } });
        await prisma.specialty.create({ data: { name: 'Dermatología', description: 'Enfermedades de la piel' } });
        await prisma.specialty.create({ data: { name: 'Ginecología', description: 'Salud femenina' } });

        // DOCTORS
        const doctors = [];
        doctors.push(await prisma.doctor.create({ data: { userId: drMartinez.id, specialtyId: specGeneral.id, licenseNumber: 'MED-001', phone: '0991234567' } }));
        doctors.push(await prisma.doctor.create({ data: { userId: drLopez.id, specialtyId: specCardiologia.id, licenseNumber: 'MED-002', phone: '0991234568' } }));
        doctors.push(await prisma.doctor.create({ data: { userId: drRamirez.id, specialtyId: specPediatria.id, licenseNumber: 'MED-003', phone: '0991234569' } }));

        // SCHEDULES
        for (const doctor of doctors) {
            for (let day = 1; day <= 5; day++) {
                await prisma.doctorSchedule.create({ data: { doctorId: doctor.id, dayOfWeek: day, startTime: '08:00', endTime: '17:00', slotDuration: 30 } });
            }
        }

        // SERVICES
        const services = [
            { code: 'CONS-GEN', name: 'Consulta General', price: 35.00, category: 'consultation' },
            { code: 'CONS-ESP', name: 'Consulta Especialidad', price: 50.00, category: 'consultation' },
            { code: 'LAB-HEM', name: 'Hemograma Completo', price: 15.00, category: 'laboratory' },
            { code: 'IMG-RX', name: 'Radiografía', price: 40.00, category: 'imaging' },
            { code: 'ECG', name: 'Electrocardiograma', price: 30.00, category: 'procedure' },
        ];
        for (const s of services) { await prisma.service.create({ data: s }); }

        // SYSTEM PARAMETERS
        const params = [
            { key: 'clinic_name', value: 'Clínica Vida Salud' },
            { key: 'clinic_address', value: 'Av. República E7-123, Quito, Ecuador' },
            { key: 'clinic_phone', value: '022345678' },
            { key: 'default_slot_duration', value: '30' },
            { key: 'tax_rate', value: '12' },
        ];
        for (const p of params) { await prisma.systemParameter.create({ data: { ...p, description: p.key } }); }

        console.log('✅ Seed completed!');
        console.log('  admin / Admin123! → Administrador');
        console.log('  dra.martinez / Medico123! → Médico');
    } catch (error) {
        console.error('⚠️ Seed error (non-fatal):', error.message);
    }
}

module.exports = seedIfEmpty;
