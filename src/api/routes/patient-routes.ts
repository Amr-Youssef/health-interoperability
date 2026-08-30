import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../security/auth-middleware.js';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ---- Helpers for authorized editable fields ----
const ALLOWED_EDITABLE_FIELDS = new Set([
  'phone', 'email',
  'preferredFirstName', 'preferredLastName', 'preferredLanguage',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship',
  'addressLine', 'addressCity', 'addressDistrict', 'addressPostalCode',
  'notes'
]);

const READ_ONLY_FIELDS_HINT = [
  'nationalId', 'internalId', 'birthDate', 'gender', 'firstName', 'lastName', 'firstNameAr', 'lastNameAr', 'username', 'fullName', 'role'
];

function normalizeSaudiPhoneEditable(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-\(\)]/g, '');
  if (/^05\d{8}$/.test(cleaned)) return '+966' + cleaned.substring(1);
  if (/^5\d{8}$/.test(cleaned)) return '+966' + cleaned;
  if (/^9665\d{8}$/.test(cleaned)) return '+' + cleaned;
  if (/^\+9665\d{8}$/.test(cleaned)) return cleaned;
  return null;
}
function isValidEmailEditable(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function validateEditablePayload(body: any): { valid: boolean; error?: string; normalized?: any } {
  const providedKeys = Object.keys(body);
  const forbidden = providedKeys.filter(k => !ALLOWED_EDITABLE_FIELDS.has(k));
  if (forbidden.length > 0) {
    return { valid: false, error: `حقول غير مصرح بتعديلها: ${forbidden.join(', ')}. الحقول المسموحة فقط هي بيانات التواصل والعنوان وبيانات الطوارئ` };
  }
  if (providedKeys.length === 0) {
    return { valid: false, error: 'لم يتم تقديم أي حقول قابلة للتعديل' };
  }
  const normalized: any = {};
  // phone
  if (body.phone !== undefined) {
    const raw = String(body.phone).trim();
    if (raw === '') {
      return { valid: false, error: 'رقم الجوال لا يمكن أن يكون فارغاً. استخدم صيغة 05xxxxxxxx' };
    }
    const np = normalizeSaudiPhoneEditable(raw);
    if (!np) return { valid: false, error: 'رقم الجوال غير صحيح: يجب أن يكون رقم سعودي يبدأ بـ 05 أو +9665 (مثال: 0555123456)' };
    normalized.phone = np;
  }
  // email - allow empty string to clear? we will treat empty as null (clear)
  if (body.email !== undefined) {
    const raw = String(body.email).trim();
    if (raw === '') {
      normalized.email = null; // allow clearing
    } else {
      if (!isValidEmailEditable(raw)) return { valid: false, error: 'صيغة البريد الإلكتروني غير صحيحة' };
      normalized.email = raw.toLowerCase();
    }
  }
  // preferredFirstName
  if (body.preferredFirstName !== undefined) {
    const v = String(body.preferredFirstName).trim();
    if (v && (v.length < 2 || v.length > 50)) return { valid: false, error: 'الاسم المفضل يجب أن يكون بين 2 و 50 حرفاً' };
    normalized.preferredFirstName = v || null;
  }
  if (body.preferredLastName !== undefined) {
    const v = String(body.preferredLastName).trim();
    if (v && (v.length < 2 || v.length > 50)) return { valid: false, error: 'اسم العائلة المفضل يجب أن يكون بين 2 و 50 حرفاً' };
    normalized.preferredLastName = v || null;
  }
  if (body.preferredLanguage !== undefined) {
    const v = String(body.preferredLanguage).trim().toLowerCase();
    if (!['ar','en'].includes(v)) return { valid: false, error: 'اللغة المفضلة يجب أن تكون ar أو en' };
    normalized.preferredLanguage = v;
  }
  if (body.emergencyContactName !== undefined) {
    const v = String(body.emergencyContactName).trim();
    if (v && (v.length < 2 || v.length > 80)) return { valid: false, error: 'اسم جهة الطوارئ يجب أن يكون بين 2 و 80 حرفاً' };
    normalized.emergencyContactName = v || null;
  }
  if (body.emergencyContactPhone !== undefined) {
    const raw = String(body.emergencyContactPhone).trim();
    if (raw === '') {
      normalized.emergencyContactPhone = null;
    } else {
      const np = normalizeSaudiPhoneEditable(raw);
      if (!np) return { valid: false, error: 'رقم طوارئ غير صحيح: يجب أن يكون رقم سعودي' };
      normalized.emergencyContactPhone = np;
    }
  }
  if (body.emergencyContactRelationship !== undefined) {
    const v = String(body.emergencyContactRelationship).trim().toUpperCase();
    const allowed = ['PARENT','SPOUSE','SIBLING','CHILD','FRIEND','OTHER','FATHER','MOTHER'];
    // Map informal to canonical
    let mapped = v;
    if (v === 'FATHER' || v === 'MOTHER') mapped = 'PARENT';
    if (v && !allowed.includes(v) && v !== '') return { valid: false, error: 'العلاقة غير صالحة: اختر من القيم المسموحة (PARENT, SPOUSE, SIBLING, CHILD, FRIEND, OTHER)' };
    normalized.emergencyContactRelationship = v ? mapped : null;
  }
  if (body.addressLine !== undefined) {
    const v = String(body.addressLine).trim();
    if (v && (v.length < 3 || v.length > 200)) return { valid: false, error: 'العنوان يجب أن يكون بين 3 و 200 حرفاً' };
    normalized.addressLine = v || null;
  }
  if (body.addressCity !== undefined) {
    const v = String(body.addressCity).trim();
    if (v && (v.length < 2 || v.length > 50)) return { valid: false, error: 'المدينة يجب أن تكون بين 2 و 50 حرفاً' };
    normalized.addressCity = v || null;
  }
  if (body.addressDistrict !== undefined) {
    const v = String(body.addressDistrict).trim();
    if (v && (v.length < 2 || v.length > 50)) return { valid: false, error: 'الحي يجب أن يكون بين 2 و 50 حرفاً' };
    normalized.addressDistrict = v || null;
  }
  if (body.addressPostalCode !== undefined) {
    const v = String(body.addressPostalCode).trim();
    if (v && !/^\d{5}$/.test(v)) return { valid: false, error: 'الرمز البريدي يجب أن يكون 5 أرقام (مثال: 12345)' };
    normalized.addressPostalCode = v || null;
  }
  if (body.notes !== undefined) {
    const v = String(body.notes).trim();
    if (v.length > 500) return { valid: false, error: 'الملاحظات يجب ألا تتجاوز 500 حرف' };
    normalized.notes = v || null;
  }
  return { valid: true, normalized };
}

// Middleware: Verify Patient Role
function requirePatient(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role?.role_code !== 'PATIENT') {
    return res.status(403).json({ error: 'Access denied: Patient required' });
  }
  if (!req.user?.patient_profile_id) {
    return res.status(400).json({ error: 'User is not linked to a patient profile' });
  }
  next();
}

