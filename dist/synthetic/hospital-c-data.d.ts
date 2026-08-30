export declare const HOSPITAL_C_DATASET: {
    resources: ({
        resourceType: string;
        id: string;
        identifier: {
            system: string;
            value: string;
        }[];
        name: {
            use: string;
            family: string;
            given: string[];
        }[];
        gender: string;
        birthDate: string;
        telecom: {
            system: string;
            value: string;
        }[];
        status?: undefined;
        type?: undefined;
        subscriberId?: undefined;
        beneficiary?: undefined;
        payor?: undefined;
        class?: undefined;
        costToBeneficiary?: undefined;
        subject?: undefined;
        period?: undefined;
        serviceProvider?: undefined;
        clinicalStatus?: undefined;
        category?: undefined;
        code?: undefined;
        encounter?: undefined;
        recordedDate?: undefined;
        effectiveDateTime?: undefined;
        valueQuantity?: undefined;
        referenceRange?: undefined;
        interpretation?: undefined;
        subType?: undefined;
        use?: undefined;
        patient?: undefined;
        created?: undefined;
        provider?: undefined;
        priority?: undefined;
        insurance?: undefined;
        diagnosis?: undefined;
        item?: undefined;
        total?: undefined;
        intent?: undefined;
        medicationCodeableConcept?: undefined;
        authoredOn?: undefined;
        requester?: undefined;
        dosageInstruction?: undefined;
        dispenseRequest?: undefined;
        vaccineCode?: undefined;
        occurrenceDateTime?: undefined;
        lotNumber?: undefined;
        expirationDate?: undefined;
        site?: undefined;
        verificationStatus?: undefined;
        criticality?: undefined;
        reaction?: undefined;
        issued?: undefined;
        conclusion?: undefined;
    } | {
        resourceType: string;
        id: string;
        status: string;
        type: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
        };
        subscriberId: string;
        beneficiary: {
            reference: string;
        };
        payor: {
            identifier: {
                system: string;
                value: string;
            };
            display: string;
        }[];
        class: {
            type: {
                coding: {
                    system: string;
                    code: string;
                }[];
            };
            value: string;
            name: string;
        }[];
        costToBeneficiary: {
            type: {
                coding: {
                    system: string;
                    code: string;
                    display: string;
                }[];
            };
            valueQuantity: {
                value: number;
                unit: string;
            };
        }[];
        identifier?: undefined;
        name?: undefined;
        gender?: undefined;
        birthDate?: undefined;
        telecom?: undefined;
        subject?: undefined;
        period?: undefined;
        serviceProvider?: undefined;
        clinicalStatus?: undefined;
        category?: undefined;
        code?: undefined;
        encounter?: undefined;
        recordedDate?: undefined;
        effectiveDateTime?: undefined;
        valueQuantity?: undefined;
        referenceRange?: undefined;
        interpretation?: undefined;
        subType?: undefined;
        use?: undefined;
        patient?: undefined;
        created?: undefined;
        provider?: undefined;
        priority?: undefined;
        insurance?: undefined;
        diagnosis?: undefined;
        item?: undefined;
        total?: undefined;
        intent?: undefined;
        medicationCodeableConcept?: undefined;
        authoredOn?: undefined;
        requester?: undefined;
        dosageInstruction?: undefined;
        dispenseRequest?: undefined;
        vaccineCode?: undefined;
        occurrenceDateTime?: undefined;
        lotNumber?: undefined;
        expirationDate?: undefined;
        site?: undefined;
        verificationStatus?: undefined;
        criticality?: undefined;
        reaction?: undefined;
        issued?: undefined;
        conclusion?: undefined;
    } | {
        resourceType: string;
        id: string;
        status: string;
        class: {
            system: string;
            code: string;
            display: string;
        };
        subject: {
            reference: string;
        };
        period: {
            start: string;
            end: string;
        };
        serviceProvider: {
            display: string;
        };
        identifier?: undefined;
        name?: undefined;
        gender?: undefined;
        birthDate?: undefined;
        telecom?: undefined;
        type?: undefined;
        subscriberId?: undefined;
        beneficiary?: undefined;
        payor?: undefined;
        costToBeneficiary?: undefined;
        clinicalStatus?: undefined;
        category?: undefined;
        code?: undefined;
        encounter?: undefined;
        recordedDate?: undefined;
        effectiveDateTime?: undefined;
        valueQuantity?: undefined;
        referenceRange?: undefined;
        interpretation?: undefined;
        subType?: undefined;
        use?: undefined;
        patient?: undefined;
        created?: undefined;
        provider?: undefined;
        priority?: undefined;
        insurance?: undefined;
        diagnosis?: undefined;
        item?: undefined;
        total?: undefined;
        intent?: undefined;
        medicationCodeableConcept?: undefined;
        authoredOn?: undefined;
        requester?: undefined;
        dosageInstruction?: undefined;
        dispenseRequest?: undefined;
        vaccineCode?: undefined;
        occurrenceDateTime?: undefined;
        lotNumber?: undefined;
        expirationDate?: undefined;
        site?: undefined;
        verificationStatus?: undefined;
        criticality?: undefined;
        reaction?: undefined;
        issued?: undefined;
        conclusion?: undefined;
    } | {
        resourceType: string;
        id: string;
        clinicalStatus: {
            coding: {
                system: string;
                code: string;
            }[];
        };
        category: {
            coding: {
                system: string;
                code: string;
            }[];
        }[];
        code: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
            text: string;
        };
        subject: {
            reference: string;
        };
        encounter: {
            reference: string;
        };
        recordedDate: string;
        identifier?: undefined;
        name?: undefined;
        gender?: undefined;
        birthDate?: undefined;
        telecom?: undefined;
        status?: undefined;
        type?: undefined;
        subscriberId?: undefined;
        beneficiary?: undefined;
        payor?: undefined;
        class?: undefined;
        costToBeneficiary?: undefined;
        period?: undefined;
        serviceProvider?: undefined;
        effectiveDateTime?: undefined;
        valueQuantity?: undefined;
        referenceRange?: undefined;
        interpretation?: undefined;
        subType?: undefined;
        use?: undefined;
        patient?: undefined;
        created?: undefined;
        provider?: undefined;
        priority?: undefined;
        insurance?: undefined;
        diagnosis?: undefined;
        item?: undefined;
        total?: undefined;
        intent?: undefined;
        medicationCodeableConcept?: undefined;
        authoredOn?: undefined;
        requester?: undefined;
        dosageInstruction?: undefined;
        dispenseRequest?: undefined;
        vaccineCode?: undefined;
        occurrenceDateTime?: undefined;
        lotNumber?: undefined;
        expirationDate?: undefined;
        site?: undefined;
        verificationStatus?: undefined;
        criticality?: undefined;
        reaction?: undefined;
        issued?: undefined;
        conclusion?: undefined;
    } | {
        resourceType: string;
        id: string;
        status: string;
        category: {
            coding: {
                system: string;
                code: string;
            }[];
        }[];
        code: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
            text: string;
        };
        subject: {
            reference: string;
        };
        encounter: {
            reference: string;
        };
        effectiveDateTime: string;
        valueQuantity: {
            value: number;
            unit: string;
            system: string;
            code: string;
        };
        referenceRange: {
            low: {
                value: number;
                unit: string;
            };
            high: {
                value: number;
                unit: string;
            };
        }[];
        interpretation: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
        }[];
        identifier?: undefined;
        name?: undefined;
        gender?: undefined;
        birthDate?: undefined;
        telecom?: undefined;
        type?: undefined;
        subscriberId?: undefined;
        beneficiary?: undefined;
        payor?: undefined;
        class?: undefined;
        costToBeneficiary?: undefined;
        period?: undefined;
        serviceProvider?: undefined;
        clinicalStatus?: undefined;
        recordedDate?: undefined;
        subType?: undefined;
        use?: undefined;
        patient?: undefined;
        created?: undefined;
        provider?: undefined;
        priority?: undefined;
        insurance?: undefined;
        diagnosis?: undefined;
        item?: undefined;
        total?: undefined;
        intent?: undefined;
        medicationCodeableConcept?: undefined;
        authoredOn?: undefined;
        requester?: undefined;
        dosageInstruction?: undefined;
        dispenseRequest?: undefined;
        vaccineCode?: undefined;
        occurrenceDateTime?: undefined;
        lotNumber?: undefined;
        expirationDate?: undefined;
        site?: undefined;
        verificationStatus?: undefined;
        criticality?: undefined;
        reaction?: undefined;
        issued?: undefined;
        conclusion?: undefined;
    } | {
        resourceType: string;
        id: string;
        status: string;
        type: {
            coding: {
                system: string;
                code: string;
            }[];
        };
        subType: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
        };
        use: string;
        patient: {
            reference: string;
        };
        created: string;
        provider: {
            identifier: {
                system: string;
                value: string;
            };
            display: string;
        };
        priority: {
            coding: {
                code: string;
            }[];
        };
        insurance: {
            sequence: number;
            focal: boolean;
            coverage: {
                reference: string;
            };
        }[];
        diagnosis: {
            sequence: number;
            diagnosisCodeableConcept: {
                coding: ({
                    system: string;
                    code: string;
                    display: string;
                } | {
                    system: string;
                    code: string;
                    display?: undefined;
                })[];
            };
        }[];
        item: {
            sequence: number;
            productOrService: {
                coding: {
                    system: string;
                    code: string;
                    display: string;
                }[];
            };
            unitPrice: {
                value: number;
                currency: string;
            };
            net: {
                value: number;
                currency: string;
            };
        }[];
        total: {
            value: number;
            currency: string;
        };
        identifier?: undefined;
        name?: undefined;
        gender?: undefined;
        birthDate?: undefined;
        telecom?: undefined;
        subscriberId?: undefined;
        beneficiary?: undefined;
        payor?: undefined;
        class?: undefined;
        costToBeneficiary?: undefined;
        subject?: undefined;
        period?: undefined;
        serviceProvider?: undefined;
        clinicalStatus?: undefined;
        category?: undefined;
        code?: undefined;
        encounter?: undefined;
        recordedDate?: undefined;
        effectiveDateTime?: undefined;
        valueQuantity?: undefined;
        referenceRange?: undefined;
        interpretation?: undefined;
        intent?: undefined;
        medicationCodeableConcept?: undefined;
        authoredOn?: undefined;
        requester?: undefined;
        dosageInstruction?: undefined;
        dispenseRequest?: undefined;
        vaccineCode?: undefined;
        occurrenceDateTime?: undefined;
        lotNumber?: undefined;
        expirationDate?: undefined;
        site?: undefined;
        verificationStatus?: undefined;
        criticality?: undefined;
        reaction?: undefined;
        issued?: undefined;
        conclusion?: undefined;
    } | {
        resourceType: string;
        id: string;
        status: string;
        intent: string;
        medicationCodeableConcept: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
            text: string;
        };
        subject: {
            reference: string;
        };
        encounter: {
            reference: string;
        };
        authoredOn: string;
        requester: {
            display: string;
        };
        dosageInstruction: {
            text: string;
            timing: {
                repeat: {
                    frequency: number;
                    period: number;
                    periodUnit: string;
                };
            };
            route: {
                coding: {
                    system: string;
                    code: string;
                    display: string;
                }[];
            };
            doseAndRate: {
                doseQuantity: {
                    value: number;
                    unit: string;
                };
            }[];
        }[];
        dispenseRequest: {
            numberOfRepeatsAllowed: number;
            quantity: {
                value: number;
                unit: string;
            };
            expectedSupplyDuration: {
                value: number;
                unit: string;
            };
        };
        identifier?: undefined;
        name?: undefined;
        gender?: undefined;
        birthDate?: undefined;
        telecom?: undefined;
        type?: undefined;
        subscriberId?: undefined;
        beneficiary?: undefined;
        payor?: undefined;
        class?: undefined;
        costToBeneficiary?: undefined;
        period?: undefined;
        serviceProvider?: undefined;
        clinicalStatus?: undefined;
        category?: undefined;
        code?: undefined;
        recordedDate?: undefined;
        effectiveDateTime?: undefined;
        valueQuantity?: undefined;
        referenceRange?: undefined;
        interpretation?: undefined;
        subType?: undefined;
        use?: undefined;
        patient?: undefined;
        created?: undefined;
        provider?: undefined;
        priority?: undefined;
        insurance?: undefined;
        diagnosis?: undefined;
        item?: undefined;
        total?: undefined;
        vaccineCode?: undefined;
        occurrenceDateTime?: undefined;
        lotNumber?: undefined;
        expirationDate?: undefined;
        site?: undefined;
        verificationStatus?: undefined;
        criticality?: undefined;
        reaction?: undefined;
        issued?: undefined;
        conclusion?: undefined;
    } | {
        resourceType: string;
        id: string;
        status: string;
        vaccineCode: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
            text: string;
        };
        patient: {
            reference: string;
        };
        encounter: {
            reference: string;
        };
        occurrenceDateTime: string;
        lotNumber: string;
        expirationDate: string;
        site: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
        };
        identifier?: undefined;
        name?: undefined;
        gender?: undefined;
        birthDate?: undefined;
        telecom?: undefined;
        type?: undefined;
        subscriberId?: undefined;
        beneficiary?: undefined;
        payor?: undefined;
        class?: undefined;
        costToBeneficiary?: undefined;
        subject?: undefined;
        period?: undefined;
        serviceProvider?: undefined;
        clinicalStatus?: undefined;
        category?: undefined;
        code?: undefined;
        recordedDate?: undefined;
        effectiveDateTime?: undefined;
        valueQuantity?: undefined;
        referenceRange?: undefined;
        interpretation?: undefined;
        subType?: undefined;
        use?: undefined;
        created?: undefined;
        provider?: undefined;
        priority?: undefined;
        insurance?: undefined;
        diagnosis?: undefined;
        item?: undefined;
        total?: undefined;
        intent?: undefined;
        medicationCodeableConcept?: undefined;
        authoredOn?: undefined;
        requester?: undefined;
        dosageInstruction?: undefined;
        dispenseRequest?: undefined;
        verificationStatus?: undefined;
        criticality?: undefined;
        reaction?: undefined;
        issued?: undefined;
        conclusion?: undefined;
    } | {
        resourceType: string;
        id: string;
        clinicalStatus: {
            coding: {
                system: string;
                code: string;
            }[];
        };
        verificationStatus: {
            coding: {
                system: string;
                code: string;
            }[];
        };
        type: string;
        category: string[];
        criticality: string;
        code: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
            text: string;
        };
        patient: {
            reference: string;
        };
        recordedDate: string;
        reaction: {
            manifestation: {
                coding: {
                    system: string;
                    code: string;
                    display: string;
                }[];
                text: string;
            }[];
            severity: string;
        }[];
        identifier?: undefined;
        name?: undefined;
        gender?: undefined;
        birthDate?: undefined;
        telecom?: undefined;
        status?: undefined;
        subscriberId?: undefined;
        beneficiary?: undefined;
        payor?: undefined;
        class?: undefined;
        costToBeneficiary?: undefined;
        subject?: undefined;
        period?: undefined;
        serviceProvider?: undefined;
        encounter?: undefined;
        effectiveDateTime?: undefined;
        valueQuantity?: undefined;
        referenceRange?: undefined;
        interpretation?: undefined;
        subType?: undefined;
        use?: undefined;
        created?: undefined;
        provider?: undefined;
        priority?: undefined;
        insurance?: undefined;
        diagnosis?: undefined;
        item?: undefined;
        total?: undefined;
        intent?: undefined;
        medicationCodeableConcept?: undefined;
        authoredOn?: undefined;
        requester?: undefined;
        dosageInstruction?: undefined;
        dispenseRequest?: undefined;
        vaccineCode?: undefined;
        occurrenceDateTime?: undefined;
        lotNumber?: undefined;
        expirationDate?: undefined;
        site?: undefined;
        issued?: undefined;
        conclusion?: undefined;
    } | {
        resourceType: string;
        id: string;
        status: string;
        category: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
        }[];
        code: {
            coding: {
                system: string;
                code: string;
                display: string;
            }[];
            text: string;
        };
        subject: {
            reference: string;
        };
        encounter: {
            reference: string;
        };
        issued: string;
        conclusion: string;
        identifier?: undefined;
        name?: undefined;
        gender?: undefined;
        birthDate?: undefined;
        telecom?: undefined;
        type?: undefined;
        subscriberId?: undefined;
        beneficiary?: undefined;
        payor?: undefined;
        class?: undefined;
        costToBeneficiary?: undefined;
        period?: undefined;
        serviceProvider?: undefined;
        clinicalStatus?: undefined;
        recordedDate?: undefined;
        effectiveDateTime?: undefined;
        valueQuantity?: undefined;
        referenceRange?: undefined;
        interpretation?: undefined;
        subType?: undefined;
        use?: undefined;
        patient?: undefined;
        created?: undefined;
        provider?: undefined;
        priority?: undefined;
        insurance?: undefined;
        diagnosis?: undefined;
        item?: undefined;
        total?: undefined;
        intent?: undefined;
        medicationCodeableConcept?: undefined;
        authoredOn?: undefined;
        requester?: undefined;
        dosageInstruction?: undefined;
        dispenseRequest?: undefined;
        vaccineCode?: undefined;
        occurrenceDateTime?: undefined;
        lotNumber?: undefined;
        expirationDate?: undefined;
        site?: undefined;
        verificationStatus?: undefined;
        criticality?: undefined;
        reaction?: undefined;
    })[];
};
