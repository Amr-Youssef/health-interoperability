import { prisma } from '../lib/prisma.js';
import { ALLOWED_SELF_SERVICE_FIELDS } from './patient-identity.js';

const ALLOWED = new Set<string>(ALLOWED_SELF_SERVICE_FIELDS as unknown as string[]);

function normalizeSaudiPhone(raw: string): string | null {
  const c = raw.replace(/[\s\-\(\)]/g, '');
  if (/^05\d{8}$/.test(c)) return '+966' + c.substring(1);
  if (/^5\d{8}$/.test(c)) return '+966' + c;
  if (/^9665\d{8}$/.test(c)) return '+' + c;
  if (/^\+9665\d{8}$/.test(c)) return c;
  return null;
}
function isValidEmail(email: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }

export function validateSelfServicePayload(body: any): { valid: boolean; error?: string; normalized?: any } {
  const keys = Object.keys(body);
  const forbidden = keys.filter(k => !ALLOWED.has(k));
  if (forbidden.length > 0) return { valid: false, error: `حقول غير مصرح بتعديلها: ${forbidden.join(', ')}. الحقول المسموحة فقط هي بيانات التواصل والعنوان وبيانات الطوارئ` };
  if (keys.length === 0) return { valid: false, error: 'لم يتم تقديم أي حقول قابلة للتعديل' };
  const n: any = {};
  if (body.phone !== undefined) {
    const raw = String(body.phone).trim();
    if (!raw) return { valid: false, error: 'رقم الجوال لا يمكن أن يكون فارغاً. استخدم صيغة 05xxxxxxxx' };
    const np = normalizeSaudiPhone(raw);
    if (!np) return { valid: false, error: 'رقم الجوال غير صحيح: يجب أن يكون رقم سعودي يبدأ بـ 05 أو +9665 (مثال: 0555123456)' };
    n.phone = np;
  }
  if (body.email !== undefined) {
    const raw = String(body.email).trim();
    if (raw === '') n.email = null;
    else { if (!isValidEmail(raw)) return { valid: false, error: 'صيغة البريد الإلكتروني غير صحيحة' }; n.email = raw.toLowerCase(); }
  }
  if (body.preferredFirstName !== undefined) { const v = String(body.preferredFirstName).trim(); if (v && (v.length < 2 || v.length > 50)) return { valid: false, error: 'الاسم المفضل يجب أن يكون بين 2 و 50 حرفاً' }; n.preferredFirstName = v || null; }
  if (body.preferredLastName !== undefined) { const v = String(body.preferredLastName).trim(); if (v && (v.length < 2 || v.length > 50)) return { valid: false, error: 'اسم العائلة المفضل يجب أن يكون بين 2 و 50 حرفاً' }; n.preferredLastName = v || null; }
  if (body.preferredLanguage !== undefined) { const v = String(body.preferredLanguage).trim().toLowerCase(); if (!['ar','en'].includes(v)) return { valid: false, error: 'اللغة المفضلة يجب أن تكون ar أو en' }; n.preferredLanguage = v; }
  if (body.emergencyContactName !== undefined) { const v = String(body.emergencyContactName).trim(); if (v && (v.length < 2 || v.length > 80)) return { valid: false, error: 'اسم جهة الطوارئ يجب أن يكون بين 2 و 80 حرفاً' }; n.emergencyContactName = v || null; }
  if (body.emergencyContactPhone !== undefined) { const raw = String(body.emergencyContactPhone).trim(); if (raw === '') n.emergencyContactPhone = null; else { const np = normalizeSaudiPhone(raw); if (!np) return { valid: false, error: 'رقم طوارئ غير صحيح: يجب أن يكون رقم سعودي' }; n.emergencyContactPhone = np; } }
  if (body.emergencyContactRelationship !== undefined) { let v = String(body.emergencyContactRelationship).trim().toUpperCase(); if (v === 'FATHER' || v === 'MOTHER') v = 'PARENT'; const allowed = ['PARENT','SPOUSE','SIBLING','CHILD','FRIEND','OTHER']; if (v && !allowed.includes(v)) return { valid: false, error: 'العلاقة غير صالحة' }; n.emergencyContactRelationship = v || null; }
  if (body.addressLine !== undefined) { const v = String(body.addressLine).trim(); if (v && (v.length < 3 || v.length > 200)) return { valid: false, error: 'العنوان يجب أن يكون بين 3 و 200 حرفاً' }; n.addressLine = v || null; }
  if (body.addressCity !== undefined) { const v = String(body.addressCity).trim(); if (v && (v.length < 2 || v.length > 50)) return { valid: false, error: 'المدينة يجب أن تكون بين 2 و 50 حرفاً' }; n.addressCity = v || null; }
  if (body.addressDistrict !== undefined) { const v = String(body.addressDistrict).trim(); if (v && (v.length < 2 || v.length > 50)) return { valid: false, error: 'الحي يجب أن يكون بين 2 و 50 حرفاً' }; n.addressDistrict = v || null; }
  if (body.addressPostalCode !== undefined) { const v = String(body.addressPostalCode).trim(); if (v && !/^\d{5}$/.test(v)) return { valid: false, error: 'الرمز البريدي يجب أن يكون 5 أرقام (مثال: 12345)' }; n.addressPostalCode = v || null; }
  if (body.notes !== undefined) { const v = String(body.notes).trim(); if (v.length > 500) return { valid: false, error: 'الملاحظات يجب ألا تتجاوز 500 حرف' }; n.notes = v || null; }
  return { valid: true, normalized: n };
}

