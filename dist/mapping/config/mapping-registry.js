export const DEFAULT_MAPPINGS = [
    // ==========================================
    // HOSPITAL A MAPPINGS (Arabic Legacy Schema)
    // ==========================================
    {
        id: 'map-ha-patient-v1',
        sourceSystemId: 'hospital-a',
        sourceEntityType: 'patient',
        targetCanonicalEntity: 'CanonicalPatient',
        mappingVersion: '1.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital A Arabic patient table to CanonicalPatient',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'رقم_المريض', targetField: 'mrn', required: true },
            { sourceField: 'الاسم_الاول', targetField: 'givenName', required: true },
            { sourceField: 'اسم_العائلة', targetField: 'familyName', required: true },
            { sourceField: 'الجنس', targetField: 'gender', required: true, transformation: 'gender_normalize' },
            { sourceField: 'تاريخ_الميلاد', targetField: 'birthDate', required: true, transformation: 'date_normalize' },
            { sourceField: 'رقم_الهوية', targetField: 'nationalId', required: true },
            { sourceField: 'نوع_الهوية', targetField: 'idType' },
            { sourceField: 'الجنسية', targetField: 'nationality' },
            { sourceField: 'رقم_الجوال', targetField: 'phone' },
            { sourceField: 'المدينة', targetField: 'city' }
        ]
    },
    {
        id: 'map-ha-visit-v1',
        sourceSystemId: 'hospital-a',
        sourceEntityType: 'visit',
        targetCanonicalEntity: 'CanonicalEncounter',
        mappingVersion: '1.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital A visits to CanonicalEncounter',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'رقم_الزيارة', targetField: 'sourceVisitId', required: true },
            { sourceField: 'رقم_المريض', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'تاريخ_الدخول', targetField: 'period.start', required: true, transformation: 'datetime_normalize' },
            { sourceField: 'تاريخ_الخروج', targetField: 'period.end', transformation: 'datetime_normalize' },
            { sourceField: 'نوع_الزيارة', targetField: 'class', required: true, transformation: 'encounter_type_map' },
            { sourceField: 'القسم', targetField: 'departmentAr' },
            { sourceField: 'الطبيب', targetField: 'attendingPractitionerId' },
            { sourceField: 'سبب_الزيارة', targetField: 'reasonTextAr' }
        ]
    },
    {
        id: 'map-ha-diagnosis-v1',
        sourceSystemId: 'hospital-a',
        sourceEntityType: 'diagnosis',
        targetCanonicalEntity: 'CanonicalCondition',
        mappingVersion: '1.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital A Arabic local diagnoses to CanonicalCondition',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'رقم_التشخيص', targetField: 'sourceRecordId', required: true },
            { sourceField: 'رقم_الزيارة', targetField: 'sourceVisitId', required: true },
            { sourceField: 'كود_التشخيص', targetField: 'code', required: true, terminologyMapId: 'map-ha-dx-01' },
            { sourceField: 'وصف_التشخيص', targetField: 'note' },
            { sourceField: 'نوع_التشخيص', targetField: 'rank', transformation: 'diagnosis_rank_map' },
            { sourceField: 'تاريخ_التسجيل', targetField: 'recordedDate', transformation: 'date_normalize' }
        ]
    },
    {
        id: 'map-ha-lab-v1',
        sourceSystemId: 'hospital-a',
        sourceEntityType: 'lab_result',
        targetCanonicalEntity: 'CanonicalObservation',
        mappingVersion: '1.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital A Arabic lab results to CanonicalObservation',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'رقم_الفحص', targetField: 'sourceRecordId', required: true },
            { sourceField: 'رقم_الزيارة', targetField: 'sourceVisitId', required: true },
            { sourceField: 'اسم_الفحص', targetField: 'code', required: true, terminologyMapId: 'map-ha-lab-01' },
            { sourceField: 'النتيجة', targetField: 'valueQuantity.value', required: true, transformation: 'number_parse' },
            { sourceField: 'الوحدة', targetField: 'valueQuantity.unit' },
            { sourceField: 'المرجع_الطبيعي', targetField: 'referenceRange.text' },
            { sourceField: 'تاريخ_الفحص', targetField: 'effectiveDateTime', transformation: 'date_normalize' }
        ]
    },
    {
        id: 'map-ha-insurance-v1',
        sourceSystemId: 'hospital-a',
        sourceEntityType: 'insurance_policy',
        targetCanonicalEntity: 'CanonicalCoverage',
        mappingVersion: '1.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Financial Team',
        description: 'Maps Hospital A Arabic insurance policy records to CanonicalCoverage',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'رقم_البوليصة', targetField: 'policyNumber', required: true },
            { sourceField: 'رقم_المريض', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'شركة_التأمين', targetField: 'payerNameAr' },
            { sourceField: 'كود_الشركة', targetField: 'payerId', required: true },
            { sourceField: 'رقم_العضوية', targetField: 'memberId', required: true },
            { sourceField: 'فئة_الشبكة', targetField: 'networkClass' },
            { sourceField: 'تاريخ_البدء', targetField: 'period.start', transformation: 'date_normalize' },
            { sourceField: 'تاريخ_الانتهاء', targetField: 'period.end', transformation: 'date_normalize' }
        ]
    },
    {
        id: 'map-ha-claim-v1',
        sourceSystemId: 'hospital-a',
        sourceEntityType: 'bill_claim',
        targetCanonicalEntity: 'CanonicalClaim',
        mappingVersion: '1.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Financial Team',
        description: 'Maps Hospital A Arabic billing items to CanonicalClaim',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'رقم_الفاتورة', targetField: 'sourceRecordId', required: true },
            { sourceField: 'رقم_الزيارة', targetField: 'sourceVisitId', required: true },
            { sourceField: 'رقم_المريض', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'كود_الخدمة', targetField: 'serviceCode', required: true },
            { sourceField: 'اسم_الخدمة', targetField: 'serviceNameAr' },
            { sourceField: 'السعر_الإجمالي', targetField: 'totalGrossSAR', transformation: 'number_parse' },
            { sourceField: 'تحمل_المريض', targetField: 'patientCopaySAR', transformation: 'number_parse' },
            { sourceField: 'مطالبة_التأمين', targetField: 'netClaimedSAR', transformation: 'number_parse' },
            { sourceField: 'تاريخ_الفاتورة', targetField: 'submissionDate', transformation: 'date_normalize' }
        ]
    },
    {
        id: 'map-ha-rx-v1',
        sourceSystemId: 'hospital-a',
        sourceEntityType: 'prescription',
        targetCanonicalEntity: 'CanonicalMedicationRequest',
        mappingVersion: '1.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Pharmacy Integration Team',
        description: 'Maps Hospital A prescriptions to CanonicalMedicationRequest with SFDA SDC crosswalk',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'رقم_الوصفة', targetField: 'sourceRecordId', required: true },
            { sourceField: 'رقم_الزيارة', targetField: 'sourceVisitId', required: true },
            { sourceField: 'رقم_المريض', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'كود_الدواء', targetField: 'medication.code', required: true, terminologyMapId: 'map-ha-med-01' },
            { sourceField: 'اسم_الدواء', targetField: 'medicationName' },
            { sourceField: 'طريقة_الاستخدام', targetField: 'dosageInstructionTextAr' },
            { sourceField: 'الكمية', targetField: 'quantity', transformation: 'number_parse' },
            { sourceField: 'التكرار_المسموح', targetField: 'repeatsAllowed', transformation: 'number_parse' },
            { sourceField: 'تاريخ_الوصفة', targetField: 'authoredOn', transformation: 'date_normalize' }
        ]
    },
    {
        id: 'map-ha-vax-v1',
        sourceSystemId: 'hospital-a',
        sourceEntityType: 'vaccination',
        targetCanonicalEntity: 'CanonicalImmunization',
        mappingVersion: '1.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Public Health Team',
        description: 'Maps Hospital A vaccinations to CanonicalImmunization with Saudi MOH & CVX codes',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'رقم_التطعيم', targetField: 'sourceRecordId', required: true },
            { sourceField: 'رقم_المريض', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'كود_اللقاح', targetField: 'vaccineCode', required: true, terminologyMapId: 'map-ha-vax-01' },
            { sourceField: 'اسم_اللقاح', targetField: 'vaccineName' },
            { sourceField: 'رقم_التشغيلة', targetField: 'lotNumber' },
            { sourceField: 'تاريخ_الانتهاء', targetField: 'expirationDate', transformation: 'date_normalize' },
            { sourceField: 'تاريخ_الإعطاء', targetField: 'occurrenceDateTime', transformation: 'date_normalize' },
            { sourceField: 'مكان_الحقن', targetField: 'site' }
        ]
    },
    // ==========================================
    // HOSPITAL B MAPPINGS (English Relational Schema)
    // ==========================================
    {
        id: 'map-hb-pt-master-v1',
        sourceSystemId: 'hospital-b',
        sourceEntityType: 'pt_master',
        targetCanonicalEntity: 'CanonicalPatient',
        mappingVersion: '1.2.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital B pt_master table to CanonicalPatient',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'mrn', targetField: 'mrn', required: true },
            { sourceField: 'national_id', targetField: 'nationalId' },
            { sourceField: 'iqama_no', targetField: 'iqamaNo' },
            { sourceField: 'first_name_ar', targetField: 'givenNameAr' },
            { sourceField: 'last_name_ar', targetField: 'familyNameAr' },
            { sourceField: 'first_name_en', targetField: 'givenName', required: true },
            { sourceField: 'last_name_en', targetField: 'familyName', required: true },
            { sourceField: 'sex', targetField: 'gender', required: true, transformation: 'gender_normalize' },
            { sourceField: 'birth_date', targetField: 'birthDate', required: true, transformation: 'date_normalize' },
            { sourceField: 'phone', targetField: 'phone' },
            { sourceField: 'nationality_code', targetField: 'nationalityCode' }
        ]
    },
    {
        id: 'map-hb-encounter-v1',
        sourceSystemId: 'hospital-b',
        sourceEntityType: 'encounters',
        targetCanonicalEntity: 'CanonicalEncounter',
        mappingVersion: '1.2.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital B encounters to CanonicalEncounter',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'enc_id', targetField: 'sourceVisitId', required: true },
            { sourceField: 'mrn', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'admit_dt', targetField: 'period.start', required: true, transformation: 'datetime_normalize' },
            { sourceField: 'discharge_dt', targetField: 'period.end', transformation: 'datetime_normalize' },
            { sourceField: 'enc_type', targetField: 'class', required: true, transformation: 'encounter_type_map' },
            { sourceField: 'dept_code', targetField: 'department' },
            { sourceField: 'attending_dr', targetField: 'attendingPractitionerId' }
        ]
    },
    {
        id: 'map-hb-dx-v1',
        sourceSystemId: 'hospital-b',
        sourceEntityType: 'dx',
        targetCanonicalEntity: 'CanonicalCondition',
        mappingVersion: '1.2.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital B ICD-10 diagnoses to CanonicalCondition',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'dx_id', targetField: 'sourceRecordId', required: true },
            { sourceField: 'enc_id', targetField: 'sourceVisitId', required: true },
            { sourceField: 'icd_code', targetField: 'code', required: true, terminologyMapId: 'map-hb-dx-01' },
            { sourceField: 'dx_desc', targetField: 'note' },
            { sourceField: 'dx_rank', targetField: 'rank', transformation: 'diagnosis_rank_map' },
            { sourceField: 'recorded_dt', targetField: 'recordedDate', transformation: 'datetime_normalize' }
        ]
    },
    {
        id: 'map-hb-lab-v1',
        sourceSystemId: 'hospital-b',
        sourceEntityType: 'lab_orders',
        targetCanonicalEntity: 'CanonicalObservation',
        mappingVersion: '1.2.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital B lab orders to CanonicalObservation',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'order_id', targetField: 'sourceRecordId', required: true },
            { sourceField: 'enc_id', targetField: 'sourceVisitId', required: true },
            { sourceField: 'test_code', targetField: 'code', required: true, terminologyMapId: 'map-hb-lab-01' },
            { sourceField: 'result', targetField: 'valueQuantity.value', required: true },
            { sourceField: 'unit', targetField: 'valueQuantity.unit' },
            { sourceField: 'result_dt', targetField: 'effectiveDateTime', transformation: 'datetime_normalize' }
        ]
    },
    {
        id: 'map-hb-policy-v1',
        sourceSystemId: 'hospital-b',
        sourceEntityType: 'policies',
        targetCanonicalEntity: 'CanonicalCoverage',
        mappingVersion: '1.3.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Financial Team',
        description: 'Maps Hospital B insurance policies to CanonicalCoverage',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'policy_id', targetField: 'policyNumber', required: true },
            { sourceField: 'mrn', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'payer_name', targetField: 'payerName' },
            { sourceField: 'payer_code', targetField: 'payerId', required: true },
            { sourceField: 'member_id', targetField: 'memberId', required: true },
            { sourceField: 'plan_tier', targetField: 'networkClass' },
            { sourceField: 'valid_from', targetField: 'period.start', transformation: 'date_normalize' },
            { sourceField: 'valid_to', targetField: 'period.end', transformation: 'date_normalize' }
        ]
    },
    {
        id: 'map-hb-claim-v1',
        sourceSystemId: 'hospital-b',
        sourceEntityType: 'claims',
        targetCanonicalEntity: 'CanonicalClaim',
        mappingVersion: '1.3.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Financial Team',
        description: 'Maps Hospital B claims to CanonicalClaim',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'claim_id', targetField: 'sourceRecordId', required: true },
            { sourceField: 'enc_id', targetField: 'sourceVisitId', required: true },
            { sourceField: 'mrn', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'service_code', targetField: 'serviceCode', required: true },
            { sourceField: 'service_desc', targetField: 'serviceName' },
            { sourceField: 'total_gross', targetField: 'totalGrossSAR' },
            { sourceField: 'patient_share', targetField: 'patientCopaySAR' },
            { sourceField: 'payer_share', targetField: 'netClaimedSAR' },
            { sourceField: 'claim_date', targetField: 'submissionDate', transformation: 'datetime_normalize' }
        ]
    },
    {
        id: 'map-hb-rx-v1',
        sourceSystemId: 'hospital-b',
        sourceEntityType: 'rx_orders',
        targetCanonicalEntity: 'CanonicalMedicationRequest',
        mappingVersion: '1.3.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Pharmacy Integration Team',
        description: 'Maps Hospital B rx_orders to CanonicalMedicationRequest',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'rx_id', targetField: 'sourceRecordId', required: true },
            { sourceField: 'enc_id', targetField: 'sourceVisitId', required: true },
            { sourceField: 'mrn', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'drug_code', targetField: 'medication.code', required: true, terminologyMapId: 'map-hb-med-01' },
            { sourceField: 'drug_name', targetField: 'medicationName' },
            { sourceField: 'sig', targetField: 'dosageInstructionText' },
            { sourceField: 'qty', targetField: 'quantity' },
            { sourceField: 'refills', targetField: 'repeatsAllowed' },
            { sourceField: 'prescribed_dt', targetField: 'authoredOn', transformation: 'datetime_normalize' }
        ]
    },
    {
        id: 'map-hb-vax-v1',
        sourceSystemId: 'hospital-b',
        sourceEntityType: 'vaccinations',
        targetCanonicalEntity: 'CanonicalImmunization',
        mappingVersion: '1.3.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Public Health Team',
        description: 'Maps Hospital B vaccinations to CanonicalImmunization',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'vax_id', targetField: 'sourceRecordId', required: true },
            { sourceField: 'mrn', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'vax_code', targetField: 'vaccineCode', required: true, terminologyMapId: 'map-hb-vax-01' },
            { sourceField: 'vax_name', targetField: 'vaccineName' },
            { sourceField: 'lot_no', targetField: 'lotNumber' },
            { sourceField: 'exp_dt', targetField: 'expirationDate', transformation: 'date_normalize' },
            { sourceField: 'admin_dt', targetField: 'occurrenceDateTime', transformation: 'datetime_normalize' },
            { sourceField: 'admin_site', targetField: 'site' }
        ]
    },
    // ==========================================
    // HOSPITAL C MAPPINGS (FHIR Native R4)
    // ==========================================
    {
        id: 'map-hc-patient-v1',
        sourceSystemId: 'hospital-c',
        sourceEntityType: 'Patient',
        targetCanonicalEntity: 'CanonicalPatient',
        mappingVersion: '2.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital C FHIR Patient resource to CanonicalPatient',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'id', targetField: 'sourceRecordId', required: true }
        ]
    },
    {
        id: 'map-hc-coverage-v1',
        sourceSystemId: 'hospital-c',
        sourceEntityType: 'Coverage',
        targetCanonicalEntity: 'CanonicalCoverage',
        mappingVersion: '2.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital C FHIR Coverage to CanonicalCoverage',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'id', targetField: 'sourceRecordId', required: true }
        ]
    },
    {
        id: 'map-hc-claim-v1',
        sourceSystemId: 'hospital-c',
        sourceEntityType: 'Claim',
        targetCanonicalEntity: 'CanonicalClaim',
        mappingVersion: '2.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital C FHIR Claim to CanonicalClaim',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'id', targetField: 'sourceRecordId', required: true }
        ]
    },
    {
        id: 'map-hc-med-v1',
        sourceSystemId: 'hospital-c',
        sourceEntityType: 'MedicationRequest',
        targetCanonicalEntity: 'CanonicalMedicationRequest',
        mappingVersion: '2.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital C FHIR MedicationRequest to CanonicalMedicationRequest',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'id', targetField: 'sourceRecordId', required: true }
        ]
    },
    {
        id: 'map-hc-vax-v1',
        sourceSystemId: 'hospital-c',
        sourceEntityType: 'Immunization',
        targetCanonicalEntity: 'CanonicalImmunization',
        mappingVersion: '2.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital C FHIR Immunization to CanonicalImmunization',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'id', targetField: 'sourceRecordId', required: true }
        ]
    },
    {
        id: 'map-hc-encounter-v1',
        sourceSystemId: 'hospital-c',
        sourceEntityType: 'Encounter',
        targetCanonicalEntity: 'CanonicalEncounter',
        mappingVersion: '2.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital C FHIR Encounter to CanonicalEncounter',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'id', targetField: 'sourceVisitId', required: true }
        ]
    },
    {
        id: 'map-hc-condition-v1',
        sourceSystemId: 'hospital-c',
        sourceEntityType: 'Condition',
        targetCanonicalEntity: 'CanonicalCondition',
        mappingVersion: '2.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital C FHIR Condition to CanonicalCondition',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'id', targetField: 'sourceRecordId', required: true }
        ]
    },
    {
        id: 'map-hc-observation-v1',
        sourceSystemId: 'hospital-c',
        sourceEntityType: 'Observation',
        targetCanonicalEntity: 'CanonicalObservation',
        mappingVersion: '2.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital C FHIR Observation to CanonicalObservation',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'id', targetField: 'sourceRecordId', required: true }
        ]
    },
    {
        id: 'map-ha-allergy-v1',
        sourceSystemId: 'hospital-a',
        sourceEntityType: 'allergy',
        targetCanonicalEntity: 'CanonicalAllergyIntolerance',
        mappingVersion: '1.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital A Arabic allergy table to CanonicalAllergyIntolerance',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'رقم_الحساسية', targetField: 'sourceRecordId', required: true },
            { sourceField: 'رقم_المريض', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'المادة_المسببة', targetField: 'substanceText', required: true },
            { sourceField: 'كود_المادة', targetField: 'substanceCode', terminologyMapId: 'map-ha-alg-01' },
            { sourceField: 'درجة_الخطورة', targetField: 'criticality' },
            { sourceField: 'التفاعل_التحسسي', targetField: 'reactionText' },
            { sourceField: 'تاريخ_التسجيل', targetField: 'recordedDate', transformation: 'date_normalize' }
        ]
    },
    {
        id: 'map-hb-allergy-v1',
        sourceSystemId: 'hospital-b',
        sourceEntityType: 'allergies',
        targetCanonicalEntity: 'CanonicalAllergyIntolerance',
        mappingVersion: '1.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital B allergy records to CanonicalAllergyIntolerance',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'allergy_id', targetField: 'sourceRecordId', required: true },
            { sourceField: 'mrn', targetField: 'sourcePatientMrn', required: true },
            { sourceField: 'allergen', targetField: 'substanceText', required: true },
            { sourceField: 'snomed_code', targetField: 'substanceCode', terminologyMapId: 'map-hb-alg-01' },
            { sourceField: 'criticality', targetField: 'criticality' },
            { sourceField: 'reaction_desc', targetField: 'reactionText' },
            { sourceField: 'recorded_dt', targetField: 'recordedDate', transformation: 'datetime_normalize' }
        ]
    },
    {
        id: 'map-hc-allergy-v1',
        sourceSystemId: 'hospital-c',
        sourceEntityType: 'AllergyIntolerance',
        targetCanonicalEntity: 'CanonicalAllergyIntolerance',
        mappingVersion: '2.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital C FHIR AllergyIntolerance to CanonicalAllergyIntolerance',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'id', targetField: 'sourceRecordId', required: true }
        ]
    },
    {
        id: 'map-hc-diagnostic-v1',
        sourceSystemId: 'hospital-c',
        sourceEntityType: 'DiagnosticReport',
        targetCanonicalEntity: 'CanonicalDiagnosticReport',
        mappingVersion: '2.0.0',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE',
        author: 'Integration Team',
        description: 'Maps Hospital C FHIR DiagnosticReport to CanonicalDiagnosticReport',
        validationState: 'VALIDATED',
        fieldMappings: [
            { sourceField: 'id', targetField: 'sourceRecordId', required: true }
        ]
    }
];
//# sourceMappingURL=mapping-registry.js.map