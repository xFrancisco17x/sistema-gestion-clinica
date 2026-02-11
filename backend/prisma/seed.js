const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Force single connection to avoid PgBouncer pool exhaustion
const dbUrl = process.env.DATABASE_URL || '';
const separator = dbUrl.includes('?') ? '&' : '?';
const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl + separator + 'connection_limit=1' } }
});

async function main() {
    console.log('🌱 Seeding database...');

    // ============ ROLES (sequential) ============
    const adminRole = await prisma.role.upsert({ where: { name: 'Administrador' }, update: {}, create: { name: 'Administrador', description: 'Administrador del sistema' } });
    const recepcionRole = await prisma.role.upsert({ where: { name: 'Recepción' }, update: {}, create: { name: 'Recepción', description: 'Recepción y admisión' } });
    const medicoRole = await prisma.role.upsert({ where: { name: 'Médico' }, update: {}, create: { name: 'Médico', description: 'Médico tratante' } });
    const facturacionRole = await prisma.role.upsert({ where: { name: 'Facturación' }, update: {}, create: { name: 'Facturación', description: 'Facturación y caja' } });
    const gerenciaRole = await prisma.role.upsert({ where: { name: 'Gerencia' }, update: {}, create: { name: 'Gerencia', description: 'Gerencia y reportes' } });

    console.log('  ✓ Roles');

    // ============ PERMISSIONS (sequential) ============
    const modules = ['patients', 'appointments', 'medical', 'billing', 'admin', 'reports', 'audit'];
    const actions = ['read', 'create', 'update', 'delete'];

    const permissions = [];
    for (const mod of modules) {
        for (const act of actions) {
            const perm = await prisma.permission.upsert({
                where: { module_action: { module: mod, action: act } },
                update: {},
                create: { module: mod, action: act, description: `${act} ${mod}` }
            });
            permissions.push(perm);
        }
    }

    // Admin gets all permissions
    for (const perm of permissions) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
            update: {},
            create: { roleId: adminRole.id, permissionId: perm.id }
        });
    }

    // Recepción permissions
    const recepPerms = permissions.filter(p =>
        ['patients', 'appointments'].includes(p.module) ||
        (p.module === 'medical' && p.action === 'read') ||
        (p.module === 'billing' && p.action === 'read')
    );
    for (const perm of recepPerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: recepcionRole.id, permissionId: perm.id } },
            update: {},
            create: { roleId: recepcionRole.id, permissionId: perm.id }
        });
    }

    // Médico permissions
    const medPerms = permissions.filter(p =>
        (p.module === 'patients' && p.action === 'read') ||
        (p.module === 'appointments' && ['read', 'update'].includes(p.action)) ||
        p.module === 'medical' ||
        (p.module === 'billing' && p.action === 'read')
    );
    for (const perm of medPerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: medicoRole.id, permissionId: perm.id } },
            update: {},
            create: { roleId: medicoRole.id, permissionId: perm.id }
        });
    }

    // Facturación permissions
    const factPerms = permissions.filter(p =>
        (p.module === 'patients' && p.action === 'read') ||
        (p.module === 'appointments' && p.action === 'read') ||
        p.module === 'billing'
    );
    for (const perm of factPerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: facturacionRole.id, permissionId: perm.id } },
            update: {},
            create: { roleId: facturacionRole.id, permissionId: perm.id }
        });
    }

    // Gerencia permissions
    const gerPerms = permissions.filter(p =>
        p.module === 'reports' ||
        (p.module === 'audit' && p.action === 'read') ||
        (['patients', 'appointments', 'billing', 'medical'].includes(p.module) && p.action === 'read')
    );
    for (const perm of gerPerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: gerenciaRole.id, permissionId: perm.id } },
            update: {},
            create: { roleId: gerenciaRole.id, permissionId: perm.id }
        });
    }

    console.log('  ✓ Permissions');

    // ============ USERS (sequential) ============
    const passwordHash = await bcrypt.hash('Admin123!', 12);
    const medicoHash = await bcrypt.hash('Medico123!', 12);
    const recepHash = await bcrypt.hash('Recep123!', 12);
    const cajaHash = await bcrypt.hash('Caja123!', 12);
    const gerenHash = await bcrypt.hash('Geren123!', 12);

    const admin = await prisma.user.upsert({ where: { username: 'admin' }, update: {}, create: { username: 'admin', email: 'admin@clinicavidasalud.com', passwordHash, firstName: 'Carlos', lastName: 'Administrador', roleId: adminRole.id } });
    const drMartinez = await prisma.user.upsert({ where: { username: 'dra.martinez' }, update: {}, create: { username: 'dra.martinez', email: 'martinez@clinicavidasalud.com', passwordHash: medicoHash, firstName: 'Ana', lastName: 'Martínez', roleId: medicoRole.id } });
    const drLopez = await prisma.user.upsert({ where: { username: 'dr.lopez' }, update: {}, create: { username: 'dr.lopez', email: 'lopez@clinicavidasalud.com', passwordHash: medicoHash, firstName: 'Roberto', lastName: 'López', roleId: medicoRole.id } });
    const drRamirez = await prisma.user.upsert({ where: { username: 'dra.ramirez' }, update: {}, create: { username: 'dra.ramirez', email: 'ramirez@clinicavidasalud.com', passwordHash: medicoHash, firstName: 'María', lastName: 'Ramírez', roleId: medicoRole.id } });
    await prisma.user.upsert({ where: { username: 'recepcion' }, update: {}, create: { username: 'recepcion', email: 'recepcion@clinicavidasalud.com', passwordHash: recepHash, firstName: 'Laura', lastName: 'García', roleId: recepcionRole.id } });
    await prisma.user.upsert({ where: { username: 'caja' }, update: {}, create: { username: 'caja', email: 'caja@clinicavidasalud.com', passwordHash: cajaHash, firstName: 'Pedro', lastName: 'Sánchez', roleId: facturacionRole.id } });
    await prisma.user.upsert({ where: { username: 'gerencia' }, update: {}, create: { username: 'gerencia', email: 'gerencia@clinicavidasalud.com', passwordHash: gerenHash, firstName: 'Diana', lastName: 'Torres', roleId: gerenciaRole.id } });

    console.log('  ✓ Users');

    // ============ SPECIALTIES (sequential) ============
    const specGeneral = await prisma.specialty.upsert({ where: { name: 'Medicina General' }, update: {}, create: { name: 'Medicina General', description: 'Atención médica general' } });
    const specPediatria = await prisma.specialty.upsert({ where: { name: 'Pediatría' }, update: {}, create: { name: 'Pediatría', description: 'Atención médica infantil' } });
    const specCardiologia = await prisma.specialty.upsert({ where: { name: 'Cardiología' }, update: {}, create: { name: 'Cardiología', description: 'Enfermedades del corazón' } });
    await prisma.specialty.upsert({ where: { name: 'Dermatología' }, update: {}, create: { name: 'Dermatología', description: 'Enfermedades de la piel' } });
    await prisma.specialty.upsert({ where: { name: 'Ginecología' }, update: {}, create: { name: 'Ginecología', description: 'Salud femenina' } });

    console.log('  ✓ Specialties');

    // ============ DOCTORS (sequential) ============
    const doc1 = await prisma.doctor.upsert({ where: { userId: drMartinez.id }, update: {}, create: { userId: drMartinez.id, specialtyId: specGeneral.id, licenseNumber: 'MED-001', phone: '0991234567' } });
    const doc2 = await prisma.doctor.upsert({ where: { userId: drLopez.id }, update: {}, create: { userId: drLopez.id, specialtyId: specCardiologia.id, licenseNumber: 'MED-002', phone: '0991234568' } });
    const doc3 = await prisma.doctor.upsert({ where: { userId: drRamirez.id }, update: {}, create: { userId: drRamirez.id, specialtyId: specPediatria.id, licenseNumber: 'MED-003', phone: '0991234569' } });

    console.log('  ✓ Doctors');

    // ============ DOCTOR SCHEDULES ============
    for (const doctor of [doc1, doc2, doc3]) {
        for (let day = 1; day <= 5; day++) {
            await prisma.doctorSchedule.upsert({
                where: { doctorId_dayOfWeek: { doctorId: doctor.id, dayOfWeek: day } },
                update: {},
                create: { doctorId: doctor.id, dayOfWeek: day, startTime: '08:00', endTime: '17:00', slotDuration: 30 }
            });
        }
    }

    console.log('  ✓ Doctor schedules');

    // ============ PATIENTS (sequential) ============
    const patientData = [
        { idNumber: '1712345678', firstName: 'Juan', lastName: 'Pérez', dateOfBirth: new Date('1985-03-15'), gender: 'M', phone: '0987654321', email: 'juan.perez@email.com', bloodType: 'O+' },
        { idNumber: '1723456789', firstName: 'María', lastName: 'González', dateOfBirth: new Date('1990-07-22'), gender: 'F', phone: '0976543210', email: 'maria.gonzalez@email.com', bloodType: 'A+' },
        { idNumber: '1734567890', firstName: 'Carlos', lastName: 'Rodríguez', dateOfBirth: new Date('1978-11-05'), gender: 'M', phone: '0965432109', email: 'carlos.rodriguez@email.com', allergies: 'Penicilina' },
        { idNumber: '1745678901', firstName: 'Ana', lastName: 'López', dateOfBirth: new Date('1995-01-30'), gender: 'F', phone: '0954321098', email: 'ana.lopez@email.com', bloodType: 'B+' },
        { idNumber: '1756789012', firstName: 'Pedro', lastName: 'Martínez', dateOfBirth: new Date('1982-09-18'), gender: 'M', phone: '0943210987', bloodType: 'AB+' },
    ];

    const patients = [];
    for (let i = 0; i < patientData.length; i++) {
        const p = patientData[i];
        const patient = await prisma.patient.upsert({
            where: { idNumber: p.idNumber },
            update: {},
            create: { medicalRecordNumber: `HC-${String(i + 1).padStart(6, '0')}`, idType: 'cedula', ...p, address: `Calle ${i + 1}, Quito, Ecuador` }
        });
        patients.push(patient);
    }

    console.log('  ✓ Patients');

    // ============ SERVICES (sequential) ============
    const servicesData = [
        { code: 'CONS-GEN', name: 'Consulta General', price: 35.00, category: 'consultation' },
        { code: 'CONS-ESP', name: 'Consulta Especialidad', price: 50.00, category: 'consultation' },
        { code: 'LAB-HEM', name: 'Hemograma Completo', price: 15.00, category: 'laboratory' },
        { code: 'LAB-GLU', name: 'Glucosa en Ayunas', price: 10.00, category: 'laboratory' },
        { code: 'IMG-RX', name: 'Radiografía', price: 40.00, category: 'imaging' },
        { code: 'IMG-ECO', name: 'Ecografía', price: 60.00, category: 'imaging' },
        { code: 'PROC-CUR', name: 'Curación', price: 20.00, category: 'procedure' },
        { code: 'PROC-INY', name: 'Inyección', price: 10.00, category: 'procedure' },
        { code: 'ECG', name: 'Electrocardiograma', price: 30.00, category: 'procedure' },
        { code: 'CONS-PED', name: 'Consulta Pediátrica', price: 40.00, category: 'consultation' },
    ];
    for (const s of servicesData) {
        await prisma.service.upsert({ where: { code: s.code }, update: {}, create: s });
    }

    console.log('  ✓ Services');

    // ============ INSURERS (sequential) ============
    await prisma.insurer.upsert({ where: { name: 'Seguros Equinoccial' }, update: {}, create: { name: 'Seguros Equinoccial', ruc: '1790012345001', phone: '022567890', email: 'info@segurosequinoccial.com' } });
    await prisma.insurer.upsert({ where: { name: 'Humana S.A.' }, update: {}, create: { name: 'Humana S.A.', ruc: '1790023456001', phone: '022678901', email: 'info@humana.com' } });
    await prisma.insurer.upsert({ where: { name: 'BMI' }, update: {}, create: { name: 'BMI', ruc: '1790034567001', phone: '022789012', email: 'info@bmi.com' } });

    console.log('  ✓ Insurers');

    // ============ SYSTEM PARAMETERS ============
    const params = [
        { key: 'clinic_name', value: 'Clínica Vida Salud', description: 'Nombre de la clínica' },
        { key: 'clinic_address', value: 'Av. República E7-123, Quito, Ecuador', description: 'Dirección' },
        { key: 'clinic_phone', value: '022345678', description: 'Teléfono principal' },
        { key: 'clinic_email', value: 'info@clinicavidasalud.com', description: 'Email de contacto' },
        { key: 'default_slot_duration', value: '30', description: 'Duración de cita por defecto (minutos)' },
        { key: 'tax_rate', value: '12', description: 'Tasa de impuesto (%)' },
        { key: 'work_start_time', value: '08:00', description: 'Hora de inicio de atención' },
        { key: 'work_end_time', value: '17:00', description: 'Hora de fin de atención' },
    ];
    for (const p of params) {
        await prisma.systemParameter.upsert({ where: { key: p.key }, update: {}, create: p });
    }

    console.log('  ✓ System parameters');

    console.log('✅ Seed completed!');
    console.log('\n📋 Demo users:');
    console.log('  admin / Admin123!     → Administrador');
    console.log('  dra.martinez / Medico123! → Médico (Medicina General)');
    console.log('  dr.lopez / Medico123!     → Médico (Cardiología)');
    console.log('  dra.ramirez / Medico123!  → Médico (Pediatría)');
    console.log('  recepcion / Recep123! → Recepción');
    console.log('  caja / Caja123!       → Facturación');
    console.log('  gerencia / Geren123!  → Gerencia');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