export async function getPatientSelfView(patientId: string, userId: string) {
  const [patient, profile, userFresh] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId }, include: { identifiers: true } }),
    prisma.patientProfile.findUnique({ where: { patient_id: patientId } }),
    prisma.user.findUnique({ where: { id: userId }, include: { role: true, organization: true } })
  ]);
  if (!patient) throw new Error('Patient not found');
  return { patient, profile, userFresh };
}

export async function updatePatientSelfData(patientId: string, userId: string, organizationId: string, body: any) {
  const validation = validateSelfServicePayload(body);
  if (!validation.valid) { const e: any = new Error(validation.error); e.status = 400; throw e; }
  const data = validation.normalized!;

  if (data.email) {
    const dup = await prisma.user.findFirst({ where: { email: data.email, NOT: { id: userId } } });
    if (dup) { const e: any = new Error('البريد الإلكتروني مسجل لمستخدم آخر'); e.status = 400; throw e; }
  }

  const existingPatient = await prisma.patient.findUnique({ where: { id: patientId } });
  const existingProfile = await prisma.patientProfile.findUnique({ where: { patient_id: patientId } });
  if (!existingPatient) { const e: any = new Error('Patient not found'); e.status = 404; throw e; }

  const oldValues: any = {};
  const newValues: any = {};
  const userUpdates: any = {};
  const patientUpdates: any = {};
  if (data.phone !== undefined) { oldValues.phone = existingPatient.phone; newValues.phone = data.phone; userUpdates.phone = data.phone; patientUpdates.phone = data.phone; }
  if (data.email !== undefined) { oldValues.email = existingPatient.email; newValues.email = data.email; userUpdates.email = data.email; patientUpdates.email = data.email; }

  if (Object.keys(userUpdates).length) await prisma.user.update({ where: { id: userId }, data: userUpdates });
  if (Object.keys(patientUpdates).length) await prisma.patient.update({ where: { id: patientId }, data: patientUpdates });

  const mapProfile: Record<string,string> = { preferredFirstName:'preferred_first_name', preferredLastName:'preferred_last_name', preferredLanguage:'preferred_language', emergencyContactName:'emergency_contact_name', emergencyContactPhone:'emergency_contact_phone', emergencyContactRelationship:'emergency_contact_relationship', addressLine:'address_line', addressCity:'address_city', addressDistrict:'address_district', addressPostalCode:'address_postal_code', notes:'notes' };
  const profileFields: any = {};
  for (const [camel, snake] of Object.entries(mapProfile)) if ((data as any)[camel] !== undefined) { profileFields[snake] = (data as any)[camel]; oldValues[camel] = (existingProfile as any)?.[snake] ?? null; newValues[camel] = (data as any)[camel]; }

  let updatedProfile = existingProfile;
  if (Object.keys(profileFields).length) {
    if (existingProfile) updatedProfile = await prisma.patientProfile.update({ where: { patient_id: patientId }, data: { ...profileFields, updated_at: new Date() } });
    else updatedProfile = await prisma.patientProfile.create({ data: { patient_id: patientId, ...profileFields, source: 'PATIENT', verification_status: 'SELF_REPORTED', recorded_at: new Date() } });
  }

  try {
    await prisma.auditLog.create({ data: { entity_type: 'PatientPersonalData', entity_id: patientId, action: 'PATIENT_SELF_UPDATE', actor_id: userId, organization_id: organizationId, old_values: JSON.stringify(oldValues), new_values: JSON.stringify(newValues), details: `Patient self-service update of allowed fields: ${Object.keys(newValues).join(', ')}` } });
  } catch {}

  const [freshPatient, freshUser, freshProfile] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId }, include: { identifiers: true } }),
    prisma.user.findUnique({ where: { id: userId }, include: { role: true, organization: true } }),
    prisma.patientProfile.findUnique({ where: { patient_id: patientId } })
  ]);

  return { updatedFields: Object.keys(newValues), freshPatient, freshUser, freshProfile };
}
