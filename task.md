# Tasks — Saudi National Health Interoperability Platform

## Phase 1: MVP-Core (Completed ✅)
- [x] Core CHDM Domain Models
- [x] 3 Heterogeneous Synthetic Sources (Hospital A, B, C)
- [x] Source Adapters
- [x] Immutable Raw Ingestion Store with SHA-256 Checksums
- [x] 3-Stage Mapping Engine (Structural, Transform, Terminology)
- [x] Terminology Service (SNOMED CT + ICD-10-AM + SBS + LOINC)
- [x] Data Quality & Validation Engine (0-100 score + decision gate)
- [x] Master Patient Index (MPI) with deterministic & demographic resolution
- [x] Provenance & Audit Logging
- [x] FHIR R4.0.1 Serializers & API ($everything)
- [x] Modern Interactive Web Dashboard
- [x] Automated Unit & Integration Tests (5/5 passing)

## Phase 2: NPHIES Taameen, Insurance & Claims Engine (Completed ✅)
- [x] Financial Domain Models: `CanonicalCoverage`, `CanonicalClaim`, `CanonicalClaimResponse`, `CanonicalEligibility`
- [x] Synthetic Insurance & Billing datasets for Hospitals A, B, and C
- [x] Financial Mappings & Saudi Billing System (SBS) price rule crosswalks
- [x] NPHIES FHIR R4 Serializers (`Claim`, `ClaimResponse`, `Coverage`, `CoverageEligibilityRequest/Response`) with official Saudi extensions
- [x] NPHIES Sandbox Adjudication Simulator (CHI rules, co-pay calculation, policy limits)
- [x] Integration of Claims Engine into Normalization Pipeline
- [x] Interactive NPHIES Taameen & Claims Dashboard UI
- [x] Automated vitest test suite for NPHIES & Claims workflows (6/6 passing)

## Phase 3: SFDA Drug Registry, Medications & Immunizations (Completed ✅)
- [x] Domain Models: `CanonicalMedication`, `CanonicalMedicationRequest`, `CanonicalImmunization`
- [x] Synthetic Medication & Immunization datasets across Hospitals A, B, and C
- [x] Terminology Service: SFDA Saudi Drug Code (SDC), Trade/Generic names, ATC, RxNorm, and Saudi MOH Vaccine Schedule crosswalks
- [x] Validation Engine: Dosage sanity rules, SFDA identifier formatting, lot number and expiration validation
- [x] Mapping Configurations for Prescriptions and Vaccines across all 3 source schemas
- [x] FHIR R4 Serializers for `MedicationRequest` and `Immunization`
- [x] Normalization Pipeline Integration & $everything update (25 unified resources)
- [x] Interactive Medications & Vaccines Dashboard Tab in Web UI
- [x] Vitest Automated Tests for Medication and Immunization normalization (7/7 passing)

## Phase 4: Dynamic Hospital Onboarding & Clinical Decision Support (CDS) (Completed ✅)
- [x] Dynamic Hospital Onboarding System (`DynamicHospitalRegistry` & `GenericConfigurableAdapter`)
- [x] Ingest & normalize custom schemas on the fly via UI and REST API (`/api/hospitals/onboard`, `/api/hospitals/:id/ingest`)
- [x] Clinical Decision Support & SFDA Drug Safety Engine (`CdsHooksEngine`)
- [x] Interactive ePrescribing trial simulator with prospective drug-drug & renal interaction checking
- [x] Patient Privacy Consent & Break-the-Glass Emergency Protocol (`ConsentManager`)
- [x] Population Health & National Clinical Analytics (`PopulationHealthService`)
- [x] Interactive Hospital Onboarding Studio and CDS Safety Cards in Web Dashboard

## Phase 5: Enterprise Cybersecurity, NCA Audit Hash Chain & FHIR Bulk Export (Completed ✅)
- [x] Cryptographic Tamper-Evident Audit Chain (`CryptographicAuditChain`) with SHA-256 linked blocks (NCA & PDPL compliant)
- [x] Chain integrity verification endpoint (`GET /api/security/audit-chain/verify`)
- [x] HL7 FHIR Bulk Data Export (`$export`) engine (`FhirBulkExportService`) generating standard NDJSON
- [x] Built-in PDPL De-identification / Anonymization pipeline for epidemiological and AI research
- [x] Automated test suite verifying 10 comprehensive architectural test suites (10/10 passing)