router.use(verifyToken);
router.use(requirePatient);

// ============================================================================
//  Personal Data - Only authorized editable fields (contact + emergency + address)
//  GET  /api/patient/me       -> returns consolidated editable + read-only data
//  PATCH /api/patient/me      -> updates ONLY whitelisted fields with validation
// ============================================================================

router.get('/me', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const patientId = user.patient_profile_id!;

    const [patient, profile, userFresh] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId }, include: { identifiers: true } }),
      prisma.patientProfile.findUnique({ where: { patient_id: patientId } }),
      prisma.user.findUnique({ where: { id: user.id }, include: { role: true, organization: true } })
    ]);

    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found' });
    }

    // Build identifiers read-only list
    const identifiers = (patient.identifiers || []).map((i: any) => ({
      type: i.type,
      value: i.value,
      system: i.system,
      isActive: i.is_active
    }));

    // Determine read-only identity fields
    const nidObj = identifiers.find((i: any) => i.type === 'NID' || i.type === 'IQAMA');

    res.json({
      user: {
        id: userFresh!.id,
        username: userFresh!.username,
        fullName: userFresh!.full_name,
        email: userFresh!.email,
        phone: userFresh!.phone,
        role: userFresh!.role.role_code,
        organization: userFresh!.organization?.organization_name
      },
      patient: {
        id: patient.id,
        internalId: patient.internal_id,
        firstName: patient.first_name,
        lastName: patient.last_name,
        firstNameAr: patient.first_name_ar,
        lastNameAr: patient.last_name_ar,
        birthDate: patient.birth_date ? patient.birth_date.toISOString().split('T')[0] : null,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        status: patient.status,
        identifiers,
        nationalId: nidObj?.value || null,
        nationalIdType: nidObj?.type || null
      },
      profile: profile ? {
        preferredFirstName: profile.preferred_first_name,
        preferredLastName: profile.preferred_last_name,
        preferredLanguage: profile.preferred_language,
        emergencyContactName: profile.emergency_contact_name,
        emergencyContactPhone: profile.emergency_contact_phone,
        emergencyContactRelationship: profile.emergency_contact_relationship,
        addressLine: profile.address_line,
        addressCity: profile.address_city,
        addressDistrict: profile.address_district,
        addressPostalCode: profile.address_postal_code,
        notes: profile.notes,
        verificationStatus: profile.verification_status,
        recordedAt: profile.recorded_at,
        updatedAt: profile.updated_at
      } : null,
      meta: {
        editableFields: Array.from(ALLOWED_EDITABLE_FIELDS),
        readOnlyFields: READ_ONLY_FIELDS_HINT,
        disclosure: 'يمكنك تعديل بيانات التواصل (جوال، بريد)، واللغة المفضلة، وجهة اتصال الطوارئ، والعنوان فقط. الهوية الوطنية، تاريخ الميلاد، الجنس، والاسم القانوني محمية وتتطلب تحقق إداري.'
      }
    });
  } catch (error) {
    console.error('Error fetching patient personal data:', error);
    res.status(500).json({ error: 'Internal server error while fetching personal data' });
  }
});

