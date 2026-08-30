export const HOSPITAL_C_DATASET = {
    resources: [
        // Patient
        {
            resourceType: 'Patient',
            id: 'hc-pat-5567',
            identifier: [
                {
                    system: 'urn:hospital-c:mrn',
                    value: 'HC-5567'
                },
                {
                    system: 'urn:sa:nid',
                    value: '1088445566'
                }
            ],
            name: [
                {
                    use: 'official',
                    family: 'الراشدي',
                    given: ['أحمد']
                },
                {
                    use: 'official',
                    family: 'Al-Rashidi',
                    given: ['Ahmed']
                }
            ],
            gender: 'male',
            birthDate: '1984-04-01',
            telecom: [
                {
                    system: 'phone',
                    value: '+966501234567'
                }
            ]
        },
        // Coverage (Insurance Policy)
        {
            resourceType: 'Coverage',
            id: 'hc-cov-8801',
            status: 'active',
            type: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                        code: 'HIP',
                        display: 'health insurance plan'
                    }
                ]
            },
            subscriberId: 'MEM-BUPA-992381',
            beneficiary: {
                reference: 'Patient/hc-pat-5567'
            },
            payor: [
                {
                    identifier: {
                        system: 'http://nphies.sa/license/payer-license',
                        value: 'CHI-INS-101'
                    },
                    display: 'Bupa Arabia'
                }
            ],
            class: [
                {
                    type: {
                        coding: [
                            {
                                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                                code: 'plan'
                            }
                        ]
                    },
                    value: 'Class-A',
                    name: 'Class A Comprehensive Network'
                }
            ],
            costToBeneficiary: [
                {
                    type: {
                        coding: [
                            {
                                system: 'http://terminology.hl7.org/CodeSystem/coverage-copay-type',
                                code: 'copaypct',
                                display: 'Copayment Percentage'
                            }
                        ]
                    },
                    valueQuantity: {
                        value: 20,
                        unit: '%'
                    }
                }
            ]
        },
        // Encounter
        {
            resourceType: 'Encounter',
            id: 'hc-enc-1102',
            status: 'finished',
            class: {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                code: 'AMB',
                display: 'ambulatory'
            },
            subject: {
                reference: 'Patient/hc-pat-5567'
            },
            period: {
                start: '2026-08-25T11:00:00Z',
                end: '2026-08-25T11:45:00Z'
            },
            serviceProvider: {
                display: 'King Fahd Specialist Center'
            }
        },
        // Condition
        {
            resourceType: 'Condition',
            id: 'hc-cond-883',
            clinicalStatus: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                        code: 'active'
                    }
                ]
            },
            category: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
                            code: 'encounter-diagnosis'
                        }
                    ]
                }
            ],
            code: {
                coding: [
                    {
                        system: 'http://snomed.info/sct',
                        code: '44054006',
                        display: 'Type 2 diabetes mellitus'
                    }
                ],
                text: 'Type 2 diabetes mellitus'
            },
            subject: {
                reference: 'Patient/hc-pat-5567'
            },
            encounter: {
                reference: 'Encounter/hc-enc-1102'
            },
            recordedDate: '2026-08-25T11:15:00Z'
        },
        // Observation (Lab Result)
        {
            resourceType: 'Observation',
            id: 'hc-obs-991',
            status: 'final',
            category: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                            code: 'laboratory'
                        }
                    ]
                }
            ],
            code: {
                coding: [
                    {
                        system: 'http://loinc.org',
                        code: '4548-4',
                        display: 'Hemoglobin A1c/Hemoglobin.total in Blood'
                    }
                ],
                text: 'HbA1c Lab Panel'
            },
            subject: {
                reference: 'Patient/hc-pat-5567'
            },
            encounter: {
                reference: 'Encounter/hc-enc-1102'
            },
            effectiveDateTime: '2026-08-25T11:30:00Z',
            valueQuantity: {
                value: 7.2,
                unit: '%',
                system: 'http://unitsofmeasure.org',
                code: '%'
            },
            referenceRange: [
                {
                    low: { value: 4.0, unit: '%' },
                    high: { value: 5.6, unit: '%' }
                }
            ],
            interpretation: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                            code: 'H',
                            display: 'High'
                        }
                    ]
                }
            ]
        },
        // Claim (NPHIES-ready FHIR Claim)
        {
            resourceType: 'Claim',
            id: 'hc-clm-3310',
            status: 'active',
            type: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/claim-type',
                        code: 'professional'
                    }
                ]
            },
            subType: {
                coding: [
                    {
                        system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
                        code: 'op',
                        display: 'Outpatient'
                    }
                ]
            },
            use: 'claim',
            patient: {
                reference: 'Patient/hc-pat-5567'
            },
            created: '2026-08-25T12:00:00Z',
            provider: {
                identifier: {
                    system: 'http://nphies.sa/license/provider-license',
                    value: 'HOSP-KFSC-01'
                },
                display: 'King Fahd Specialist Center'
            },
            priority: {
                coding: [{ code: 'normal' }]
            },
            insurance: [
                {
                    sequence: 1,
                    focal: true,
                    coverage: {
                        reference: 'Coverage/hc-cov-8801'
                    }
                }
            ],
            diagnosis: [
                {
                    sequence: 1,
                    diagnosisCodeableConcept: {
                        coding: [
                            {
                                system: 'urn:sa:nhic:icd-10-am',
                                code: 'E11',
                                display: 'Type 2 diabetes mellitus'
                            },
                            {
                                system: 'urn:sa:chi:sbs',
                                code: 'SBS-E11'
                            }
                        ]
                    }
                }
            ],
            item: [
                {
                    sequence: 1,
                    productOrService: {
                        coding: [
                            {
                                system: 'urn:sa:chi:sbs',
                                code: 'SBS-E11',
                                display: 'Specialist Medical Consultation'
                            }
                        ]
                    },
                    unitPrice: { value: 300.0, currency: 'SAR' },
                    net: { value: 240.0, currency: 'SAR' }
                },
                {
                    sequence: 2,
                    productOrService: {
                        coding: [
                            {
                                system: 'urn:sa:chi:sbs:lab',
                                code: 'SBS-LAB-1020',
                                display: 'HbA1c Lab Test'
                            }
                        ]
                    },
                    unitPrice: { value: 150.0, currency: 'SAR' },
                    net: { value: 120.0, currency: 'SAR' }
                }
            ],
            total: {
                value: 360.0,
                currency: 'SAR'
            }
        },
        // MedicationRequest (ePrescription with SFDA SDC Code)
        {
            resourceType: 'MedicationRequest',
            id: 'hc-med-7701',
            status: 'active',
            intent: 'order',
            medicationCodeableConcept: {
                coding: [
                    {
                        system: 'http://sfda.gov.sa/sdc',
                        code: '0628500100101',
                        display: 'Glucophage 500mg Film-Coated Tablets'
                    },
                    {
                        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                        code: '860975',
                        display: 'Metformin hydrochloride 500 MG Oral Tablet'
                    }
                ],
                text: 'Metformin HCl 500mg'
            },
            subject: {
                reference: 'Patient/hc-pat-5567'
            },
            encounter: {
                reference: 'Encounter/hc-enc-1102'
            },
            authoredOn: '2026-08-25T11:40:00Z',
            requester: {
                display: 'Dr. Tariq Al-Ghamdi (SCFHS-9021)'
            },
            dosageInstruction: [
                {
                    text: 'One tablet by mouth twice daily with meals',
                    timing: {
                        repeat: {
                            frequency: 2,
                            period: 1,
                            periodUnit: 'd'
                        }
                    },
                    route: {
                        coding: [
                            {
                                system: 'http://standardterms.edqm.eu',
                                code: '20053000',
                                display: 'Oral use'
                            }
                        ]
                    },
                    doseAndRate: [
                        {
                            doseQuantity: {
                                value: 1,
                                unit: 'TAB'
                            }
                        }
                    ]
                }
            ],
            dispenseRequest: {
                numberOfRepeatsAllowed: 2,
                quantity: {
                    value: 60,
                    unit: 'TAB'
                },
                expectedSupplyDuration: {
                    value: 30,
                    unit: 'd'
                }
            }
        },
        // Immunization (Vaccine)
        {
            resourceType: 'Immunization',
            id: 'hc-vax-4401',
            status: 'completed',
            vaccineCode: {
                coding: [
                    {
                        system: 'http://hl7.org/fhir/sid/cvx',
                        code: '158',
                        display: 'influenza, injectable, quadrivalent'
                    },
                    {
                        system: 'urn:sa:moh:vaccines',
                        code: 'SA-VAX-FLU-01',
                        display: 'Quadrivalent Influenza Vaccine'
                    }
                ],
                text: 'Seasonal Influenza Vaccine'
            },
            patient: {
                reference: 'Patient/hc-pat-5567'
            },
            encounter: {
                reference: 'Encounter/hc-enc-1102'
            },
            occurrenceDateTime: '2026-08-25T11:45:00Z',
            lotNumber: 'LOT-KFSC-FLU26',
            expirationDate: '2026-12-31',
            site: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ActSite',
                        code: 'LA',
                        display: 'left arm'
                    }
                ]
            }
        },
        // AllergyIntolerance
        {
            resourceType: 'AllergyIntolerance',
            id: 'hc-alg-101',
            clinicalStatus: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
                        code: 'active'
                    }
                ]
            },
            verificationStatus: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
                        code: 'confirmed'
                    }
                ]
            },
            type: 'allergy',
            category: ['medication'],
            criticality: 'high',
            code: {
                coding: [
                    {
                        system: 'http://snomed.info/sct',
                        code: '764146007',
                        display: 'Penicillin'
                    }
                ],
                text: 'Penicillin G / Beta-lactam Allergy'
            },
            patient: {
                reference: 'Patient/hc-pat-5567'
            },
            recordedDate: '2025-05-10T10:00:00Z',
            reaction: [
                {
                    manifestation: [
                        {
                            coding: [
                                {
                                    system: 'http://snomed.info/sct',
                                    code: '39579001',
                                    display: 'Anaphylaxis'
                                }
                            ],
                            text: 'Acute anaphylactic reaction and bronchospasm'
                        }
                    ],
                    severity: 'severe'
                }
            ]
        },
        // DiagnosticReport
        {
            resourceType: 'DiagnosticReport',
            id: 'hc-diag-8801',
            status: 'final',
            category: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                            code: 'LAB',
                            display: 'Laboratory'
                        }
                    ]
                }
            ],
            code: {
                coding: [
                    {
                        system: 'http://loinc.org',
                        code: '24323-8',
                        display: 'Comprehensive Metabolic 2000 Panel'
                    }
                ],
                text: 'Comprehensive Glycemic & Metabolic Assessment Panel'
            },
            subject: {
                reference: 'Patient/hc-pat-5567'
            },
            encounter: {
                reference: 'Encounter/hc-enc-1102'
            },
            issued: '2026-08-25T12:00:00Z',
            conclusion: 'Elevated Glycated Hemoglobin (HbA1c 7.2%) indicative of Type 2 Diabetes Mellitus with sub-optimal glycemic control.'
        }
    ]
};
//# sourceMappingURL=hospital-c-data.js.map