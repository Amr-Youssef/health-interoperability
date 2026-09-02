-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('SYS_ADMIN', 'MOH_ADMIN', 'MOH_AUDITOR', 'HOSPITAL_ADMIN', 'CLINICIAN', 'PATIENT');
CREATE TYPE "PermissionCode" AS ENUM ('ORG_MANAGE_ALL', 'ORG_APPROVE', 'POLICY_MANAGE', 'QUALITY_MONITOR', 'AUDIT_READ_CENTRAL', 'AUDIT_READ_ORG', 'ANALYTICS_READ_NATIONAL', 'ANALYTICS_READ_ORG', 'USER_MANAGE_NATIONAL', 'USER_MANAGE_ORG', 'ROLE_ASSIGN_NATIONAL', 'ROLE_ASSIGN_ORG', 'PATIENT_READ_SELF', 'PATIENT_READ_ORG', 'PATIENT_READ_ALL', 'PATIENT_MANAGE_ORG', 'ENCOUNTER_CREATE_ORG', 'CLINICAL_WRITE_ORG', 'CLINICAL_READ_ORG', 'CLINICAL_READ_ALL', 'CLAIM_MANAGE_ORG', 'IMPORT_EXECUTE_ORG', 'CONSENT_MANAGE_SELF', 'CONSENT_OVERRIDE', 'BREAK_GLASS_EXECUTE', 'EXPORT_BULK_ANONYMIZED', 'EXPORT_BULK_IDENTIFIED', 'FHIR_READ_SELF', 'FHIR_READ_ORG', 'FHIR_READ_ALL', 'ACCESS_HISTORY_READ_SELF');

-- Alter Role.role_code to enum with USING cast
ALTER TABLE "Role" ALTER COLUMN "role_code" TYPE "RoleCode" USING "role_code"::"RoleCode";

-- Alter RolePermission.permission_code
ALTER TABLE "RolePermission" ALTER COLUMN "permission_code" TYPE "PermissionCode" USING "permission_code"::"PermissionCode";

-- Alter UserPermission.permission_code  
ALTER TABLE "UserPermission" ALTER COLUMN "permission_code" TYPE "PermissionCode" USING "permission_code"::"PermissionCode";

-- Add unique constraint for RolePermission
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_role_id_permission_code_key" ON "RolePermission"("role_id", "permission_code");

-- Add Cascade deletes
ALTER TABLE "RolePermission" DROP CONSTRAINT IF EXISTS "RolePermission_role_id_fkey";
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" DROP CONSTRAINT IF EXISTS "UserPermission_user_id_fkey";
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
