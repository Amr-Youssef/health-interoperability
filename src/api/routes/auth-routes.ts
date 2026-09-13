import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../../security/auth-middleware.js';
import { prisma } from '../../lib/prisma.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../../config/jwt.js';

const router = Router();

function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('shiep_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });
}

// ---------------- Validation helpers for trusted patient data ----------------
function isValidSaudiNationalId(id: string): boolean {
  return /^(1|2)\d{9}$/.test(id.trim());
}
function normalizeSaudiPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-\(\)]/g, '');
  if (/^05\d{8}$/.test(cleaned)) return '+966' + cleaned.substring(1);
  if (/^5\d{8}$/.test(cleaned)) return '+966' + cleaned;
  if (/^9665\d{8}$/.test(cleaned)) return '+' + cleaned;
  if (/^\+9665\d{8}$/.test(cleaned)) return cleaned;
  return null;
}
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function normalizeGender(g: string): 'male' | 'female' | null {
  const v = g.trim().toLowerCase();
  if (['male', 'ذكر', 'm'].includes(v)) return 'male';
  if (['female', 'أنثى', 'انثى', 'f'].includes(v)) return 'female';
  return null;
}

// Short-circuit so warm instances skip re-seeding for 5 minutes (single cheap lookup).
let seedHealthyUntil = 0;
async function ensureDefaultAccounts() {
  const now = Date.now();
  if (now < seedHealthyUntil) return;
  // Fast path: if the sentinel SYS_ADMIN exists and is active, the seed is healthy —
  // skip ~10 writes + 5 bcrypt hashes on every login (serverless timeout source).
  try {
    const sentinel = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true, is_active: true, role: { select: { role_code: true } } }
    });
    if (sentinel?.is_active && sentinel.role?.role_code === 'SYS_ADMIN') {
      seedHealthyUntil = now + 5 * 60 * 1000;
      return;
    }
  } catch { /* fall through to full seeding on lookup failure */ }
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

  const [sysAdminRole, hospitalAdminRole, patientRole, mohAdminRole, mohAuditorRole, clinicianRole] = await Promise.all([
    prisma.role.upsert({ where: { role_code: 'SYS_ADMIN' }, update: {}, create: { role_name: 'System Administrator', role_code: 'SYS_ADMIN', description: 'Global system administrator - infra only', is_system_role: true } }),
    prisma.role.upsert({ where: { role_code: 'HOSPITAL_ADMIN' }, update: {}, create: { role_name: 'Hospital Administrator', role_code: 'HOSPITAL_ADMIN', description: 'Hospital level admin', is_system_role: false } }),
    prisma.role.upsert({ where: { role_code: 'PATIENT' }, update: {}, create: { role_name: 'Patient', role_code: 'PATIENT', description: 'Individual Patient Access', is_system_role: true } }),
    prisma.role.upsert({ where: { role_code: 'MOH_ADMIN' }, update: {}, create: { role_name: 'MOH Administrator', role_code: 'MOH_ADMIN', description: 'Ministry of Health National Administrator', is_system_role: true } }),
    prisma.role.upsert({ where: { role_code: 'MOH_AUDITOR' }, update: {}, create: { role_name: 'MOH Auditor', role_code: 'MOH_AUDITOR', description: 'Read-only auditor', is_system_role: true } }),
    prisma.role.upsert({ where: { role_code: 'CLINICIAN' }, update: {}, create: { role_name: 'Clinician', role_code: 'CLINICIAN', description: 'Hospital clinician', is_system_role: false } })
  ]);

  await prisma.user.upsert({
    where: { username: 'moh_admin' },
    update: { password_hash: await bcrypt.hash('moh123456', 10), role_id: mohAdminRole.id, organization_id: mohOrg.id, is_active: true, full_name: 'MOH National Admin' },
    create: { username: 'moh_admin', password_hash: await bcrypt.hash('moh123456', 10), full_name: 'MOH National Admin', role_id: mohAdminRole.id, organization_id: mohOrg.id, is_active: true }
  });

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
  await prisma.user.upsert({
    where: { username: 'moh_auditor' },
    update: { password_hash: await bcrypt.hash('auditor123', 10), role_id: mohAuditorRole.id, organization_id: mohOrg.id, is_active: true, full_name: 'MOH Auditor' },
    create: { username: 'moh_auditor', password_hash: await bcrypt.hash('auditor123', 10), full_name: 'MOH Auditor', role_id: mohAuditorRole.id, organization_id: mohOrg.id, is_active: true }
  });
  await prisma.user.upsert({
    where: { username: 'clinician' },
    update: { password_hash: await bcrypt.hash('clinician123', 10), role_id: clinicianRole.id, organization_id: hospitalOrg.id, is_active: true, full_name: 'Hospital Clinician' },
    create: { username: 'clinician', password_hash: await bcrypt.hash('clinician123', 10), full_name: 'Hospital Clinician', role_id: clinicianRole.id, organization_id: hospitalOrg.id, is_active: true }
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
  seedHealthyUntil = Date.now() + 5 * 60 * 1000;
}

  router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, full_name, roleType, organization_name, organization_name_ar, region, facility_type, organization_id: orgIdParam, patient_profile, nationalId, birthDate, gender, phone, email } = req.body;

    if (!username || !password || !full_name || !roleType) {
      return res.status(400).json({ error: 'Username, password, full_name, and roleType are required' });
    }

    // Password strength: min 8 chars, at least one letter and one digit
    if (password.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور ضعيفة: يجب أن تكون 8 أحرف على الأقل' });
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تحتوي على حروف وأرقام' });
    }

    // Check username uniqueness early
    const existingUsername = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (existingUsername) {
      return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً. يرجى اختيار اسم آخر' });
    }
    if (email && email.trim()) {
      const existingEmail = await prisma.user.findFirst({ where: { email: email.trim() } });
      if (existingEmail) {
        return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
      }
    }

    if (['MOH_ADMIN','SYS_ADMIN','MOH_AUDITOR'].includes(roleType)) {
      return res.status(403).json({ error: 'إنشاء حساب أدمن/مدقق وطني متاح فقط من داخل نظام الأدمن (Invite-only)' });
    }
    const allowedPublic = ['PATIENT','HOSPITAL_ADMIN','CLINICIAN'];
    if (!allowedPublic.includes(roleType)) return res.status(400).json({ error: 'roleType غير صالح' });
    const roleCode = roleType as any;
    let role = await prisma.role.findUnique({ where: { role_code: roleCode } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          role_name: roleCode,
          role_code: roleCode,
          is_system_role: true
        }
      });
    }

    let organization_id: string | null = orgIdParam || null;
    let patient_profile_id: string | null = null;

    if (roleCode === 'HOSPITAL_ADMIN') {
      // ===== HOSPITAL: Trusted organizational data =====
      if (!organization_name || !organization_name.trim()) {
        return res.status(400).json({ error: 'اسم المنشأة بالإنجليزية مطلوب' });
      }
      if (organization_name.trim().length < 3 || organization_name.trim().length > 120) {
        return res.status(400).json({ error: 'اسم المنشأة بالإنجليزية يجب أن يكون بين 3 و 120 حرفاً' });
      }
      if (!organization_name_ar || !organization_name_ar.trim()) {
        return res.status(400).json({ error: 'اسم المنشأة بالعربية مطلوب لضمان بيانات موثوقة' });
      }
      if (organization_name_ar.trim().length < 3 || organization_name_ar.trim().length > 120) {
        return res.status(400).json({ error: 'اسم المنشأة بالعربية يجب أن يكون بين 3 و 120 حرفاً' });
      }
      // Arabic name validation (must contain Arabic letters)
      if (!/[\u0600-\u06FF]/.test(organization_name_ar.trim())) {
        return res.status(400).json({ error: 'اسم المنشأة بالعربية يجب أن يحتوي على حروف عربية' });
      }
      if (!region || !region.trim()) {
        return res.status(400).json({ error: 'المنطقة الإدارية مطلوبة' });
      }
      const allowedRegions = ['Riyadh','Makkah','Eastern','Madinah','Asir','Qassim','Hail','Tabuk','Najran','Jazan','AlBaha','AlJawf','NorthernBorders','Riyadh_region','Makkah_region','Eastern_region'];
      const regionNorm = region.trim();
      // Allow Arabic region names too
      const regionAllowed = ['الرياض','مكة المكرمة','المنطقة الشرقية','المدينة المنورة','عسير','القصيم','حائل','تبوك','نجران','جازان','الباحة','الجوف','الحدود الشمالية','Riyadh','Makkah','Eastern','Madinah','Asir','Riyadh Region','Makkah Region'];
      if (regionNorm.length < 2 || regionNorm.length > 50) {
        return res.status(400).json({ error: 'اسم المنطقة غير صالح' });
      }

      // Facility type validation (organization_type)
      const allowedFacilityTypes = ['HOSPITAL','CLINIC','DAY_SURGERY','LABORATORY','PHARMACY','CENTER','hospital','clinic','day_surgery','laboratory'];
      let orgTypeNorm = 'HOSPITAL';
      if (facility_type) {
        const ft = String(facility_type).trim().toUpperCase();
        if (['HOSPITAL','CLINIC','DAY_SURGERY','LABORATORY','PHARMACY','CENTER'].includes(ft)) {
          orgTypeNorm = ft;
        } else if (['hospital','clinic','laboratory'].includes(String(facility_type).toLowerCase())) {
          orgTypeNorm = String(facility_type).toUpperCase();
        } else {
          return res.status(400).json({ error: 'نوع المنشأة غير صالح' });
        }
      }

      // Phone & email mandatory for hospital contact reliability
      if (!phone || !phone.trim()) {
        return res.status(400).json({ error: 'رقم جوال مسؤول المنشأة مطلوب (05xxxxxxxx)' });
      }
      const normalizedHospPhone = normalizeSaudiPhone(phone.trim());
      if (!normalizedHospPhone) {
        return res.status(400).json({ error: 'رقم الجوال غير صحيح: يجب أن يكون رقم سعودي يبدأ بـ 05 أو +9665' });
      }
      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'البريد الإلكتروني الرسمي للمنشأة مطلوب' });
      }
      if (!isValidEmail(email.trim())) {
        return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' });
      }
      const emailNormHosp = email.trim().toLowerCase();
      const dupHospEmail = await prisma.user.findFirst({ where: { email: emailNormHosp } });
      if (dupHospEmail) {
        return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
      }
      // Full name for hospital admin
      if (!full_name || full_name.trim().length < 3 || full_name.trim().length > 80) {
        return res.status(400).json({ error: 'الاسم الكامل لمسؤول المنشأة يجب أن يكون بين 3 و 80 حرفاً' });
      }
      const namePartsHosp = full_name.trim().split(/\s+/);
      if (namePartsHosp.length < 2) {
        return res.status(400).json({ error: 'الاسم الكامل يجب أن يحتوي على الاسم الأول واسم العائلة' });
      }

      const dupOrg = await prisma.organization.findFirst({
        where: {
          OR: [
            { organization_name: organization_name.trim() },
            { organization_name_ar: organization_name_ar.trim() }
          ]
        }
      });
      let org: any;
      if (dupOrg) {
        if (dupOrg.status === 'PENDING_APPROVAL') {
          org = dupOrg;
          try {
            await prisma.auditLog.create({ data: { entity_type: 'Organization', entity_id: org.id, action: 'HOSPITAL_CLAIMED_BY_ADMIN', actor_id: null, organization_id: org.id, details: `Pending org ${org.organization_name_ar} claimed by registering admin ${username.trim()}` } });
          } catch {}
        } else {
          return res.status(400).json({ error: 'اسم المنشأة مسجل مسبقاً (العربي أو الإنجليزي) ومنشأة نشطة بنفس الاسم' });
        }
      } else {
        org = await prisma.organization.create({
          data: {
            organization_name: organization_name.trim(),
            organization_name_ar: organization_name_ar.trim(),
            organization_type: orgTypeNorm,
            region: regionNorm,
            status: 'PENDING_APPROVAL'
          }
        });
      }
      organization_id = org.id;

      // Defer DynamicHospital onboarding until MOH approval - only audit pending registration
      try {
        await prisma.auditLog.create({
          data: {
            entity_type: 'Organization',
            entity_id: org.id,
            action: 'HOSPITAL_REGISTER_PENDING',
            actor_id: null,
            organization_id: org.id,
            new_values: JSON.stringify({ organization_name: org.organization_name, organization_name_ar: org.organization_name_ar, region: org.region, status: org.status }),
            details: `Hospital registration pending MOH approval: ${org.organization_name_ar}`
          }
        });
      } catch (e) {}
      const password_hash_hosp = await bcrypt.hash(password, 10);
      const userHosp = await prisma.user.create({
        data: {
          username: username.trim(),
          password_hash: password_hash_hosp,
          full_name: full_name.trim(),
          email: emailNormHosp,
          phone: normalizedHospPhone,
          role_id: role.id,
          organization_id,
          patient_profile_id: null,
          is_active: true
        },
        include: { role: true, organization: true }
      });

      // Audit - hospital trusted registration
      try {
        await prisma.auditLog.create({
          data: {
            entity_type: 'Organization',
            entity_id: org.id,
            action: 'HOSPITAL_REGISTER_TRUSTED',
            actor_id: userHosp.id,
            organization_id: org.id,
            new_values: JSON.stringify({ organization_name: org.organization_name, organization_name_ar: org.organization_name_ar, region: org.region, organization_type: org.organization_type, adminUsername: userHosp.username }),
            details: `Trusted hospital registration: ${org.organization_name_ar} (${org.organization_name}) in ${org.region}`
          }
        });
      } catch (e) { /* best effort */ }

      const tokenHosp = jwt.sign(
        { userId: userHosp.id, role: userHosp.role.role_code, orgId: userHosp.organization_id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } as any
      );
      setAuthCookie(res, tokenHosp);
      return res.json({
        token: tokenHosp,
        user: {
          id: userHosp.id,
          username: userHosp.username,
          fullName: userHosp.full_name,
          role: userHosp.role.role_code,
          organization: userHosp.organization?.organization_name,
          organizationAr: (userHosp.organization as any)?.organization_name_ar,
          orgId: userHosp.organization_id,
          patientProfileId: userHosp.patient_profile_id
        }
      });
    } else if (roleCode === 'CLINICIAN') {
      if (!organization_id || !String(organization_id).trim()) {
        return res.status(400).json({ error: 'يجب اختيار المنشأة التي يتبع لها الطبيب (Organization)' });
      }
      const org = await prisma.organization.findUnique({ where: { id: String(organization_id as string).trim() } });
      if (!org) return res.status(404).json({ error: 'المنشأة المختارة غير موجودة' });
      if (org.status !== 'ACTIVE') return res.status(403).json({ error: `المنشأة غير معتمدة - الحالة: ${org.status} - لا يمكن ربط طبيب بمنشأة غير نشطة` });
      if (!phone || !phone.trim()) return res.status(400).json({ error: 'رقم جوال الطبيب مطلوب' });
      const phoneNormClin = normalizeSaudiPhone(phone.trim());
      if (!phoneNormClin) return res.status(400).json({ error: 'رقم الجوال غير صحيح' });
      let emailNormClin: string | null = null;
      if (email && email.trim()) {
        if (!isValidEmail(email.trim())) return res.status(400).json({ error: 'صيغة البريد غير صحيحة' });
        emailNormClin = email.trim().toLowerCase();
        const dupE = await prisma.user.findFirst({ where: { email: emailNormClin } });
        if (dupE) return res.status(400).json({ error: 'البريد مسجل مسبقاً' });
      }
      organization_id = org.id;
      const hashClin = await bcrypt.hash(password, 10);
      const userClin = await prisma.user.create({
        data: { username: username.trim(), password_hash: hashClin, full_name: full_name.trim(), email: emailNormClin, phone: phoneNormClin, role_id: role.id, organization_id, is_active: true },
        include: { role: true, organization: true }
      });
      try { await prisma.auditLog.create({ data: { entity_type: 'User', entity_id: userClin.id, action: 'CLINICIAN_REGISTERED', actor_id: userClin.id, organization_id: org.id, new_values: JSON.stringify({ username: userClin.username, organizationId: org.id, organizationName: org.organization_name_ar }), details: `Clinician ${userClin.username} linked to facility ${org.organization_name_ar}` } }); } catch {}
      const tokenClin = jwt.sign({ userId: userClin.id, role: userClin.role.role_code, orgId: userClin.organization_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
      setAuthCookie(res, tokenClin);
      return res.json({ token: tokenClin, user: { id: userClin.id, username: userClin.username, fullName: userClin.full_name, role: userClin.role.role_code, organization: userClin.organization?.organization_name, organizationAr: (userClin.organization as any)?.organization_name_ar, orgId: userClin.organization_id, patientProfileId: null } });
    } else {
      // ===== PATIENT: Enhanced trusted data collection =====
      // National ID / Iqama is MANDATORY for reliable patient identity
      if (!nationalId || !nationalId.trim()) {
        return res.status(400).json({ error: 'رقم الهوية الوطنية / الإقامة مطلوب (10 أرقام يبدأ بـ 1 أو 2)' });
      }
      const nidTrimmed = nationalId.trim();
      if (!isValidSaudiNationalId(nidTrimmed)) {
        return res.status(400).json({ error: 'رقم الهوية الوطنية / الإقامة غير صحيح: يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2' });
      }
      // Unique NID check
      const existingNid = await prisma.patientIdentifier.findFirst({ where: { value: nidTrimmed } });
      if (existingNid) {
        return res.status(400).json({ error: 'رقم الهوية الوطنية / الإقامة مسجل مسبقاً في المنصة' });
      }
      // Also prevent NID being reused as username by another account
      const existingNidAsUsername = await prisma.user.findUnique({ where: { username: nidTrimmed } });
      if (existingNidAsUsername) {
        return res.status(400).json({ error: 'رقم الهوية مستخدم كاسم دخول في حساب آخر' });
      }

      // Birth date mandatory
      if (!birthDate) {
        return res.status(400).json({ error: 'تاريخ الميلاد مطلوب للحصول على بيانات موثوقة' });
      }
      const dob = new Date(birthDate);
      if (isNaN(dob.getTime())) {
        return res.status(400).json({ error: 'تاريخ الميلاد غير صالح' });
      }
      if (dob > new Date()) {
        return res.status(400).json({ error: 'تاريخ الميلاد لا يمكن أن يكون في المستقبل' });
      }
      if (dob < new Date('1900-01-01')) {
        return res.status(400).json({ error: 'تاريخ الميلاد غير واقعي (قبل 1900)' });
      }
      const ageYears = new Date().getFullYear() - dob.getFullYear();
      if (ageYears > 120 || ageYears < 0) {
        return res.status(400).json({ error: 'العمر غير واقعي (يجب أن يكون بين 0 و 120 سنة)' });
      }

      // Gender mandatory
      if (!gender) {
        return res.status(400).json({ error: 'الجنس مطلوب' });
      }
      const genderNorm = normalizeGender(String(gender));
      if (!genderNorm) {
        return res.status(400).json({ error: 'الجنس غير صالح: اختر ذكر أو أنثى' });
      }

      // Phone mandatory - Saudi format
      if (!phone || !phone.trim()) {
        return res.status(400).json({ error: 'رقم الجوال السعودي مطلوب (مثال: 05xxxxxxxx أو +9665xxxxxxxx)' });
      }
      const normalizedPhone = normalizeSaudiPhone(phone.trim());
      if (!normalizedPhone) {
        return res.status(400).json({ error: 'رقم الجوال غير صحيح: يجب أن يكون رقم سعودي يبدأ بـ 05 أو +9665 (مثال: 0555123456)' });
      }

      // Email optional but if provided must be valid
      let normalizedEmail: string | null = null;
      if (email && email.trim()) {
        if (!isValidEmail(email.trim())) {
          return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' });
        }
        normalizedEmail = email.trim().toLowerCase();
        const duplicateEmail = await prisma.user.findFirst({ where: { email: normalizedEmail } });
        if (duplicateEmail) {
          return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
        }
      }

      // Full name validation - at least 2 parts, 2 chars each, Arabic/English letters
      const nameParts = full_name.trim().split(/\s+/);
      if (nameParts.length < 2) {
        return res.status(400).json({ error: 'الاسم الكامل يجب أن يحتوي على الاسم الأول واسم العائلة على الأقل' });
      }
      if (full_name.trim().length < 3 || full_name.trim().length > 80) {
        return res.status(400).json({ error: 'الاسم الكامل يجب أن يكون بين 3 و 80 حرفاً' });
      }

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

      const password_hash_patient = await bcrypt.hash(password, 10);

      // Create Patient with trusted demographic data
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      // Try to separate Arabic names if full_name contains Arabic
      const hasArabic = /[\u0600-\u06FF]/.test(full_name);
      const patient = await prisma.patient.create({
        data: {
          internal_id: nidTrimmed, // Use NID as canonical internal_id for traceability & MPI
          first_name: hasArabic ? null : firstName,
          last_name: hasArabic ? null : lastName,
          first_name_ar: hasArabic ? firstName : null,
          last_name_ar: hasArabic ? lastName : null,
          birth_date: dob,
          gender: genderNorm,
          phone: normalizedPhone,
          email: normalizedEmail,
          status: 'ACTIVE'
        }
      });
      patient_profile_id = patient.id;

      // Create NID/Iqama identifier
      const nidType = nidTrimmed.startsWith('1') ? 'NID' : 'IQAMA';
      const nidSystem = nidTrimmed.startsWith('1') ? 'urn:sa:nca:nid' : 'urn:sa:iqama';
      await prisma.patientIdentifier.create({
        data: {
          patient_id: patient.id,
          value: nidTrimmed,
          type: nidType,
          system: nidSystem
        }
      });

      // Save patient profile supplementary data if provided
      if (patient_profile) {
        try {
          // Validate emergency contact phone if provided
          let emergencyPhoneNormalized: string | undefined = undefined;
          if (patient_profile.emergency_contact_phone) {
            const ep = normalizeSaudiPhone(String(patient_profile.emergency_contact_phone).trim());
            if (ep) emergencyPhoneNormalized = ep;
          }
          // Validate postal code if provided (5 digits)
          let postalValid = patient_profile.address_postal_code;
          if (postalValid && !/^\d{5}$/.test(String(postalValid).trim())) {
            postalValid = null; // silently drop invalid but keep rest
          }
          await prisma.patientProfile.create({
            data: {
              patient_id: patient.id,
              preferred_first_name: patient_profile.preferred_first_name?.trim() || null,
              preferred_last_name: patient_profile.preferred_last_name?.trim() || null,
              preferred_language: ['ar','en'].includes(patient_profile.preferred_language) ? patient_profile.preferred_language : 'ar',
              emergency_contact_name: patient_profile.emergency_contact_name?.trim() || null,
              emergency_contact_phone: emergencyPhoneNormalized || patient_profile.emergency_contact_phone?.trim() || null,
              emergency_contact_relationship: patient_profile.emergency_contact_relationship || null,
              address_line: patient_profile.address_line?.trim() || null,
              address_city: patient_profile.address_city?.trim() || null,
              address_district: patient_profile.address_district?.trim() || null,
              address_postal_code: postalValid ? String(postalValid).trim() : null,
              source: 'PATIENT',
              verification_status: 'SELF_REPORTED',
              recorded_at: new Date(),
              notes: 'Created during trusted patient registration'
            }
          });
        } catch (profileErr) {
          console.warn('Warning: Failed to save patient profile during registration, but user created', profileErr);
        }
      }

      // Create user linked to patient
      const user = await prisma.user.create({
        data: {
          username: username.trim(),
          password_hash: password_hash_patient,
          full_name: full_name.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          role_id: role.id,
          organization_id,
          patient_profile_id,
          is_active: true
        },
        include: { role: true, organization: true }
      });

      // Audit - record trusted registration
      try {
        await prisma.auditLog.create({
          data: {
            entity_type: 'Patient',
            entity_id: patient.internal_id,
            action: 'PATIENT_REGISTER_TRUSTED',
            actor_id: user.id,
            organization_id,
            new_values: JSON.stringify({ username: user.username, nationalId: nidTrimmed, gender: genderNorm, birthDate: dob.toISOString().split('T')[0] }),
            details: `Trusted patient registration: NID ${nidTrimmed} with verified demographics`
          }
        });
      } catch (e) { /* audit best effort */ }

      const token = jwt.sign(
        { userId: user.id, role: user.role.role_code, orgId: user.organization_id, patientProfileId: user.patient_profile_id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } as any
      );
      setAuthCookie(res, token);
      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role.role_code,
          organization: user.organization?.organization_name,
          organizationAr: (user.organization as any)?.organization_name_ar || user.organization?.organization_name,
          orgId: user.organization_id,
          patientProfileId: user.patient_profile_id
        }
      });
    }

  } catch (error: any) {
    console.error('Registration error:', error);
    // Handle Prisma unique constraint errors with friendly message
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      if (target && String(target).includes('username')) {
        return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
      }
      if (target && String(target).includes('email')) {
        return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
      }
      return res.status(400).json({ error: 'بيانات مسجلة مسبقاً: تحقق من الهوية أو اسم المستخدم' });
    }
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
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

    const token = jwt.sign(
      { userId: user.id, role: user.role.role_code, orgId: user.organization_id, patientProfileId: user.patient_profile_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as any
    );
    setAuthCookie(res, token);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role.role_code,
        organization: user.organization?.organization_name,
        organizationAr: (user.organization as any)?.organization_name_ar || user.organization?.organization_name,
        orgId: user.organization_id,
        patientProfileId: user.patient_profile_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('shiep_token', { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/' });
  res.json({ success: true });
});

router.get('/me', verifyToken, (req: Request, res: Response) => {
  const user = req.user as any;
  res.json({
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role?.role_code || 'UNKNOWN',
    organization: user.organization?.organization_name,
    organizationAr: (user.organization as any)?.organization_name_ar || user.organization?.organization_name,
    orgId: user.organization_id,
    patientProfileId: user.patient_profile_id
  });
});

export const authRoutes = router;

