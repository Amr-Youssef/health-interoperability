import { TransformEngine } from '../transformation/transform-engine.js';
import { DEFAULT_MAPPINGS } from '../config/mapping-registry.js';
export class MappingEngine {
    configurations = new Map();
    transformEngine;
    terminologyService;
    constructor(terminologyService, transformEngine) {
        this.terminologyService = terminologyService;
        this.transformEngine = transformEngine || new TransformEngine();
        this.loadDefaultConfigurations();
    }
    loadDefaultConfigurations() {
        for (const config of DEFAULT_MAPPINGS) {
            const key = `${config.sourceSystemId}:${config.sourceEntityType.toLowerCase()}`;
            this.configurations.set(key, config);
        }
    }
    registerConfiguration(config) {
        const key = `${config.sourceSystemId}:${config.sourceEntityType.toLowerCase()}`;
        this.configurations.set(key, config);
    }
    getConfiguration(sourceSystemId, sourceEntityType) {
        const key = `${sourceSystemId}:${sourceEntityType.toLowerCase()}`;
        return this.configurations.get(key) || null;
    }
    getAllConfigurations() {
        return Array.from(this.configurations.values());
    }
    setNestedProperty(obj, path, value) {
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }
        current[parts[parts.length - 1]] = value;
    }
    /**
     * Executes the 3-stage Mapping Pipeline on a raw record
     */
    async mapRecord(rawRecord) {
        const config = this.getConfiguration(rawRecord.sourceSystemId, rawRecord.sourceEntityType);
        if (!config) {
            throw new Error(`No active MappingConfiguration found for [${rawRecord.sourceSystemId}:${rawRecord.sourceEntityType}]`);
        }
        const payload = rawRecord.payload;
        const mappedData = {};
        const mappedSourceKeys = new Set();
        // Special handler for FHIR source (Hospital C)
        if (rawRecord.payloadFormat === 'fhir-resource' || rawRecord.sourceSystemId === 'hospital-c') {
            return this.mapFhirResource(rawRecord, config);
        }
        // Process each field mapping rule
        for (const rule of config.fieldMappings) {
            const rawValue = rule.sourceField.includes('.')
                ? rule.sourceField.split('.').reduce((o, k) => o?.[k], payload)
                : payload[rule.sourceField];
            mappedSourceKeys.add(rule.sourceField);
            let transformedValue = rawValue;
            // Stage 2: Transformation Engine
            if (rule.transformation && rawValue !== undefined) {
                transformedValue = this.transformEngine.transform(rule.transformation, rawValue, rule.transformParams);
            }
            else if (rawValue === undefined && rule.defaultValue !== undefined) {
                transformedValue = rule.defaultValue;
            }
            // Stage 3: Terminology Mapping
            if (rule.terminologyMapId && rawValue !== undefined) {
                const domain = config.targetCanonicalEntity === 'CanonicalCondition' ? 'DIAGNOSIS' :
                    config.targetCanonicalEntity === 'CanonicalObservation' ? 'LAB_TEST' :
                        config.targetCanonicalEntity === 'CanonicalMedicationRequest' ? 'MEDICATION' :
                            config.targetCanonicalEntity === 'CanonicalImmunization' ? 'VACCINE' : undefined;
                const clinicalCode = await this.terminologyService.resolveCode(String(rawValue), rawRecord.sourceSystemId, domain);
                this.setNestedProperty(mappedData, rule.targetField, clinicalCode);
                continue;
            }
            if (transformedValue !== undefined) {
                this.setNestedProperty(mappedData, rule.targetField, transformedValue);
            }
        }
        // Post-processing for MedicationRequest
        if (config.targetCanonicalEntity === 'CanonicalMedicationRequest') {
            const rawMedCode = payload.كود_الدواء || payload.drug_code;
            if (!rawMedCode)
                throw new Error("Missing required field for MedicationRequest: drug code");
            const resolvedMedCode = await this.terminologyService.resolveCode(rawMedCode, rawRecord.sourceSystemId, 'MEDICATION');
            mappedData.medication = {
                internalId: rawRecord.sourceRecordId,
                code: resolvedMedCode,
                status: payload.status,
                form: payload.form,
                strength: payload.strength,
                manufacturer: payload.manufacturer
            };
            const sigText = payload.sig || payload.طريقة_الاستخدام;
            if (sigText) {
                mappedData.dosageInstruction = [
                    {
                        text: sigText,
                        textAr: payload.طريقة_الاستخدام,
                        timing: {
                            frequency: payload.frequency,
                            period: payload.period,
                            periodUnit: payload.periodUnit
                        },
                        route: payload.route,
                        doseQuantity: { value: Number(payload.الكمية || payload.qty), unit: payload.unit }
                    }
                ];
            }
            mappedData.dispenseRequest = {
                numberOfRepeatsAllowed: Number(payload.التكرار_المسموح || payload.refills || 0),
                quantity: { value: Number(payload.الكمية || payload.qty), unit: payload.unit },
                expectedSupplyDurationDays: payload.supplyDays
            };
            mappedData.status = payload.status;
            mappedData.intent = payload.intent;
        }
        // Post-processing for Immunization
        if (config.targetCanonicalEntity === 'CanonicalImmunization') {
            const rawVaxCode = payload.كود_اللقاح || payload.vax_code;
            if (!rawVaxCode)
                throw new Error("Missing required field for Immunization: vaccine code");
            const resolvedVaxCode = await this.terminologyService.resolveCode(rawVaxCode, rawRecord.sourceSystemId, 'VACCINE');
            mappedData.vaccineCode = resolvedVaxCode;
            mappedData.lotNumber = payload.رقم_التشغيلة || payload.lot_no;
            mappedData.expirationDate = mappedData.expirationDate;
            mappedData.occurrenceDateTime = mappedData.occurrenceDateTime || payload.occurrenceDateTime;
            if (!mappedData.occurrenceDateTime)
                throw new Error("Missing required field for Immunization: occurrenceDateTime");
            mappedData.status = payload.status;
            mappedData.site = payload.مكان_الحقن || payload.admin_site;
            mappedData.route = payload.route;
        }
        // Post-processing for Allergy
        if (config.targetCanonicalEntity === 'CanonicalAllergyIntolerance') {
            const rawSubstance = payload.المادة_المسببة || payload.allergen || payload.substance;
            if (!rawSubstance)
                throw new Error("Missing required field for Allergy: substance");
            const resolvedSubstanceCode = await this.terminologyService.resolveCode(rawSubstance, rawRecord.sourceSystemId, 'ALLERGY');
            mappedData.substanceCode = resolvedSubstanceCode;
            mappedData.substanceText = payload.allergen || payload.المادة_المسببة;
            mappedData.substanceTextAr = payload.المادة_المسببة;
            mappedData.clinicalStatus = payload.clinicalStatus;
            mappedData.verificationStatus = payload.verificationStatus;
            mappedData.type = payload.type;
            mappedData.category = payload.category;
            mappedData.criticality = payload.criticality || (payload.درجة_الخطورة === 'شديدة' ? 'high' : undefined);
            mappedData.recordedDate = mappedData.recordedDate || payload.recordedDate;
            const reactionText = payload.التفاعل_التحسسي || payload.reaction_desc || payload.reactionText;
            if (reactionText) {
                mappedData.reactions = [
                    {
                        manifestationText: reactionText,
                        manifestationTextAr: reactionText,
                        manifestationCode: {
                            snomedCode: reactionText.toLowerCase().includes('rash') ? '271807003' : '39579001',
                            snomedDisplay: reactionText.toLowerCase().includes('rash') ? 'Skin eruption' : 'Anaphylaxis',
                            sourceCode: 'REACTION-01',
                            sourceDisplay: reactionText
                        },
                        severity: mappedData.criticality === 'high' ? 'severe' : 'moderate'
                    }
                ];
            }
        }
        // Special handling for Claim / Bill items
        if (config.targetCanonicalEntity === 'CanonicalClaim') {
            mappedData.sourceRecordId = rawRecord.sourceRecordId;
            mappedData.serviceProviderId = rawRecord.sourceSystemId;
            const rawServiceCode = payload.كود_الخدمة || payload.service_code;
            if (!rawServiceCode)
                throw new Error("Missing required field for Claim: service code");
            const serviceName = payload.اسم_الخدمة || payload.service_desc;
            const gross = mappedData.totalGrossSAR !== undefined ? mappedData.totalGrossSAR : payload.gross;
            const copay = mappedData.patientCopaySAR !== undefined ? mappedData.patientCopaySAR : payload.copay;
            if (gross === undefined || copay === undefined)
                throw new Error("Missing required fields for Claim: gross and copay amounts");
            const net = mappedData.netClaimedSAR !== undefined ? mappedData.netClaimedSAR : payload.net !== undefined ? payload.net : (gross - copay);
            mappedData.items = [
                {
                    sequence: 1,
                    serviceCode: {
                        sourceCode: rawServiceCode,
                        sourceSystem: `urn:${rawRecord.sourceSystemId}:services`,
                        sbsCode: rawServiceCode,
                        sbsDisplay: serviceName
                    },
                    serviceName,
                    quantity: payload.qty,
                    unitPriceSAR: gross,
                    totalGrossSAR: gross,
                    patientCopaySAR: copay,
                    netClaimedSAR: net,
                    patientInvoiceNo: rawRecord.sourceRecordId
                }
            ];
            mappedData.totalGrossSAR = gross;
            mappedData.totalPatientCopaySAR = copay;
            mappedData.totalInsurerClaimedSAR = net;
        }
        const unmappedFields = Object.keys(payload).filter(k => !mappedSourceKeys.has(k));
        return {
            rawRecordId: rawRecord.id,
            sourceSystemId: rawRecord.sourceSystemId,
            sourceRecordId: rawRecord.sourceRecordId,
            targetCanonicalEntity: config.targetCanonicalEntity,
            mappingConfigId: config.id,
            mappingVersion: config.mappingVersion,
            terminologyMapVersion: '1.0.0',
            data: mappedData,
            unmappedFields
        };
    }
    /**
     * Normalizes standard FHIR R4 resources from Hospital C into Canonical domain representation
     */
    async mapFhirResource(rawRecord, config) {
        const fhir = rawRecord.payload;
        const mappedData = {};
        if (fhir.resourceType === 'Patient') {
            mappedData.sourceRecordId = fhir.id;
            if (Array.isArray(fhir.identifier)) {
                for (const id of fhir.identifier) {
                    if (id.system?.includes('nid') || id.system?.includes('sa:nid')) {
                        mappedData.nationalId = id.value;
                    }
                    else if (id.system?.includes('iqama')) {
                        mappedData.iqamaNo = id.value;
                    }
                    else if (id.system?.includes('mrn') || id.system?.includes('hospital-c')) {
                        mappedData.mrn = id.value;
                    }
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
            if (Array.isArray(fhir.telecom) && fhir.telecom[0]) {
                mappedData.phone = fhir.telecom[0].value;
            }
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
            mappedData.period = {
                start: fhir.period?.start,
                end: fhir.period?.end
            };
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
            mappedData.items = items.map((it, idx) => {
                const gross = it.unitPrice?.value || 0;
                const net = it.net?.value || gross;
                const copay = gross - net;
                totalGross += gross;
                totalNet += net;
                return {
                    sequence: it.sequence || idx + 1,
                    serviceCode: {
                        sourceCode: it.productOrService?.coding?.[0]?.code,
                        sbsCode: it.productOrService?.coding?.[0]?.code,
                        sbsDisplay: it.productOrService?.coding?.[0]?.display
                    },
                    serviceName: it.productOrService?.coding?.[0]?.display,
                    quantity: it.quantity?.value || 1,
                    unitPriceSAR: gross,
                    totalGrossSAR: gross,
                    patientCopaySAR: copay,
                    netClaimedSAR: net
                };
            });
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
            mappedData.medication = {
                internalId: fhir.id,
                code: resolvedMedCode,
                status: fhir.status || 'active',
                form: 'Tablet',
                strength: undefined,
                manufacturer: undefined
            };
            mappedData.dosageInstruction = [
                {
                    text: fhir.dosageInstruction?.[0]?.text,
                    timing: { frequency: 2, period: 1, periodUnit: 'd' },
                    route: 'Oral',
                    doseQuantity: { value: 1, unit: 'TAB' }
                }
            ];
            mappedData.dispenseRequest = {
                numberOfRepeatsAllowed: fhir.dispenseRequest?.numberOfRepeatsAllowed ?? 0,
                quantity: { value: fhir.dispenseRequest?.quantity?.value ?? 1, unit: 'TAB' },
                expectedSupplyDurationDays: fhir.dispenseRequest?.expectedSupplyDuration?.value ?? 30
            };
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
            mappedData.period = {
                start: fhir.period?.start,
                end: fhir.period?.end
            };
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
            else {
                throw new Error("Missing required field for Condition: code");
            }
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
            else {
                throw new Error("Missing required field for Observation: code");
            }
            if (fhir.valueQuantity) {
                mappedData.valueQuantity = {
                    value: fhir.valueQuantity.value,
                    unit: fhir.valueQuantity.unit || '%'
                };
            }
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
            mappedData.reactions = [
                {
                    manifestationText: fhir.reaction?.[0]?.manifestation?.[0]?.text,
                    severity: fhir.reaction?.[0]?.severity || 'severe'
                }
            ];
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
        return {
            rawRecordId: rawRecord.id,
            sourceSystemId: rawRecord.sourceSystemId,
            sourceRecordId: rawRecord.sourceRecordId,
            targetCanonicalEntity: config.targetCanonicalEntity,
            mappingConfigId: config.id,
            mappingVersion: config.mappingVersion,
            terminologyMapVersion: '1.0.0',
            data: mappedData,
            unmappedFields: []
        };
    }
}
//# sourceMappingURL=mapping-engine.js.map