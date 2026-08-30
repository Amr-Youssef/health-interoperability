import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../../security/auth-middleware.js';
import { v4 as uuidv4 } from 'uuid';
const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-national-health-key-2026';
async function ensureDefaultAccounts() {
    const [sysAdminRole, hospitalAdminRole, patientRole] = await Promise.all([
        prisma.role.upsert({
            where: { role_code: 'SYS_ADMIN' },
            update: {},
            create: {
                role_name: 'System Administrator',
                role_code: 'SYS_ADMIN',
                description: 'Global system administrator',
                is_system_role: true
            }
        }),
        prisma.role.upsert({
            where: { role_code: 'HOSPITAL_ADMIN' },
            update: {},
            create: {
                role_name: 'Hospital Administrator',
                role_code: 'HOSPITAL_ADMIN',
                description: 'Hospital level admin',
                is_system_role: false
            }
        }),
        prisma.role.upsert({
            where: { role_code: 'PATIENT' },
            update: {},
            create: {
                role_name: 'Patient',
                role_code: 'PATIENT',
                description: 'Individual Patient Access',
                is_system_role: true
            }
        })
    ]);
    let mohOrg = await prisma.organization.findFirst({ where: { organization_type: 'MOH' } });
    if (!mohOrg) {
        mohOrg = await prisma.organization.create({
            data: {
                organization_name: 'Ministry of Health',
                organization_name_ar: 'وزارة الصحة',
                organization_type: 'MOH',
                region: 'National',
                status: 'ACTIVE'
            }
        });
    }
    const hospitalOrg = await prisma.organization.findFirst({ where: { organization_type: 'HOSPITAL' } })
        ?? await prisma.organization.create({
            data: {
                organization_name: 'Hospital A',
                organization_name_ar: 'مستشفى أ',
                organization_type: 'HOSPITAL',
                region: 'Riyadh',
                status: 'ACTIVE'
            }
        });
    const adminHash = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: { password_hash: adminHash, full_name: 'System Admin', role_id: sysAdminRole.id, organization_id: mohOrg.id, is_active: true },
        create: {
            username: 'admin',
            password_hash: adminHash,
            full_name: 'System Admin',
            role_id: sysAdminRole.id,
            organization_id: mohOrg.id,
            is_active: true
        }
    });
    const hospitalHash = await bcrypt.hash('pass123', 10);
    await prisma.user.upsert({
        where: { username: 'hospital_a' },
        update: { password_hash: hospitalHash, full_name: 'Hospital A Administrator', role_id: hospitalAdminRole.id, organization_id: hospitalOrg.id, is_active: true },
        create: {
            username: 'hospital_a',
            password_hash: hospitalHash,
            full_name: 'Hospital A Administrator',
            role_id: hospitalAdminRole.id,
            organization_id: hospitalOrg.id,
            is_active: true
        }
    });
    const patientHash = await bcrypt.hash('patient123', 10);
    let patient = await prisma.patient.findUnique({ where: { internal_id: '1088445566' } });
    if (!patient) {
        patient = await prisma.patient.create({
            data: {
                internal_id: '1088445566',
                first_name: 'Ahmed',
                last_name: 'Al-Rashidi',
                first_name_ar: 'أحمد',
                last_name_ar: 'الرشيدي',
                gender: 'male',
                birth_date: new Date('1985-05-12'),
                status: 'ACTIVE'
            }
        });
        const existingIdentifier = await prisma.patientIdentifier.findFirst({
            where: { patient_id: patient.id, value: '1088445566' }
        });
        if (!existingIdentifier) {
            await prisma.patientIdentifier.create({
                data: {
                    patient_id: patient.id,
                    value: '1088445566',
                    type: 'NID',
                    system: 'urn:sa:nca:nid'
                }
            });
        }
    }
    await prisma.user.upsert({
        where: { username: 'patient' },
        update: {
            password_hash: patientHash,
            full_name: 'أحمد الرشيدي (Ahmed Al-Rashidi)',
            role_id: patientRole.id,
            organization_id: mohOrg.id,
            patient_profile_id: patient.id,
            is_active: true
        },
        create: {
            username: 'patient',
            password_hash: patientHash,
            full_name: 'أحمد الرشيدي (Ahmed Al-Rashidi)',
            role_id: patientRole.id,
            organization_id: mohOrg.id,
            patient_profile_id: patient.id,
            is_active: true
        }
    });
}
router.post('/register', async (req, res) => {
    try {
        const { username, password, full_name, roleType, organization_name, patient_profile } = req.body;
        if (!username || !password || !full_name || !roleType) {
            return res.status(400).json({ error: 'Username, password, full_name, and roleType are required' });
        }
        // Determine the role
        const roleCode = roleType === 'PATIENT' ? 'PATIENT' : 'HOSPITAL_ADMIN';
        let role = await prisma.role.findUnique({ where: { role_code: roleCode } });
        // If role doesn't exist (seed missing), create it
        if (!role) {
            role = await prisma.role.create({
                data: {
                    role_name: roleCode,
                    role_code: roleCode,
                    is_system_role: true
                }
            });
        }
        const password_hash = await bcrypt.hash(password, 10);
        let organization_id;
        let patient_profile_id = null;
        if (roleCode === 'HOSPITAL_ADMIN') {
            if (!organization_name) {
                return res.status(400).json({ error: 'organization_name is required for hospitals' });
            }
            const org = await prisma.organization.create({
                data: {
                    organization_name,
                    organization_type: 'HOSPITAL',
                    status: 'ACTIVE'
                }
            });
            organization_id = org.id;
        }
        else {
            // PATIENT
            // Find default MOH org or create one
            let mohOrg = await prisma.organization.findFirst({ where: { organization_type: 'MOH' } });
            if (!mohOrg) {
                mohOrg = await prisma.organization.create({
                    data: {
                        organization_name: 'Ministry of Health',
                        organization_type: 'MOH',
                        status: 'ACTIVE'
                    }
                });
            }
            organization_id = mohOrg.id;
            // Create Patient profile
            const patient = await prisma.patient.create({
                data: {
                    internal_id: uuidv4(),
                    first_name: full_name.split(' ')[0],
                    last_name: full_name.split(' ').slice(1).join(' '),
                    status: 'ACTIVE'
                }
            });
            patient_profile_id = patient.id;
            // Save patient profile data if provided
            if (patient_profile) {
                try {
                    await prisma.patientProfile.create({
                        data: {
                            patient_id: patient.id,
                            preferred_first_name: patient_profile.preferred_first_name,
                            preferred_last_name: patient_profile.preferred_last_name,
                            preferred_language: patient_profile.preferred_language,
                            emergency_contact_name: patient_profile.emergency_contact_name,
                            emergency_contact_phone: patient_profile.emergency_contact_phone,
                            emergency_contact_relationship: patient_profile.emergency_contact_relationship,
                            address_line: patient_profile.address_line,
                            address_city: patient_profile.address_city,
                            address_district: patient_profile.address_district,
                            address_postal_code: patient_profile.address_postal_code,
                            source: 'PATIENT',
                            verification_status: 'SELF_REPORTED',
                            recorded_at: new Date(),
                            notes: 'Created during patient registration'
                        }
                    });
                }
                catch (profileErr) {
                    console.warn('Warning: Failed to save patient profile during registration, but user created', profileErr);
                }
            }
        }
        const user = await prisma.user.create({
            data: {
                username,
                password_hash,
                full_name,
                role_id: role.id,
                organization_id,
                patient_profile_id,
                is_active: true
            },
            include: { role: true, organization: true }
        });
        const token = jwt.sign({ userId: user.id, role: user.role.role_code, orgId: user.organization_id }, JWT_SECRET, { expiresIn: '8h' });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role.role_code,
                organization: user.organization?.organization_name,
                orgId: user.organization_id,
                patientProfileId: user.patient_profile_id
            }
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error during registration' });
    }
});
router.post('/login', async (req, res) => {
    try {
        await ensureDefaultAccounts();
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const user = await prisma.user.findUnique({
            where: { username },
            include: { role: true, organization: true }
        });
        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'Invalid credentials or inactive user' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id, role: user.role.role_code, orgId: user.organization_id, patientProfileId: user.patient_profile_id }, JWT_SECRET, { expiresIn: '8h' });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role.role_code,
                organization: user.organization?.organization_name,
                orgId: user.organization_id,
                patientProfileId: user.patient_profile_id
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});
router.get('/me', verifyToken, (req, res) => {
    // req.user is injected by verifyToken middleware
    const user = req.user;
    res.json({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role?.role_code || 'UNKNOWN',
        organization: user.organization?.organization_name,
        orgId: user.organization_id,
        patientProfileId: user.patient_profile_id
    });
});
export const authRoutes = router;
//# sourceMappingURL=auth-routes.js.map