## Phase 6: Production Containerization & High-Throughput Benchmarking (Completed ✅)
- [x] Multi-stage secure Dockerfile (`Dockerfile`) with non-root security compliance
- [x] Production Docker Compose orchestration (`docker-compose.yml`) with health checks
- [x] High-Throughput Stress Test & Benchmark Suite (`npm run benchmark`) achieving **15,900+ records/sec** throughput
- [x] Complete updated documentation across `WALKTHROUGH.md` and `IMPLEMENTATION_PLAN.md`

## Phase 7: HL7v2 & SMART on FHIR National Extensions (Completed ✅)
- [x] HL7 v2.5 MLLP ingestion (`POST /api/hl7v2/ingest` + TCP listener :2575 — `src/ingestion/hl7v2/`)
- [x] SMART on FHIR OAuth2 gateway (`/.well-known/smart-configuration`, `/oauth/token`, `/oauth/introspect` — `src/modules/smart/`)
- [x] WHITEPAPER.md (Vision 2030 executive report)

## Phase 8: RBAC Hardening & Governance (Completed ✅)
- [x] Migration `20260903000000_rbac_hardening` — 6 roles (SYS_ADMIN, MOH_ADMIN, MOH_AUDITOR, HOSPITAL_ADMIN, CLINICIAN, PATIENT) × ~33 permissions
- [x] `AuthorizationService` + `verifyToken/requirePermission` enforcement on FHIR/clinical/patient routes (`src/security/`)
- [x] MOH governance routes (`src/api/routes/moh-routes.ts` — 20 endpoints: approve/reject/suspend hospitals, user admin, org-change review, verification queue, MPI duplicates)
- [x] Hospital workspace routes (`src/api/routes/hospital-routes.ts` — 18 endpoints: profile, stats, global/local patients, longitudinal, imports, user management)
- [x] Baseline security suite `tests/unit/baseline-security.test.ts` (10/10)

## Phase 9: Appointments Quad + Corrections Workflow (Completed ✅)
- [x] Migration `20260904000000_appointment_consent_quad` — `Appointment` (ROUTINE/EMERGENCY/REFERRAL/CHRONIC) ↔ `Consent` (1-1)
- [x] Appointments API (`src/api/routes/appointments-routes.ts` — POST /my /organization /:id/status /:id)
- [x] Migration `20260904000001_correction_status` — `correction_status` on canonical clinical models
- [x] Corrections API (`src/api/routes/corrections-routes.ts` — request/approve/pending)
- [x] Consent enforcement baseline `OPT_IN_FULL → EXPLICIT_PER_ENCOUNTER` + break-glass (`src/modules/security/`)

## Phase 10: Patient Self-Reported Health Module (Completed ✅)
- [x] Migration `20260830180112_add_patient_reported_health_data` — 9 tables (Profile, Allergy, Medication, Condition, Procedure, FamilyMember, SocialHistory, VitalObservation, UploadedDocument)
- [x] Service `src/core/patient-reported-health-service.ts` (60+ methods) + domain `src/core/domain/patient-reported-health.ts` (14 types)
- [x] REST API `src/api/routes/patient-reported-health-routes.ts` (~31 endpoints under `/api/patients/me/*`)
- [x] FHIR serializers `src/fhir/patient-reported-health-fhir-serializer.ts` (6 methods, R4)
- [x] Verification `src/demo/verify-patient-health.ts` (15/15) + Vitest suites + frontend `public/js/patient-self-reported.js`
- [x] Docs: `PATIENT_HEALTH_IMPLEMENTATION_REPORT.md`, `PATIENT_HEALTH_SUMMARY.md`, `QUICK_START.md`, `PROJECT_STATUS.md`

## Phase 11: Modularization, Audit Integration & Cloud Deploy (Completed ✅ — updated 2026-09-13)
- [x] `src/modules/` — 16 route modules extracted from monolithic `server.ts` (fhir, smart, platform, nphies, cds, analytics incl. Weqaa, security incl. audit-chain, data incl. raw/mpi/terminology/provenance, patients, hospital, public, hl7, clinical, clinical-write, admin incl. reset-data, audit incl. integration-overview/connectors/records/trace/evidence)
- [x] `AuditBlock` hash-chain table (P8) + audit integration routes (`GET /api/audit/...`)
- [x] Patient identity UUID migration plan `docs/migration/patient-identity-unification.md` (P6 — `patient_id_uuid` live on clinical models)
- [x] Vercel serverless entry `api/index.ts` + `vercel.json` + guaranteed cloud Postgres connection (Sept 2026 commits)
- [x] Design system freeze `DESIGN_SYSTEM.md` (v0.2.4) + `docs/SYSTEM_MAP.md` platform map
- [x] Platform test surface: 6 files / ~32 tests (`npm test`); `tsc --noEmit` clean (2026-09-13)
