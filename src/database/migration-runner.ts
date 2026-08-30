import fs from 'fs';
import path from 'path';
import { NationalHealthDB } from './national-health-db.js';
import { Role, SystemRoleCode } from './schema.js';

export class MigrationRunner {
  private db: NationalHealthDB;

  constructor(db: NationalHealthDB) {
    this.db = db;
  }

  /**
   * 1. Cleanup Legacy & Stale Store Files
   */
  public async cleanupLegacy(): Promise<void> {
    const legacyFiles = [
      path.resolve(process.cwd(), '.data', 'canonical-store.json'),
      path.resolve(process.cwd(), '.data', 'mpi-store.json'),
      path.resolve(process.cwd(), '.data', 'raw-store.json'),
      path.resolve(process.cwd(), '.data', 'consent-store.json'),
      path.resolve(process.cwd(), 'data', 'hospitals-registry.json'),
      path.resolve(process.cwd(), 'data', 'dynamic-hospitals.json')
    ];

    for (const f of legacyFiles) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch (e) {
          // ignore unlink error
        }
      }
    }
  }

  /**
   * 2. Seed Clean Standard System Roles
   */
  public seedRealRoles(): void {
    const standardRoles: Role[] = [
      {
        id: 'role-moh-admin',
        roleName: 'مدير نظام وزارة الصحة',
        roleCode: 'MOH_ADMIN',
        description: 'صلاحيات الحوكمة والرقابة الوطنية المركزية، وإدارة المنشآت والسياسات وسجلات التدقيق.',
        isSystemRole: true
      },
      {
        id: 'role-hospital-admin',
        roleName: 'مسؤول المنشأة الصحية',
        roleCode: 'HOSPITAL_ADMIN',
        description: 'إدارة السجلات السريرية والمالية والزيارات الخاصة بالمستشفى أو المنشأة الصحية فقط.',
        isSystemRole: true
      },
      {
        id: 'role-patient',
        roleName: 'الفرد / المريض',
        roleCode: 'PATIENT',
        description: 'استعراض السجل الصحي الشخصي وإدارة تراخيص وموافقات مشاركة البيانات.',
        isSystemRole: true
      }
    ];

    for (const r of standardRoles) {
      if (!this.db.roles.has(r.id)) {
        this.db.insertRole(r);
      }
    }

    // Role Permissions for MOH_ADMIN
    const mohPermissions = [
      'org:manage_all',
      'policy:manage',
      'quality:monitor',
      'audit:read_central',
      'analytics:read_national'
    ];
    for (const p of mohPermissions) {
      this.db.insertRolePermission({
        roleId: 'role-moh-admin',
        permissionCode: p,
        granted: true
      });
    }

    // Role Permissions for HOSPITAL_ADMIN
    const hospitalPermissions = [
      'patient:manage_org',
      'encounter:create_org',
      'clinical:write_org',
      'clinical:read_org',
      'claim:manage_org',
      'import:execute_org'
    ];
    for (const p of hospitalPermissions) {
      this.db.insertRolePermission({
        roleId: 'role-hospital-admin',
        permissionCode: p,
        granted: true
      });
    }

    // Role Permissions for PATIENT
    const patientPermissions = [
      'patient:read_self',
      'consent:manage_self',
      'access_history:read_self'
    ];
    for (const p of patientPermissions) {
      this.db.insertRolePermission({
        roleId: 'role-patient',
        permissionCode: p,
        granted: true
      });
    }
  }

  /**
   * 3. Seed MOH Central Root Organization
   */
  public seedMOHRootOrganization(): void {
    const mohOrgId = 'ORG-MOH-HQ';
    if (!this.db.getOrganization(mohOrgId)) {
      this.db.insertOrganization({
        id: mohOrgId,
        organizationName: 'Ministry of Health - Central Command',
        organizationNameAr: 'وزارة الصحة - المقر الرئيسي',
        organizationType: 'ministry',
        region: 'Riyadh',
        status: 'active',
        licenseNumber: 'MOH-GOV-001',
        parentOrganizationId: null
      });
    }
  }

  /**
   * Run All Migrations and Seeders
   */
  public async runAll(): Promise<{ cleaned: boolean; seededRoles: number; seededOrgs: number }> {
    await this.cleanupLegacy();
    this.seedRealRoles();
    this.seedMOHRootOrganization();

    return {
      cleaned: true,
      seededRoles: this.db.roles.size,
      seededOrgs: this.db.organizations.size
    };
  }
}