router.patch('/me', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const patientId = user.patient_profile_id!;

    const validation = validateEditablePayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const data = validation.normalized!;

    // Check uniqueness for email if being changed
    if (data.email !== undefined) {
      if (data.email) {
        const dup = await prisma.user.findFirst({ where: { email: data.email, NOT: { id: user.id } } });
        if (dup) return res.status(400).json({ error: 'البريد الإلكتروني مسجل لمستخدم آخر' });
      }
    }
    // Emergency phone distinct? No need uniqueness.

    // Fetch existing patient & profile for audit
    const existingPatient = await prisma.patient.findUnique({ where: { id: patientId } });
    const existingProfile = await prisma.patientProfile.findUnique({ where: { patient_id: patientId } });
    if (!existingPatient) return res.status(404).json({ error: 'Patient not found' });

    const oldValues: any = {};
    const newValues: any = {};

    // Prepare user/patient contact updates
    const userUpdates: any = {};
    const patientUpdates: any = {};
    if (data.phone !== undefined) {
      oldValues.phone = existingPatient.phone;
      newValues.phone = data.phone;
      userUpdates.phone = data.phone;
      patientUpdates.phone = data.phone;
    }
    if (data.email !== undefined) {
      oldValues.email = existingPatient.email;
      newValues.email = data.email;
      userUpdates.email = data.email;
      patientUpdates.email = data.email;
    }

    // Apply user & patient updates if any
    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: userUpdates });
    }
    if (Object.keys(patientUpdates).length > 0) {
      await prisma.patient.update({ where: { id: patientId }, data: patientUpdates });
    }

    // Profile fields upsert
    const profileFields: any = {};
    const mapProfile = {
      preferredFirstName: 'preferred_first_name',
      preferredLastName: 'preferred_last_name',
      preferredLanguage: 'preferred_language',
      emergencyContactName: 'emergency_contact_name',
      emergencyContactPhone: 'emergency_contact_phone',
      emergencyContactRelationship: 'emergency_contact_relationship',
      addressLine: 'address_line',
      addressCity: 'address_city',
      addressDistrict: 'address_district',
      addressPostalCode: 'address_postal_code',
      notes: 'notes'
    } as const;

    for (const [camel, snake] of Object.entries(mapProfile)) {
      if ((data as any)[camel] !== undefined) {
        profileFields[snake] = (data as any)[camel];
        oldValues[camel] = (existingProfile as any)?.[snake] ?? null;
        newValues[camel] = (data as any)[camel];
      }
    }

    let updatedProfile = existingProfile;
    if (Object.keys(profileFields).length > 0) {
      if (existingProfile) {
        updatedProfile = await prisma.patientProfile.update({
          where: { patient_id: patientId },
          data: { ...profileFields, updated_at: new Date() }
        });
      } else {
        updatedProfile = await prisma.patientProfile.create({
          data: {
            patient_id: patientId,
            ...profileFields,
            source: 'PATIENT',
            verification_status: 'SELF_REPORTED',
            recorded_at: new Date()
          }
        });
      }
    }

    // Refetch consolidated for response
    const [freshPatient, freshUser, freshProfile] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId }, include: { identifiers: true } }),
      prisma.user.findUnique({ where: { id: user.id }, include: { role: true, organization: true } }),
      prisma.patientProfile.findUnique({ where: { patient_id: patientId } })
    ]);

    // Audit log - only whitelisted fields changed
    try {
      await prisma.auditLog.create({
        data: {
          entity_type: 'PatientPersonalData',
          entity_id: patientId,
          action: 'PATIENT_SELF_UPDATE',
          actor_id: user.id,
          organization_id: user.organization_id,
          old_values: JSON.stringify(oldValues),
          new_values: JSON.stringify(newValues),
          details: `Patient self-service update of allowed fields: ${Object.keys(newValues).join(', ')}`
        }
      });
    } catch (e) { /* best effort */ }

    res.json({
      message: 'تم تحديث بياناتك الشخصية بنجاح. الحقول المسموحة فقط تم حفظها وسيتم مراجعتها كبيانات ذاتية غير مؤكدة.',
      updatedFields: Object.keys(newValues),
      user: {
        id: freshUser!.id,
        username: freshUser!.username,
        fullName: freshUser!.full_name,
        email: freshUser!.email,
        phone: freshUser!.phone
      },
      patient: {
        id: freshPatient!.id,
        internalId: freshPatient!.internal_id,
        phone: freshPatient!.phone,
        email: freshPatient!.email
      },
      profile: freshProfile ? {
        preferredFirstName: freshProfile.preferred_first_name,
        preferredLastName: freshProfile.preferred_last_name,
        preferredLanguage: freshProfile.preferred_language,
        emergencyContactName: freshProfile.emergency_contact_name,
        emergencyContactPhone: freshProfile.emergency_contact_phone,
        emergencyContactRelationship: freshProfile.emergency_contact_relationship,
        addressLine: freshProfile.address_line,
        addressCity: freshProfile.address_city,
        addressDistrict: freshProfile.address_district,
        addressPostalCode: freshProfile.address_postal_code,
        notes: freshProfile.notes
      } : null
    });
  } catch (error) {
    console.error('Error updating patient personal data:', error);
    res.status(500).json({ error: 'Internal server error while updating personal data' });
  }
});

