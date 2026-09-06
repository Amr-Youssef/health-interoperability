-- AlterTable
ALTER TABLE "Consent" ADD COLUMN "allowed_organizations" TEXT;
ALTER TABLE "Consent" ADD COLUMN "appointment_id" TEXT;
ALTER TABLE "Consent" ADD COLUMN "blocked_categories" TEXT;
ALTER TABLE "Consent" ADD COLUMN "created_by" TEXT;
ALTER TABLE "Consent" ADD COLUMN "expires_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "clinician_id" TEXT,
    "appointment_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "service_category" TEXT,
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3),
    "reason" TEXT,
    "slot_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appointment_patient_id_idx" ON "Appointment"("patient_id");
CREATE INDEX "Appointment_organization_id_idx" ON "Appointment"("organization_id");
CREATE INDEX "Appointment_clinician_id_idx" ON "Appointment"("clinician_id");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE UNIQUE INDEX "Consent_appointment_id_key" ON "Consent"("appointment_id");
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("internal_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clinician_id_fkey" FOREIGN KEY ("clinician_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
