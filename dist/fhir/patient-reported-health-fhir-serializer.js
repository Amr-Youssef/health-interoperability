import { FhirR4Serializer } from './fhir-serializer.js';
/**
 * Extension methods for FHIR serialization of patient-reported health data
 */
export class PatientReportedHealthFhirSerializer extends FhirR4Serializer {
    /**
     * Serialize a patient-reported allergy to FHIR AllergyIntolerance
     */
    serializePatientReportedAllergy(allergy) {
        return {
            resourceType: 'AllergyIntolerance',
            id: allergy.patientId + '-allergy-' + allergy.allergenName.substring(0, 5),
            meta: {
                profile: ['http://hl7.org/fhir/StructureDefinition/AllergyIntolerance'],
                tag: [
                    {
                        system: 'http://sa.nphies.gov/fhir/CodeSystem/source',
                        code: allergy.source,
                        display: 'Patient-Reported',
                    },
                ],
            },
            clinicalStatus: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
                        code: 'active',
                        display: 'Active',
                    },
                ],
            },
            verificationStatus: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
                        code: allergy.verificationStatus === 'VERIFIED' ? 'confirmed' : 'unconfirmed',
                        display: allergy.verificationStatus === 'VERIFIED' ? 'Confirmed' : 'Unconfirmed',
                    },
                ],
                text: allergy.verificationStatus,
            },
            category: ['medication'],
            code: allergy.allergenCode
                ? {
                    coding: [
                        {
                            system: allergy.allergenSystem || 'urn:unresolved',
                            code: allergy.allergenCode,
                            display: allergy.allergenDisplay || allergy.allergenName,
                        },
                    ],
                    text: allergy.allergenName,
                }
                : { text: allergy.allergenName },
            patient: { reference: 'Patient/' + allergy.patientId },
            recordedDate: allergy.recordedAt,
            note: allergy.notes
                ? [
                    {
                        text: allergy.notes + (allergy.isMedicallyDiagnosed ? ' (Patient reports as medically diagnosed)' : ''),
                    },
                ]
                : undefined,
            reaction: allergy.reactionText
                ? [
                    {
                        substance: {
                            text: allergy.allergenName,
                        },
                        manifestation: [
                            {
                                coding: [
                                    {
                                        system: 'http://snomed.info/sct',
                                        display: allergy.reactionText,
                                    },
                                ],
                                text: allergy.reactionText,
                            },
                        ],
                        severity: allergy.reactionSeverity
                            ? allergy.reactionSeverity.toLowerCase() === 'moderate'
                                ? 'moderate'
                                : allergy.reactionSeverity.toLowerCase() === 'severe'
                                    ? 'severe'
                                    : 'mild'
                            : undefined,
                        onset: allergy.onsetDate,
                    },
                ]
                : undefined,
        };
    }
    /**
     * Serialize a patient-reported medication to FHIR MedicationStatement
     */
    serializePatientReportedMedication(medication) {
        return {
            resourceType: 'MedicationStatement',
            id: medication.patientId + '-med-' + medication.medicationName.substring(0, 5),
            meta: {
                profile: ['http://hl7.org/fhir/StructureDefinition/MedicationStatement'],
                tag: [
                    {
                        system: 'http://sa.nphies.gov/fhir/CodeSystem/source',
                        code: medication.source,
                        display: 'Patient-Reported',
                    },
                ],
            },
            status: medication.currentlyTaking ? 'active' : 'stopped',
            category: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/medication-statement-category',
                            code: 'patientreported',
                            display: 'Patient Reported',
                        },
                    ],
                },
            ],
            medicationCodeableConcept: medication.medicationCode
                ? {
                    coding: [
                        {
                            system: medication.medicationSystem || 'urn:unresolved',
                            code: medication.medicationCode,
                            display: medication.medicationDisplay || medication.medicationName,
                        },
                    ],
                    text: medication.medicationName,
                }
                : { text: medication.medicationName },
            subject: { reference: 'Patient/' + medication.patientId },
            effectivePeriod: {
                start: medication.startDate,
                end: medication.endDate,
            },
            dateAsserted: medication.recordedAt,
            dosage: medication.dose || medication.frequency || medication.route ? [
                {
                    text: [medication.dose, medication.frequency, medication.route].filter(Boolean).join(' '),
                    route: medication.route ? { text: medication.route } : undefined,
                },
            ] : undefined,
            note: medication.reasonForUse || medication.notes
                ? [
                    {
                        text: [medication.reasonForUse && `Reason: ${medication.reasonForUse}`, medication.notes].filter(Boolean).join('. '),
                    },
                ]
                : undefined,
        };
    }
    /**
     * Serialize a patient-reported condition to FHIR Condition
     */
    serializePatientReportedCondition(condition) {
        return {
            resourceType: 'Condition',
            id: condition.patientId + '-cond-' + condition.conditionName.substring(0, 5),
            meta: {
                profile: ['http://hl7.org/fhir/StructureDefinition/Condition'],
                tag: [
                    {
                        system: 'http://sa.nphies.gov/fhir/CodeSystem/source',
                        code: condition.source,
                        display: 'Patient-Reported',
                    },
                ],
            },
            clinicalStatus: condition.status
                ? {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                            code: condition.status.toLowerCase(),
                            display: condition.status,
                        },
                    ],
                }
                : undefined,
            verificationStatus: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                        code: condition.verificationStatus === 'VERIFIED' ? 'confirmed' : 'unconfirmed',
                        display: condition.verificationStatus === 'VERIFIED' ? 'Confirmed' : 'Unconfirmed',
                    },
                ],
                text: condition.verificationStatus,
            },
            code: condition.conditionCode
                ? {
                    coding: [
                        {
                            system: condition.conditionSystem || 'urn:unresolved',
                            code: condition.conditionCode,
                            display: condition.conditionDisplay || condition.conditionName,
                        },
                    ],
                    text: condition.conditionName,
                }
                : { text: condition.conditionName },
            subject: { reference: 'Patient/' + condition.patientId },
            onsetDateTime: condition.diagnosisDate,
            recordedDate: condition.recordedAt,
            note: condition.treatingFacility || condition.notes
                ? [
                    {
                        text: [condition.treatingFacility && `Facility: ${condition.treatingFacility}`, condition.notes].filter(Boolean).join('. '),
                    },
                ]
                : undefined,
        };
    }
    /**
     * Serialize a patient-reported procedure to FHIR Procedure
     */
    serializePatientReportedProcedure(procedure) {
        return {
            resourceType: 'Procedure',
            id: procedure.patientId + '-proc-' + procedure.procedureName.substring(0, 5),
            meta: {
                profile: ['http://hl7.org/fhir/StructureDefinition/Procedure'],
                tag: [
                    {
                        system: 'http://sa.nphies.gov/fhir/CodeSystem/source',
                        code: procedure.source,
                        display: 'Patient-Reported',
                    },
                ],
            },
            status: 'completed',
            category: {
                coding: [
                    {
                        system: 'http://snomed.info/sct',
                        display: 'Procedure',
                    },
                ],
            },
            code: procedure.procedureCode
                ? {
                    coding: [
                        {
                            system: procedure.procedureSystem || 'urn:unresolved',
                            code: procedure.procedureCode,
                            display: procedure.procedureDisplay || procedure.procedureName,
                        },
                    ],
                    text: procedure.procedureName,
                }
                : { text: procedure.procedureName },
            subject: { reference: 'Patient/' + procedure.patientId },
            performedDateTime: procedure.procedureDate,
            location: procedure.facilityName
                ? {
                    display: procedure.facilityName,
                }
                : undefined,
            note: procedure.notes
                ? [
                    {
                        text: procedure.notes,
                    },
                ]
                : undefined,
        };
    }
    /**
     * Serialize family member history to FHIR FamilyMemberHistory
     */
    serializePatientFamilyMember(member) {
        return {
            resourceType: 'FamilyMemberHistory',
            id: member.patientId + '-fhx-' + member.relationship,
            meta: {
                profile: ['http://hl7.org/fhir/StructureDefinition/FamilyMemberHistory'],
                tag: [
                    {
                        system: 'http://sa.nphies.gov/fhir/CodeSystem/source',
                        code: member.source,
                        display: 'Patient-Reported',
                    },
                ],
            },
            status: 'completed',
            patient: { reference: 'Patient/' + member.patientId },
            relationship: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/v3-FamilyMember',
                        code: this.mapFamilyRelationshipToFhir(member.relationship),
                        display: member.relationship,
                    },
                ],
            },
            name: member.relativeName,
            condition: member.conditionName
                ? [
                    {
                        code: member.conditionCode
                            ? {
                                coding: [
                                    {
                                        system: member.conditionSystem || 'urn:unresolved',
                                        code: member.conditionCode,
                                        display: member.conditionDisplay || member.conditionName,
                                    },
                                ],
                                text: member.conditionName,
                            }
                            : { text: member.conditionName },
                        onsetDateTime: member.onsetDate,
                    },
                ]
                : undefined,
            note: member.notes
                ? [
                    {
                        text: member.notes,
                    },
                ]
                : undefined,
        };
    }
    /**
     * Serialize a patient-reported vital observation to FHIR Observation
     */
    serializePatientReportedVitalObservation(vital) {
        const loincCode = this.getLoincCodeForObservationType(vital.observationType);
        return {
            resourceType: 'Observation',
            id: vital.patientId + '-vital-' + vital.observationType,
            meta: {
                profile: ['http://hl7.org/fhir/StructureDefinition/Observation'],
                tag: [
                    {
                        system: 'http://sa.nphies.gov/fhir/CodeSystem/source',
                        code: vital.source,
                        display: 'Patient-Reported',
                    },
                ],
            },
            status: 'final',
            category: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                            code: 'vital-signs',
                            display: 'Vital Signs',
                        },
                    ],
                },
            ],
            code: {
                coding: [
                    {
                        system: 'http://loinc.org',
                        code: vital.observationCode || loincCode,
                        display: vital.observationDisplay || vital.observationType,
                    },
                ],
                text: vital.observationType,
            },
            subject: { reference: 'Patient/' + vital.patientId },
            effectiveDateTime: vital.recordedAt,
            valueQuantity: vital.valueQuantity
                ? {
                    value: vital.valueQuantity,
                    unit: vital.valueUnit,
                    system: 'http://unitsofmeasure.org',
                    code: this.getUcumCode(vital.valueUnit),
                }
                : undefined,
            valueString: vital.valueText,
            component: vital.observationType === 'BLOOD_PRESSURE' && (vital.systolic || vital.diastolic)
                ? [
                    vital.systolic
                        ? {
                            code: {
                                coding: [
                                    {
                                        system: 'http://loinc.org',
                                        code: '8480-6',
                                        display: 'Systolic blood pressure',
                                    },
                                ],
                            },
                            valueQuantity: {
                                value: vital.systolic,
                                unit: 'mmHg',
                                system: 'http://unitsofmeasure.org',
                                code: 'mm[Hg]',
                            },
                        }
                        : undefined,
                    vital.diastolic
                        ? {
                            code: {
                                coding: [
                                    {
                                        system: 'http://loinc.org',
                                        code: '8462-4',
                                        display: 'Diastolic blood pressure',
                                    },
                                ],
                            },
                            valueQuantity: {
                                value: vital.diastolic,
                                unit: 'mmHg',
                                system: 'http://unitsofmeasure.org',
                                code: 'mm[Hg]',
                            },
                        }
                        : undefined,
                ].filter(Boolean)
                : undefined,
            device: vital.deviceName
                ? {
                    display: [vital.deviceManufacturer, vital.deviceModel, vital.deviceName].filter(Boolean).join(' '),
                    identifier: vital.deviceIdentifier ? { value: vital.deviceIdentifier } : undefined,
                }
                : undefined,
            note: vital.measurementNotes
                ? [
                    {
                        text: vital.measurementNotes + (vital.measurementMethod === 'MANUAL_ENTRY' ? ' (Manual entry)' : ' (Device)'),
                    },
                ]
                : undefined,
        };
    }
    // Helper methods
    mapFamilyRelationshipToFhir(relationship) {
        const mapping = {
            MOTHER: 'MTH',
            FATHER: 'FTH',
            SIBLING: 'SIB',
            CHILD: 'CHILD',
            GRANDPARENT: 'GPARNT',
            AUNT: 'AUNT',
            UNCLE: 'UNCLE',
            COUSIN: 'COUSN',
        };
        return mapping[relationship] || 'FAMMEMB';
    }
    getLoincCodeForObservationType(observationType) {
        const mapping = {
            BLOOD_PRESSURE: '85354-9',
            HEART_RATE: '8867-4',
            TEMPERATURE: '8310-5',
            WEIGHT: '29463-7',
            HEIGHT: '8302-2',
            SPO2: '2708-6',
            BLOOD_GLUCOSE: '2345-7',
        };
        return mapping[observationType] || '00000-0';
    }
    getUcumCode(unit) {
        if (!unit)
            return '';
        const mapping = {
            'mmHg': 'mm[Hg]',
            'bpm': '/min',
            'C': 'Cel',
            'F': '[degF]',
            'kg': 'kg',
            'cm': 'cm',
            '%': '%',
            'mg/dL': 'mg/dL',
        };
        return mapping[unit] || unit;
    }
}
//# sourceMappingURL=patient-reported-health-fhir-serializer.js.map