// Get patient's own health record (No dummy data)
router.get('/my-record', async (req, res) => {
  try {
    const patientInternalId = req.user!.patient_profile_id!;
    
    const patientData = await prisma.patient.findUnique({
      where: { id: patientInternalId },
      include: {
        identifiers: true,
        encounters: {
          include: {
            observations: true,
            conditions: true,
            medication_requests: true,
          }
        },
        allergies: true,
        medication_requests: true,
        consents: true
      }
    });

    if (!patientData) {
      return res.status(404).json({ error: 'Patient profile not found in the canonical database' });
    }

    res.json(patientData);
  } catch (error) {
    console.error('Error fetching patient record:', error);
    res.status(500).json({ error: 'Internal server error while fetching patient record' });
  }
});

// Update patient consent (Live backend update)
router.post('/consent', async (req, res) => {
  try {
    const patientInternalId = req.user!.patient_profile_id!;
    const { consent_type, scope, granted, organization_id } = req.body;

    if (consent_type === undefined || granted === undefined || scope === undefined) {
      return res.status(400).json({ error: 'Missing required fields: consent_type, granted, scope' });
    }

    const consent = await prisma.consent.create({
      data: {
        patient_id: patientInternalId,
        consent_type,
        scope,
        granted,
        granted_at: new Date(),
        organization_id,
        consent_source: 'PATIENT_PORTAL'
      }
    });

    res.json({ message: 'Consent updated successfully', consent });
  } catch (error) {
    console.error('Error updating consent:', error);
    res.status(500).json({ error: 'Internal server error while updating consent' });
  }
});

export const patientRoutes = router;
