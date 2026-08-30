-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "preferred_first_name" TEXT,
    "preferred_last_name" TEXT,
    "preferred_language" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_relationship" TEXT,
    "address_line" TEXT,
    "address_city" TEXT,
    "address_district" TEXT,
    "address_postal_code" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT',
    "verification_status" TEXT NOT NULL DEFAULT 'SELF_REPORTED',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientReportedAllergy" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "allergen_name" TEXT NOT NULL,
    "allergen_code" TEXT,
    "allergen_system" TEXT,
    "allergen_display" TEXT,
    "reaction_text" TEXT,
    "reaction_severity" TEXT,
    "onset_date" TIMESTAMP(3),
    "is_medically_diagnosed" BOOLEAN,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT',
    "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientReportedAllergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientReportedMedication" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "medication_name" TEXT NOT NULL,
    "medication_code" TEXT,
    "medication_system" TEXT,
    "medication_display" TEXT,
    "strength" TEXT,
    "dose" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "reason_for_use" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "currently_taking" BOOLEAN DEFAULT true,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT',
    "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientReportedMedication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientReportedCondition" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "condition_name" TEXT NOT NULL,
    "condition_code" TEXT,
    "condition_system" TEXT,
    "condition_display" TEXT,
    "diagnosis_date" TIMESTAMP(3),
    "status" TEXT,
    "treating_facility" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT',
    "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientReportedCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientReportedProcedure" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "procedure_name" TEXT NOT NULL,
    "procedure_code" TEXT,
    "procedure_system" TEXT,
    "procedure_display" TEXT,
    "procedure_date" TIMESTAMP(3),
    "facility_name" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT',
    "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientReportedProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "relative_name" TEXT,
    "relationship" TEXT NOT NULL,
    "condition_name" TEXT,
    "condition_code" TEXT,
    "condition_system" TEXT,
    "condition_display" TEXT,
    "onset_date" TIMESTAMP(3),
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT',
    "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientReportedSocialHistory" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "smoking_status" TEXT,
    "smoking_frequency" TEXT,
    "tobacco_use" TEXT,
    "tobacco_frequency" TEXT,
    "physical_activity" TEXT,
    "activity_notes" TEXT,
    "occupation" TEXT,
    "sleep_hours" INTEGER,
    "sleep_quality" TEXT,
    "other_risk_factors" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT',
    "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientReportedSocialHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientReportedVitalObservation" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "observation_type" TEXT NOT NULL,
    "observation_code" TEXT,
    "observation_system" TEXT,
    "observation_display" TEXT,
    "value_quantity" DOUBLE PRECISION,
    "value_unit" TEXT,
    "value_text" TEXT,
    "systolic" DOUBLE PRECISION,
    "diastolic" DOUBLE PRECISION,
    "device_name" TEXT,
    "device_manufacturer" TEXT,
    "device_model" TEXT,
    "device_identifier" TEXT,
    "measurement_method" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "measurement_notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT',
    "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientReportedVitalObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientUploadedDocument" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_mimetype" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "document_category" TEXT NOT NULL,
    "document_description" TEXT,
    "storage_reference" TEXT NOT NULL,
    "processing_status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "extracted_data" TEXT,
    "extraction_error" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "verification_notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT',
    "upload_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientUploadedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "scope" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicHospital" (
    "hospitalId" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "hospitalNameAr" TEXT NOT NULL,
    "facilityType" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "adapterVersion" TEXT NOT NULL,
    "sourceSchema" TEXT NOT NULL,
    "defaultMappingConfigs" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "DynamicHospital_pkey" PRIMARY KEY ("hospitalId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_patient_id_key" ON "PatientProfile"("patient_id");

-- CreateIndex
CREATE INDEX "PatientReportedAllergy_patient_id_idx" ON "PatientReportedAllergy"("patient_id");

-- CreateIndex
CREATE INDEX "PatientReportedMedication_patient_id_idx" ON "PatientReportedMedication"("patient_id");

-- CreateIndex
CREATE INDEX "PatientReportedCondition_patient_id_idx" ON "PatientReportedCondition"("patient_id");

-- CreateIndex
CREATE INDEX "PatientReportedProcedure_patient_id_idx" ON "PatientReportedProcedure"("patient_id");

-- CreateIndex
CREATE INDEX "FamilyMember_patient_id_idx" ON "FamilyMember"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "PatientReportedSocialHistory_patient_id_key" ON "PatientReportedSocialHistory"("patient_id");

-- CreateIndex
CREATE INDEX "PatientReportedVitalObservation_patient_id_idx" ON "PatientReportedVitalObservation"("patient_id");

-- CreateIndex
CREATE INDEX "PatientUploadedDocument_patient_id_idx" ON "PatientUploadedDocument"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "SmartToken_token_key" ON "SmartToken"("token");

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientReportedAllergy" ADD CONSTRAINT "PatientReportedAllergy_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientReportedMedication" ADD CONSTRAINT "PatientReportedMedication_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientReportedCondition" ADD CONSTRAINT "PatientReportedCondition_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientReportedProcedure" ADD CONSTRAINT "PatientReportedProcedure_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientReportedSocialHistory" ADD CONSTRAINT "PatientReportedSocialHistory_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientReportedVitalObservation" ADD CONSTRAINT "PatientReportedVitalObservation_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientUploadedDocument" ADD CONSTRAINT "PatientUploadedDocument_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
