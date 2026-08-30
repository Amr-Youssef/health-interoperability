export class DataQualityEngine {
    ruleVersion = '1.0.0';
    /**
     * Validates a mapped entity before it can be admitted to the Canonical Persistence Store
     */
    async validate(mapped) {
        const issues = [];
        const data = mapped.data;
        let score = 100;
        switch (mapped.targetCanonicalEntity) {
            case 'CanonicalPatient':
                this.validatePatient(data, mapped.sourceSystemId, issues);
                break;
            case 'CanonicalEncounter':
                this.validateEncounter(data, mapped.sourceSystemId, issues);
                break;
            case 'CanonicalCondition':
                this.validateCondition(data, mapped.sourceSystemId, issues);
                break;
            case 'CanonicalObservation':
                this.validateObservation(data, mapped.sourceSystemId, issues);
                break;
            case 'CanonicalCoverage':
                this.validateCoverage(data, mapped.sourceSystemId, issues);
                break;
            case 'CanonicalClaim':
                this.validateClaim(data, mapped.sourceSystemId, issues);
                break;
            case 'CanonicalMedicationRequest':
                this.validateMedicationRequest(data, mapped.sourceSystemId, issues);
                break;
            case 'CanonicalImmunization':
                this.validateImmunization(data, mapped.sourceSystemId, issues);
                break;
            case 'CanonicalAllergyIntolerance':
                this.validateAllergyIntolerance(data, mapped.sourceSystemId, issues);
                break;
            case 'CanonicalDiagnosticReport':
                this.validateDiagnosticReport(data, mapped.sourceSystemId, issues);
                break;
            default:
                issues.push({
                    field: 'targetCanonicalEntity',
                    severity: 'ERROR',
                    rule: 'KNOWN_CANONICAL_TYPE',
                    message: `Unknown target canonical entity: ${mapped.targetCanonicalEntity}`
                });
        }
        // Deduct points based on issue severity
        for (const issue of issues) {
            if (issue.severity === 'ERROR') {
                score -= 30;
            }
            else if (issue.severity === 'WARNING') {
                score -= 10;
            }
            else {
                score -= 2;
            }
        }
        score = Math.max(0, Math.min(100, score));
        // Decision Logic
        let decision = 'ACCEPTED';
        const hasErrors = issues.some(i => i.severity === 'ERROR');
        if (hasErrors || score < 50) {
            decision = score < 50 && !hasErrors ? 'MANUAL_REVIEW' : 'REJECTED';
        }
        else if (score < 70) {
            decision = 'MANUAL_REVIEW';
        }
        else if (issues.some(i => i.severity === 'WARNING')) {
            decision = 'ACCEPTED_WITH_WARNINGS';
        }
        return {
            recordId: mapped.rawRecordId,
            score,
            decision,
            issues,
            validatedAt: new Date().toISOString(),
            validationRuleVersion: this.ruleVersion
        };
    }
    validatePatient(data, sourceSystemId, issues) {
        if (!data.nationalId && !data.iqamaNo && !data.mrn) {
            issues.push({
                field: 'identifiers',
                severity: 'ERROR',
                rule: 'PATIENT_IDENTIFIER_REQUIRED',
                message: 'Patient must have at least one identifier (National ID, Iqama, or MRN).'
            });
        }
        if (data.nationalId) {
            const nidStr = String(data.nationalId).trim();
            if (!/^\d{10}$/.test(nidStr)) {
                issues.push({
                    field: 'nationalId',
                    severity: 'ERROR',
                    rule: 'SA_NID_10_DIGITS',
                    message: `National ID must be exactly 10 digits. Received: ${nidStr}`,
                    sourceValue: nidStr
                });
            }
            else if (!nidStr.startsWith('1')) {
                issues.push({
                    field: 'nationalId',
                    severity: 'WARNING',
                    rule: 'SA_NID_STARTS_WITH_1',
                    message: `Saudi Citizen National ID typically starts with '1'. Received: ${nidStr}`,
                    sourceValue: nidStr
                });
            }
        }
        if (data.iqamaNo) {
            const iqamaStr = String(data.iqamaNo).trim();
            if (!/^\d{10}$/.test(iqamaStr) || !iqamaStr.startsWith('2')) {
                issues.push({
                    field: 'iqamaNo',
                    severity: 'ERROR',
                    rule: 'SA_IQAMA_BV_00798',
                    message: `Saudi Iqama must be exactly 10 digits and start with '2' (NPHIES invariant BV-00798). Received: ${iqamaStr}`,
                    sourceValue: iqamaStr
                });
            }
        }
        if (!data.givenName && !data.givenNameAr) {
            issues.push({
                field: 'givenName',
                severity: 'ERROR',
                rule: 'PATIENT_NAME_REQUIRED',
                message: 'Patient must have a first name (Arabic or English).'
            });
        }
        if (data.birthDate) {
            const birth = new Date(data.birthDate);
            if (isNaN(birth.getTime())) {
                issues.push({
                    field: 'birthDate',
                    severity: 'ERROR',
                    rule: 'VALID_DATE',
                    message: `Invalid birth date format: ${data.birthDate}`,
                    sourceValue: data.birthDate
                });
            }
            else if (birth > new Date()) {
                issues.push({
                    field: 'birthDate',
                    severity: 'ERROR',
                    rule: 'BIRTHDATE_NOT_FUTURE',
                    message: 'Birth date cannot be in the future.'
                });
            }
        }
    }
    validateEncounter(data, sourceSystemId, issues) {
        if (!data.sourceVisitId) {
            issues.push({
                field: 'sourceVisitId',
                severity: 'ERROR',
                rule: 'VISIT_ID_REQUIRED',
                message: 'Encounter visit identifier is missing.'
            });
        }
        if (data.period?.start && data.period?.end) {
            const start = new Date(data.period.start);
            const end = new Date(data.period.end);
            if (end < start) {
                issues.push({
                    field: 'period',
                    severity: 'ERROR',
                    rule: 'DISCHARGE_AFTER_ADMISSION',
                    message: `Discharge date (${data.period.end}) cannot precede admission date (${data.period.start}).`
                });
            }
        }
    }
    validateCondition(data, sourceSystemId, issues) {
        if (!data.code || !data.code.sourceCode) {
            issues.push({
                field: 'code',
                severity: 'ERROR',
                rule: 'CONDITION_CODE_REQUIRED',
                message: 'Condition must have a diagnosis code.'
            });
        }
    }
    validateObservation(data, sourceSystemId, issues) {
        if (!data.code || !data.code.sourceCode) {
            issues.push({
                field: 'code',
                severity: 'ERROR',
                rule: 'OBSERVATION_CODE_REQUIRED',
                message: 'Observation must have a test or measurement code.'
            });
        }
        if (data.valueQuantity && typeof data.valueQuantity.value !== 'number') {
            issues.push({
                field: 'valueQuantity.value',
                severity: 'ERROR',
                rule: 'NUMERIC_OBSERVATION_VALUE',
                message: `Observation value must be a valid number. Received: ${data.valueQuantity.value}`
            });
        }
    }
    validateCoverage(data, sourceSystemId, issues) {
        if (!data.policyNumber && !data.sourceRecordId) {
            issues.push({
                field: 'policyNumber',
                severity: 'ERROR',
                rule: 'POLICY_NUMBER_REQUIRED',
                message: 'Insurance coverage must have a valid policy number.'
            });
        }
        if (!data.payerId && !data.payerName) {
            issues.push({
                field: 'payerId',
                severity: 'ERROR',
                rule: 'PAYER_REQUIRED',
                message: 'Insurance coverage must have an insurer license ID or name.'
            });
        }
    }
    validateClaim(data, sourceSystemId, issues) {
        if (!data.sourceRecordId && !data.internalId) {
            issues.push({
                field: 'claimId',
                severity: 'ERROR',
                rule: 'CLAIM_ID_REQUIRED',
                message: 'Claim must have an identifier.'
            });
        }
        if (data.totalGrossSAR !== undefined && data.totalGrossSAR < 0) {
            issues.push({
                field: 'totalGrossSAR',
                severity: 'ERROR',
                rule: 'NON_NEGATIVE_CLAIM_AMOUNT',
                message: 'Claim amount cannot be negative.'
            });
        }
    }
    validateMedicationRequest(data, sourceSystemId, issues) {
        if (!data.medication && !data.medicationCode) {
            issues.push({
                field: 'medication',
                severity: 'ERROR',
                rule: 'MEDICATION_CODE_REQUIRED',
                message: 'Prescription must specify a valid medication code or drug entity.'
            });
        }
    }
    validateImmunization(data, sourceSystemId, issues) {
        if (!data.vaccineCode) {
            issues.push({
                field: 'vaccineCode',
                severity: 'ERROR',
                rule: 'VACCINE_CODE_REQUIRED',
                message: 'Immunization record must have a valid vaccine code.'
            });
        }
        if (!data.lotNumber) {
            issues.push({
                field: 'lotNumber',
                severity: 'WARNING',
                rule: 'VACCINE_LOT_NUMBER_RECOMMENDED',
                message: 'Vaccine lot number is recommended for national immunization tracking.'
            });
        }
    }
    validateAllergyIntolerance(data, sourceSystemId, issues) {
        if (!data.substanceText && !data.substanceCode) {
            issues.push({
                field: 'substance',
                severity: 'ERROR',
                rule: 'ALLERGY_SUBSTANCE_REQUIRED',
                message: 'Allergy record must identify the causative allergen or substance.'
            });
        }
    }
    validateDiagnosticReport(data, sourceSystemId, issues) {
        if (!data.code) {
            issues.push({
                field: 'code',
                severity: 'ERROR',
                rule: 'REPORT_CODE_REQUIRED',
                message: 'Diagnostic report must specify a diagnostic service/panel code.'
            });
        }
    }
}
//# sourceMappingURL=validation-engine.js.map