export class FhirResourceMapper {
    terminologyService;
    transformEngine;
    constructor(terminologyService, transformEngine) {
        this.terminologyService = terminologyService;
        this.transformEngine = transformEngine;
    }
    async map(rawRecord, config) {
        const fhir = rawRecord.payload;
        const mappedData = {};
        if (fhir.resourceType === 'Patient') {
            mappedData.sourceRecordId = fhir.id;
            if (Array.isArray(fhir.identifier)) {
                for (const id of fhir.identifier) {
                    if (id.system?.includes('nid') || id.system?.includes('sa:nid'))
                        mappedData.nationalId = id.value;
                    else if (id.system?.includes('iqama'))
                        mappedData.iqamaNo = id.value;
                    else if (id.system?.includes('mrn') || id.system?.includes('hospital-c'))
                        mappedData.mrn = id.value;
                }
            }
            if (Array.isArray(fhir.name) && fhir.name.length > 0) {
                const arName = fhir.name.find((n) => /[\u0600-\u06FF]/.test(n.family || ''));
                const enName = fhir.name.find((n) => !/[\u0600-\u06FF]/.test(n.family || ''));
                if (arName) {
                    mappedData.familyNameAr = arName.family;
                    mappedData.givenNameAr = Array.isArray(arName.given) ? arName.given.join(' ') : arName.given;
                }
                if (enName) {
                    mappedData.familyName = enName.family;
                    mappedData.givenName = Array.isArray(enName.given) ? enName.given.join(' ') : enName.given;
                }
                else if (arName) {
                    mappedData.familyName = arName.family;
                    mappedData.givenName = Array.isArray(arName.given) ? arName.given.join(' ') : arName.given;
                }
            }
            mappedData.gender = this.transformEngine.transform('gender_normalize', fhir.gender);
            mappedData.birthDate = fhir.birthDate;
            if (Array.isArray(fhir.telecom) && fhir.telecom[0])
                mappedData.phone = fhir.telecom[0].value;
        }
        else if (fhir.resourceType === 'Coverage') {
            mappedData.sourceRecordId = fhir.id;
            mappedData.sourcePatientMrn = fhir.beneficiary?.reference?.replace('Patient/', '');
            mappedData.policyNumber = fhir.id;
            mappedData.memberId = fhir.subscriberId;
            mappedData.payerId = fhir.payor?.[0]?.identifier?.value;
            mappedData.payerName = fhir.payor?.[0]?.display;
            mappedData.networkClass = fhir.class?.[0]?.value;
            mappedData.copayPercentage = fhir.costToBeneficiary?.[0]?.valueQuantity?.value;
            mappedData.copayMaxCapSAR = 100;
            mappedData.period = { start: fhir.period?.start, end: fhir.period?.end };
            mappedData.status = fhir.status || 'active';
        }
        else if (fhir.resourceType === 'Claim') {
            mappedData.sourceRecordId = fhir.id;
            mappedData.sourcePatientMrn = fhir.patient?.reference?.replace('Patient/', '');
            mappedData.claimType = fhir.type?.coding?.[0]?.code;
            mappedData.subType = fhir.subType?.coding?.[0]?.code === 'ip' ? 'inpatient' : 'outpatient';
            mappedData.use = fhir.use || 'claim';
            mappedData.serviceProviderId = fhir.provider?.identifier?.value;
            mappedData.submissionDate = fhir.created || new Date().toISOString();
            const items = Array.isArray(fhir.item) ? fhir.item : [];
            let totalGross = 0;
            let totalNet = 0;
            mappedData.items = items.map((it, idx) => { const gross = it.unitPrice?.value || 0; const net = it.net?.value || gross; const copay = gross - net; totalGross += gross; totalNet += net; return { sequence: it.sequence || idx + 1, serviceCode: { sourceCode: it.productOrService?.coding?.[0]?.code, sbsCode: it.productOrService?.coding?.[0]?.code, sbsDisplay: it.productOrService?.coding?.[0]?.display }, serviceName: it.productOrService?.coding?.[0]?.display, quantity: it.quantity?.value || 1, unitPriceSAR: gross, totalGrossSAR: gross, patientCopaySAR: copay, netClaimedSAR: net }; });
            mappedData.totalGrossSAR = totalGross;
            mappedData.totalPatientCopaySAR = totalGross - totalNet;
            mappedData.totalInsurerClaimedSAR = totalNet;
        }
        else if (fhir.resourceType === 'MedicationRequest') {
            mappedData.sourceRecordId = fhir.id;
            mappedData.sourcePatientMrn = fhir.subject?.reference?.replace('Patient/', '');
            mappedData.sourceVisitId = fhir.encounter?.reference?.replace('Encounter/', '');
            mappedData.status = fhir.status || 'active';
            mappedData.intent = fhir.intent || 'order';
            mappedData.authoredOn = fhir.authoredOn || new Date().toISOString();
            mappedData.requesterPractitionerName = fhir.requester?.display;
            const coding = fhir.medicationCodeableConcept?.coding?.[0];
            if (!coding?.code)
                throw new Error("Missing required field for MedicationRequest: code");
            const resolvedMedCode = await this.terminologyService.resolveCode(coding.code, coding.system || 'sfda', 'MEDICATION');
            mappedData.medication = { internalId: fhir.id, code: resolvedMedCode, status: fhir.status || 'active', form: 'Tablet', strength: undefined, manufacturer: undefined };
            mappedData.dosageInstruction = [{ text: fhir.dosageInstruction?.[0]?.text, timing: { frequency: 2, period: 1, periodUnit: 'd' }, route: 'Oral', doseQuantity: { value: 1, unit: 'TAB' } }];
            mappedData.dispenseRequest = { numberOfRepeatsAllowed: fhir.dispenseRequest?.numberOfRepeatsAllowed ?? 0, quantity: { value: fhir.dispenseRequest?.quantity?.value ?? 1, unit: 'TAB' }, expectedSupplyDurationDays: fhir.dispenseRequest?.expectedSupplyDuration?.value ?? 30 };
        }
        else if (fhir.resourceType === 'Immunization') {
            mappedData.sourceRecordId = fhir.id;
            mappedData.sourcePatientMrn = fhir.patient?.reference?.replace('Patient/', '');
            mappedData.sourceVisitId = fhir.encounter?.reference?.replace('Encounter/', '');
            mappedData.status = fhir.status || 'completed';
            mappedData.occurrenceDateTime = fhir.occurrenceDateTime || new Date().toISOString();
            mappedData.lotNumber = fhir.lotNumber;
            mappedData.expirationDate = fhir.expirationDate;
            mappedData.site = fhir.site?.coding?.[0]?.display;
            const coding = fhir.vaccineCode?.coding?.[0];
            if (!coding?.code)
                throw new Error("Missing required field for Immunization: vaccine code");
            const resolvedVaxCode = await this.terminologyService.resolveCode(coding.code, coding.system || 'cvx', 'VACCINE');
            mappedData.vaccineCode = resolvedVaxCode;
        }
        else if (fhir.resourceType === 'Encounter') {
            mappedData.sourceVisitId = fhir.id;
            mappedData.sourcePatientRef = fhir.subject?.reference?.replace('Patient/', '');
            mappedData.class = fhir.class?.code ? this.transformEngine.transform('encounter_type_map', fhir.class.code) : 'outpatient';
            mappedData.period = { start: fhir.period?.start, end: fhir.period?.end };
            mappedData.status = fhir.status || 'finished';
        }
        else if (fhir.resourceType === 'Condition') {
            mappedData.sourceRecordId = fhir.id;
            mappedData.sourcePatientRef = fhir.subject?.reference?.replace('Patient/', '');
            mappedData.sourceVisitId = fhir.encounter?.reference?.replace('Encounter/', '');
            mappedData.rank = 'primary';
            mappedData.recordedDate = fhir.recordedDate || new Date().toISOString();
            const coding = fhir.code?.coding?.[0];
            if (coding) {
                const resolved = await this.terminologyService.resolveCode(coding.code, coding.system || 'snomed', 'DIAGNOSIS');
                mappedData.code = resolved;
            }
            else
                throw new Error("Missing required field for Condition: code");
            mappedData.note = fhir.code?.text;
        }
        else if (fhir.resourceType === 'Observation') {
            mappedData.sourceRecordId = fhir.id;
            mappedData.sourcePatientRef = fhir.subject?.reference?.replace('Patient/', '');
            mappedData.sourceVisitId = fhir.encounter?.reference?.replace('Encounter/', '');
            mappedData.effectiveDateTime = fhir.effectiveDateTime || new Date().toISOString();
            mappedData.status = fhir.status || 'final';
            const coding = fhir.code?.coding?.[0];
            if (coding) {
                const resolved = await this.terminologyService.resolveCode(coding.code, coding.system || 'loinc', 'LAB_TEST');
                mappedData.code = resolved;
            }
            else
                throw new Error("Missing required field for Observation: code");
            if (fhir.valueQuantity)
                mappedData.valueQuantity = { value: fhir.valueQuantity.value, unit: fhir.valueQuantity.unit || '%' };
        }
        else if (fhir.resourceType === 'AllergyIntolerance') {
            mappedData.sourceRecordId = fhir.id;
            mappedData.sourcePatientMrn = fhir.patient?.reference?.replace('Patient/', '');
            mappedData.clinicalStatus = fhir.clinicalStatus?.coding?.[0]?.code || 'active';
            mappedData.verificationStatus = fhir.verificationStatus?.coding?.[0]?.code || 'confirmed';
            mappedData.type = fhir.type || 'allergy';
            mappedData.category = fhir.category?.[0] || 'medication';
            mappedData.criticality = fhir.criticality || 'high';
            mappedData.recordedDate = fhir.recordedDate || new Date().toISOString();
            const coding = fhir.code?.coding?.[0];
            if (!coding?.code)
                throw new Error("Missing required field for Allergy: code");
            const resolvedSubstance = await this.terminologyService.resolveCode(coding.code, coding.system || 'snomed', 'ALLERGY');
            mappedData.substanceCode = resolvedSubstance;
            mappedData.substanceText = fhir.code?.text;
            mappedData.reactions = [{ manifestationText: fhir.reaction?.[0]?.manifestation?.[0]?.text, severity: fhir.reaction?.[0]?.severity || 'severe' }];
        }
        else if (fhir.resourceType === 'DiagnosticReport') {
            mappedData.sourceRecordId = fhir.id;
            mappedData.sourcePatientMrn = fhir.subject?.reference?.replace('Patient/', '');
            mappedData.sourceVisitId = fhir.encounter?.reference?.replace('Encounter/', '');
            mappedData.status = fhir.status || 'final';
            mappedData.category = fhir.category?.[0]?.coding?.[0]?.code || 'LAB';
            mappedData.issued = fhir.issued || new Date().toISOString();
            mappedData.conclusion = fhir.conclusion;
            const coding = fhir.code?.coding?.[0];
            if (!coding?.code)
                throw new Error("Missing required field for DiagnosticReport: code");
            const resolvedCode = await this.terminologyService.resolveCode(coding.code, coding.system || 'loinc', 'LAB_TEST');
            mappedData.code = resolvedCode;
            mappedData.resultObservationIds = [];
        }
        return { rawRecordId: rawRecord.id, sourceSystemId: rawRecord.sourceSystemId, sourceRecordId: rawRecord.sourceRecordId, targetCanonicalEntity: config.targetCanonicalEntity, mappingConfigId: config.id, mappingVersion: config.mappingVersion, terminologyMapVersion: '1.0.0', data: mappedData, unmappedFields: [] };
    }
}
//# sourceMappingURL=fhir-resource-mapper.js.map