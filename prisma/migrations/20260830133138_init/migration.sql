-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "patient_profile_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "organization_name" TEXT NOT NULL,
    "organization_name_ar" TEXT,
    "organization_type" TEXT NOT NULL,
    "region" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "parent_organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "role_name" TEXT NOT NULL,
    "role_code" TEXT NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_code" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission_code" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "first_name_ar" TEXT,
    "last_name_ar" TEXT,
    "birth_date" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source_system_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientIdentifier" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "system" TEXT,
    "source_system_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientOrganization" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PatientOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "source_visit_id" TEXT,
    "encounter_class" TEXT,
    "status" TEXT NOT NULL DEFAULT 'FINISHED',
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "source_system_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "organization_id" TEXT,
    "clinical_status" TEXT,
    "verification_status" TEXT,
    "code_source_code" TEXT,
    "code_source_system" TEXT,
    "code_source_display" TEXT,
    "code_snomed_code" TEXT,
    "code_snomed_display" TEXT,
    "code_icd10am_code" TEXT,
    "code_icd10am_display" TEXT,
    "recorded_date" TIMESTAMP(3),
    "source_system_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "organization_id" TEXT,
    "status" TEXT,
    "code_source_code" TEXT,
    "code_source_system" TEXT,
    "code_source_display" TEXT,
    "code_loinc_code" TEXT,
    "code_loinc_display" TEXT,
    "code_sbs_code" TEXT,
    "code_sbs_display" TEXT,
    "value_quantity" DOUBLE PRECISION,
    "value_unit" TEXT,
    "value_string" TEXT,
    "effective_date" TIMESTAMP(3),
    "source_system_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationRequest" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "organization_id" TEXT,
    "status" TEXT,
    "intent" TEXT,
    "code_source_code" TEXT,
    "code_source_system" TEXT,
    "code_source_display" TEXT,
    "code_sfda_code" TEXT,
    "code_sfda_display" TEXT,
    "code_rxnorm_code" TEXT,
    "code_rxnorm_display" TEXT,
    "code_atc_code" TEXT,
    "dosage_text" TEXT,
    "authored_on" TIMESTAMP(3),
    "source_system_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Immunization" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "organization_id" TEXT,
    "status" TEXT,
    "code_source_code" TEXT,
    "code_source_system" TEXT,
    "code_source_display" TEXT,
    "code_cvx_code" TEXT,
    "code_cvx_display" TEXT,
    "occurrence_date" TIMESTAMP(3),
    "source_system_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Immunization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coverage" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "status" TEXT,
    "type" TEXT,
    "subscriber_id" TEXT,
    "beneficiary_id" TEXT,
    "payor_id" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "source_system_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "encounter_id" TEXT,
    "coverage_id" TEXT,
    "status" TEXT,
    "type" TEXT,
    "use" TEXT,
    "total_value" DOUBLE PRECISION,
    "total_currency" TEXT,
    "submission_date" TIMESTAMP(3),
    "source_system_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimResponse" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "status" TEXT,
    "outcome" TEXT,
    "payment_value" DOUBLE PRECISION,
    "payment_currency" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllergyIntolerance" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "clinical_status" TEXT,
    "verification_status" TEXT,
    "type" TEXT,
    "code_source_code" TEXT,
    "code_source_system" TEXT,
    "code_source_display" TEXT,
    "code_snomed_code" TEXT,
    "code_snomed_display" TEXT,
    "recorded_date" TIMESTAMP(3),
    "source_system_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllergyIntolerance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticReport" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "status" TEXT,
    "code_source_code" TEXT,
    "code_source_system" TEXT,
    "code_source_display" TEXT,
    "code_loinc_code" TEXT,
    "code_loinc_display" TEXT,
    "issued" TIMESTAMP(3),
    "source_system_id" TEXT,
    "source_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "consent_type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "scope" TEXT NOT NULL,
    "consent_source" TEXT NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "organization_id" TEXT,
    "old_values" TEXT,
    "new_values" TEXT,
    "ip_address" TEXT,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataImport" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "file_name" TEXT,
    "import_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DataImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawRecord" (
    "id" TEXT NOT NULL,
    "source_system_id" TEXT NOT NULL,
    "source_entity_type" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "payload_format" TEXT NOT NULL,
    "adapter_version" TEXT NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL,
    "batch_id" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "processing_status" TEXT NOT NULL,
    "error_message" TEXT,
    "reprocess_count" INTEGER NOT NULL DEFAULT 0,
    "last_reprocessed_at" TIMESTAMP(3),

    CONSTRAINT "RawRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalPatientIdentity" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "given_name_norm" TEXT,
    "family_name_norm" TEXT,
    "birth_date" TEXT,
    "gender" TEXT,
    "phone_norm" TEXT,
    "merged_into" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalPatientIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MpiIdentifier" (
    "id" TEXT NOT NULL,
    "identity_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "system" TEXT,
    "source_system_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MpiIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchHistory" (
    "id" TEXT NOT NULL,
    "identity_id" TEXT NOT NULL,
    "matched_identifier" TEXT,
    "match_strategy" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "matched_by" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "details" TEXT,
    "matched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicateCandidate" (
    "id" TEXT NOT NULL,
    "patient_id_1" TEXT NOT NULL,
    "patient_id_2" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "name_score" DOUBLE PRECISION,
    "dob_score" DOUBLE PRECISION,
    "gender_score" DOUBLE PRECISION,
    "phone_score" DOUBLE PRECISION,
    "flagged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminologyConcept" (
    "id" TEXT NOT NULL,
    "preferred_term" TEXT NOT NULL,
    "preferred_term_ar" TEXT,
    "domain" TEXT NOT NULL,

    CONSTRAINT "TerminologyConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminologyCoding" (
    "id" TEXT NOT NULL,
    "concept_id" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display" TEXT NOT NULL,

    CONSTRAINT "TerminologyCoding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminologyMapping" (
    "id" TEXT NOT NULL,
    "source_system_id" TEXT NOT NULL,
    "source_code" TEXT NOT NULL,
    "source_display" TEXT,
    "canonical_concept_id" TEXT NOT NULL,
    "equivalence" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rule_version" TEXT NOT NULL,

    CONSTRAINT "TerminologyMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvenanceRecord" (
    "id" TEXT NOT NULL,
    "target_entity_type" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "source_system_id" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "mapping_version" TEXT NOT NULL,
    "adapter_version" TEXT NOT NULL,
    "persisted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_role_code_key" ON "Role"("role_code");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_internal_id_key" ON "Patient"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_internal_id_key" ON "Encounter"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "Condition_internal_id_key" ON "Condition"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "Observation_internal_id_key" ON "Observation"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationRequest_internal_id_key" ON "MedicationRequest"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "Immunization_internal_id_key" ON "Immunization"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "Coverage_internal_id_key" ON "Coverage"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_internal_id_key" ON "Claim"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "AllergyIntolerance_internal_id_key" ON "AllergyIntolerance"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticReport_internal_id_key" ON "DiagnosticReport"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "RawRecord_source_system_id_source_entity_type_source_record_key" ON "RawRecord"("source_system_id", "source_entity_type", "source_record_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parent_organization_id_fkey" FOREIGN KEY ("parent_organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientIdentifier" ADD CONSTRAINT "PatientIdentifier_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientOrganization" ADD CONSTRAINT "PatientOrganization_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientOrganization" ADD CONSTRAINT "PatientOrganization_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "Encounter"("internal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "Encounter"("internal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "Encounter"("internal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "Encounter"("internal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "Encounter"("internal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_coverage_id_fkey" FOREIGN KEY ("coverage_id") REFERENCES "Coverage"("internal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimResponse" ADD CONSTRAINT "ClaimResponse_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "Claim"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllergyIntolerance" ADD CONSTRAINT "AllergyIntolerance_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticReport" ADD CONSTRAINT "DiagnosticReport_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticReport" ADD CONSTRAINT "DiagnosticReport_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "Encounter"("internal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataImport" ADD CONSTRAINT "DataImport_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MpiIdentifier" ADD CONSTRAINT "MpiIdentifier_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "InternalPatientIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchHistory" ADD CONSTRAINT "MatchHistory_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "InternalPatientIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminologyCoding" ADD CONSTRAINT "TerminologyCoding_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "TerminologyConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
