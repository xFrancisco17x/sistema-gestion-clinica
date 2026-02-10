const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // ============ ROLES ============
    const roles = await Promise.all([
        prisma.role.upsert({ where: { name: 'Administrador' }, update: {}, create: { name: 'Administrador', description: 'Administrador del sistema' } }),
        prisma.role.upsert({ where: { name: 'Recepción' }, update: {}, create: { name: 'Recepción', description: 'Recepción y admisión' } }),
        prisma.role.upsert({ where: { name: 'Médico' }, update: {}, create: { name: 'Médico', description: 'Médico tratante' } }),
        prisma.role.upsert({ where: { name: 'Facturación' }, update: {}, create: { name: 'Facturación', description: 'Facturación y caja' } }),
        prisma.role.upsert({ where: { name: 'Gerencia' }, update: {}, create: { name: 'Gerencia', description: 'Gerencia y reportes' } }),
    ]);

    const [adminRole, recepcionRole, medicoRole, facturacionRole, gerenciaRole] = roles;

    // ============ PERMISSIONS ============
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

    // Recepción: patients (all), appointments (all), medical (read), billing (read)
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

    // Médico: patients (read), appointments (read,update), medical (all), billing (read)
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

    // Facturación: patients (read), appointments (read), billing (all)
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

    // Gerencia: reports (all), patients (read), appointments (read), billing (read), audit (read)
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

    // ============ USERS ============
    const passwordHash = await bcrypt.hash('Admin123!', 12);
    const medicoHash = await bcrypt.hash('Medico123!', 12);
    const recepHash = await bcrypt.hash('Recep123!', 12);
    const cajaHash = await bcrypt.hash('Caja123!', 12);
    const gerenHash = await bcrypt.hash('Geren123!', 12);

    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: { username: 'admin', email: 'admin@clinicavidasalud.com', passwordHash, firstName: 'Carlos', lastName: 'Administrador', roleId: adminRole.id }
    });

    const drMartinez = await prisma.user.upsert({
        where: { username: 'dra.martinez' },
        update: {},
        create: { username: 'dra.martinez', email: 'martinez@clinicavidasalud.com', passwordHash: medicoHash, firstName: 'Ana', lastName: 'Martínez', roleId: medicoRole.id }
    });

    const drLopez = await prisma.user.upsert({
        where: { username: 'dr.lopez' },
        update: {},
        create: { username: 'dr.lopez', email: 'lopez@clinicavidasalud.com', passwordHash: medicoHash, firstName: 'Roberto', lastName: 'López', roleId: medicoRole.id }
    });

    const drRamirez = await prisma.user.upsert({
        where: { username: 'dra.ramirez' },
        update: {},
        create: { username: 'dra.ramirez', email: 'ramirez@clinicavidasalud.com', passwordHash: medicoHash, firstName: 'María', lastName: 'Ramírez', roleId: medicoRole.id }
    });

    const recepcion = await prisma.user.upsert({
        where: { username: 'recepcion' },
        update: {},
        create: { username: 'recepcion', email: 'recepcion@clinicavidasalud.com', passwordHash: recepHash, firstName: 'Laura', lastName: 'García', roleId: recepcionRole.id }
    });

    const caja = await prisma.user.upsert({
        where: { username: 'caja' },
        update: {},
        create: { username: 'caja', email: 'caja@clinicavidasalud.com', passwordHash: cajaHash, firstName: 'Pedro', lastName: 'Sánchez', roleId: facturacionRole.id }
    });

    const gerencia = await prisma.user.upsert({
        where: { username: 'gerencia' },
        update: {},
        create: { username: 'gerencia', email: 'gerencia@clinicavidasalud.com', passwordHash: gerenHash, firstName: 'Diana', lastName: 'Torres', roleId: gerenciaRole.id }
    });

    // ============ SPECIALTIES ============
    const specialties = await Promise.all([
        prisma.specialty.upsert({ where: { name: 'Medicina General' }, update: {}, create: { name: 'Medicina General', description: 'Atención médica general' } }),
        prisma.specialty.upsert({ where: { name: 'Pediatría' }, update: {}, create: { name: 'Pediatría', description: 'Atención médica infantil' } }),
        prisma.specialty.upsert({ where: { name: 'Cardiología' }, update: {}, create: { name: 'Cardiología', description: 'Enfermedades del corazón' } }),
        prisma.specialty.upsert({ where: { name: 'Dermatología' }, update: {}, create: { name: 'Dermatología', description: 'Enfermedades de la piel' } }),
        prisma.specialty.upsert({ where: { name: 'Ginecología' }, update: {}, create: { name: 'Ginecología', description: 'Salud femenina' } }),
    ]);

    // ============ DOCTORS ============
    const doctors = await Promise.all([
        prisma.doctor.upsert({ where: { userId: drMartinez.id }, update: {}, create: { userId: drMartinez.id, specialtyId: specialties[0].id, licenseNumber: 'MED-001', phone: '0991234567' } }),
        prisma.doctor.upsert({ where: { userId: drLopez.id }, update: {}, create: { userId: drLopez.id, specialtyId: specialties[2].id, licenseNumber: 'MED-002', phone: '0991234568' } }),
        prisma.doctor.upsert({ where: { userId: drRamirez.id }, update: {}, create: { userId: drRamirez.id, specialtyId: specialties[1].id, licenseNumber: 'MED-003', phone: '0991234569' } }),
    ]);

    // ============ DOCTOR SCHEDULES ============
    for (const doctor of doctors) {
        for (let day = 1; day <= 5; day++) { // Monday to Friday
            await prisma.doctorSchedule.upsert({
                where: { doctorId_dayOfWeek: { doctorId: doctor.id, dayOfWeek: day } },
                update: {},
                create: { doctorId: doctor.id, dayOfWeek: day, startTime: '08:00', endTime: '17:00', slotDuration: 30 }
            });
        }
    }

    // ============ PATIENTS ============
    const patients = [];
    const patientData = [
        { idNumber: '1712345678', firstName: 'Juan', lastName: 'Pérez', dateOfBirth: new Date('1985-03-15'), gender: 'M', phone: '0987654321', email: 'juan.perez@email.com', bloodType: 'O+' },
        { idNumber: '1723456789', firstName: 'María', lastName: 'González', dateOfBirth: new Date('1990-07-22'), gender: 'F', phone: '0976543210', email: 'maria.gonzalez@email.com', bloodType: 'A+' },
        { idNumber: '1734567890', firstName: 'Carlos', lastName: 'Rodríguez', dateOfBirth: new Date('1978-11-05'), gender: 'M', phone: '0965432109', email: 'carlos.rodriguez@email.com', allergies: 'Penicilina' },
        { idNumber: '1745678901', firstName: 'Ana', lastName: 'López', dateOfBirth: new Date('1995-01-30'), gender: 'F', phone: '0954321098', email: 'ana.lopez@email.com', bloodType: 'B+' },
        { idNumber: '1756789012', firstName: 'Pedro', lastName: 'Martínez', dateOfBirth: new Date('1982-09-18'), gender: 'M', phone: '0943210987', bloodType: 'AB+' },
        { idNumber: '1767890123', firstName: 'Laura', lastName: 'Sánchez', dateOfBirth: new Date('1988-12-03'), gender: 'F', phone: '0932109876', email: 'laura.sanchez@email.com' },
        { idNumber: '1778901234', firstName: 'Diego', lastName: 'Torres', dateOfBirth: new Date('2010-04-10'), gender: 'M', phone: '0921098765', emergencyContactName: 'Lucia Torres', emergencyContactPhone: '0921098766' },
        { idNumber: '1789012345', firstName: 'Sofía', lastName: 'Ramírez', dateOfBirth: new Date('1975-06-25'), gender: 'F', phone: '0910987654', allergies: 'Aspirina, Ibuprofeno', bloodType: 'O-' },
        { idNumber: '1790123456', firstName: 'Andrés', lastName: 'Herrera', dateOfBirth: new Date('1992-08-14'), gender: 'M', phone: '0909876543', email: 'andres.herrera@email.com' },
        { idNumber: '1701234567', firstName: 'Valentina', lastName: 'Morales', dateOfBirth: new Date('2000-02-28'), gender: 'F', phone: '0898765432', email: 'valentina.morales@email.com', bloodType: 'A-' },
    ];

    for (let i = 0; i < patientData.length; i++) {
        const p = patientData[i];
        const patient = await prisma.patient.upsert({
            where: { idNumber: p.idNumber },
            update: {},
            create: {
                medicalRecordNumber: `HC-${String(i + 1).padStart(6, '0')}`,
                idType: 'cedula',
                ...p,
                address: `Calle ${i + 1}, Quito, Ecuador`,
            }
        });
        patients.push(patient);
    }

    // ============ SERVICES ============
    const services = await Promise.all([
        prisma.service.upsert({ where: { code: 'CONS-GEN' }, update: {}, create: { code: 'CONS-GEN', name: 'Consulta General', price: 35.00, category: 'consultation' } }),
        prisma.service.upsert({ where: { code: 'CONS-ESP' }, update: {}, create: { code: 'CONS-ESP', name: 'Consulta Especialidad', price: 50.00, category: 'consultation' } }),
        prisma.service.upsert({ where: { code: 'LAB-HEM' }, update: {}, create: { code: 'LAB-HEM', name: 'Hemograma Completo', price: 15.00, category: 'laboratory' } }),
        prisma.service.upsert({ where: { code: 'LAB-GLU' }, update: {}, create: { code: 'LAB-GLU', name: 'Glucosa en Ayunas', price: 10.00, category: 'laboratory' } }),
        prisma.service.upsert({ where: { code: 'IMG-RX' }, update: {}, create: { code: 'IMG-RX', name: 'Radiografía', price: 40.00, category: 'imaging' } }),
        prisma.service.upsert({ where: { code: 'IMG-ECO' }, update: {}, create: { code: 'IMG-ECO', name: 'Ecografía', price: 60.00, category: 'imaging' } }),
        prisma.service.upsert({ where: { code: 'PROC-CUR' }, update: {}, create: { code: 'PROC-CUR', name: 'Curación', price: 20.00, category: 'procedure' } }),
        prisma.service.upsert({ where: { code: 'PROC-INY' }, update: {}, create: { code: 'PROC-INY', name: 'Inyección', price: 10.00, category: 'procedure' } }),
        prisma.service.upsert({ where: { code: 'ECG' }, update: {}, create: { code: 'ECG', name: 'Electrocardiograma', price: 30.00, category: 'procedure' } }),
        prisma.service.upsert({ where: { code: 'CONS-PED' }, update: {}, create: { code: 'CONS-PED', name: 'Consulta Pediátrica', price: 40.00, category: 'consultation' } }),
    ]);

    // ============ INSURERS ============
    await Promise.all([
        prisma.insurer.upsert({ where: { name: 'Seguros Equinoccial' }, update: {}, create: { name: 'Seguros Equinoccial', ruc: '1790012345001', phone: '022567890', email: 'info@segurosequinoccial.com' } }),
        prisma.insurer.upsert({ where: { name: 'Humana S.A.' }, update: {}, create: { name: 'Humana S.A.', ruc: '1790023456001', phone: '022678901', email: 'info@humana.com' } }),
        prisma.insurer.upsert({ where: { name: 'BMI' }, update: {}, create: { name: 'BMI', ruc: '1790034567001', phone: '022789012', email: 'info@bmi.com' } }),
    ]);

    // ============ SAMPLE APPOINTMENTS ============
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 5; i++) {
        const aptDate = new Date(today);
        aptDate.setHours(8 + i, 0, 0, 0);
        const endDate = new Date(aptDate.getTime() + 30 * 60000);

        await prisma.appointment.upsert({
            where: { id: i + 1 },
            update: {},
            create: {
                patientId: patients[i].id,
                doctorId: doctors[0].id,
                dateTime: aptDate,
                endTime: endDate,
                reason: ['Control general', 'Dolor de cabeza', 'Revisión anual', 'Malestar estomacal', 'Control presión'][i],
                status: i < 2 ? 'attended' : 'scheduled'
            }
        });
    }

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
        await prisma.systemParameter.upsert({
            where: { key: p.key },
            update: {},
            create: p
        });
    }

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
