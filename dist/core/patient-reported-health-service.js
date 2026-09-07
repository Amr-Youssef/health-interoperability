import { prisma as defaultPrisma } from '../lib/prisma.js';
import { CryptographicAuditChain } from '../security/audit-chain.js';
export class PatientReportedHealthService {
    prisma;
    auditChain;
    constructor(prisma, auditChain) {
        this.prisma = prisma || defaultPrisma;
        this.auditChain = auditChain || new CryptographicAuditChain(this.prisma);
    }
    // === PROFILE MANAGEMENT ===
    async createOrUpdateProfile(patientId, data) {
        const recordedAt = new Date().toISOString();
        const existing = await this.prisma.patientProfile.findUnique({ where: { patient_id: patientId } });
        const profile = await this.prisma.patientProfile.upsert({
            where: { patient_id: patientId },
            update: {
                preferred_first_name: data.preferredFirstName,
                preferred_last_name: data.preferredLastName,
                preferred_language: data.preferredLanguage,
                emergency_contact_name: data.emergencyContactName,
                emergency_contact_phone: data.emergencyContactPhone,
                emergency_contact_relationship: data.emergencyContactRelationship,
                address_line: data.addressLine,
                address_city: data.addressCity,
                address_district: data.addressDistrict,
                address_postal_code: data.addressPostalCode,
                notes: data.notes,
                updated_at: new Date(),
            },
            create: {
                patient_id: patientId,
                preferred_first_name: data.preferredFirstName,
                preferred_last_name: data.preferredLastName,
                preferred_language: data.preferredLanguage,
                emergency_contact_name: data.emergencyContactName,
                emergency_contact_phone: data.emergencyContactPhone,
                emergency_contact_relationship: data.emergencyContactRelationship,
                address_line: data.addressLine,
                address_city: data.addressCity,
                address_district: data.addressDistrict,
                address_postal_code: data.addressPostalCode,
                source: 'PATIENT',
                verification_status: 'SELF_REPORTED',
                recorded_at: new Date(recordedAt),
                notes: data.notes,
            },
        });
        // Audit
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientProfile', profile.id, `Patient ${existing ? 'updated' : 'created'} profile`);
        return this.mapProfileToData(profile);
    }
    async getProfile(patientId) {
        const profile = await this.prisma.patientProfile.findUnique({
            where: { patient_id: patientId },
        });
        return profile ? this.mapProfileToData(profile) : null;
    }
    // === ALLERGIES ===
    async createAllergy(patientId, data) {
        const allergy = await this.prisma.patientReportedAllergy.create({
            data: {
                patient_id: patientId,
                allergen_name: data.allergenName,
                allergen_code: data.allergenCode,
                allergen_system: data.allergenSystem,
                allergen_display: data.allergenDisplay,
                reaction_text: data.reactionText,
                reaction_severity: data.reactionSeverity,
                onset_date: data.onsetDate ? new Date(data.onsetDate) : null,
                is_medically_diagnosed: data.isMedicallyDiagnosed,
                notes: data.notes,
                source: 'PATIENT',
                verification_status: 'UNVERIFIED',
                recorded_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedAllergy', allergy.id, 'Created allergy record');
        return this.mapAllergyToData(allergy);
    }
    async getAllergies(patientId) {
        const allergies = await this.prisma.patientReportedAllergy.findMany({
            where: { patient_id: patientId },
            orderBy: { created_at: 'desc' },
        });
        return allergies.map((a) => this.mapAllergyToData(a));
    }
    async updateAllergy(allergyId, patientId, data) {
        const allergy = await this.prisma.patientReportedAllergy.findUnique({ where: { id: allergyId } });
        if (!allergy || allergy.patient_id !== patientId) {
            throw new Error('Allergy not found or unauthorized access');
        }
        const updated = await this.prisma.patientReportedAllergy.update({
            where: { id: allergyId },
            data: {
                allergen_name: data.allergenName ?? allergy.allergen_name,
                reaction_text: data.reactionText ?? allergy.reaction_text,
                reaction_severity: data.reactionSeverity ?? allergy.reaction_severity,
                notes: data.notes ?? allergy.notes,
                updated_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('TRANSFORM', patientId, 'PatientReportedAllergy', allergyId, 'Updated allergy record');
        return this.mapAllergyToData(updated);
    }
    async deleteAllergy(allergyId, patientId) {
        const allergy = await this.prisma.patientReportedAllergy.findUnique({ where: { id: allergyId } });
        if (!allergy || allergy.patient_id !== patientId) {
            throw new Error('Allergy not found or unauthorized access');
        }
        await this.prisma.patientReportedAllergy.delete({ where: { id: allergyId } });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedAllergy', allergyId, 'Deleted allergy record');
    }
    // === MEDICATIONS ===
    async createMedication(patientId, data) {
        const medication = await this.prisma.patientReportedMedication.create({
            data: {
                patient_id: patientId,
                medication_name: data.medicationName,
                medication_code: data.medicationCode,
                medication_system: data.medicationSystem,
                medication_display: data.medicationDisplay,
                strength: data.strength,
                dose: data.dose,
                frequency: data.frequency,
                route: data.route,
                reason_for_use: data.reasonForUse,
                start_date: data.startDate ? new Date(data.startDate) : null,
                end_date: data.endDate ? new Date(data.endDate) : null,
                currently_taking: data.currentlyTaking ?? true,
                notes: data.notes,
                source: 'PATIENT',
                verification_status: 'UNVERIFIED',
                recorded_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedMedication', medication.id, 'Created medication record');
        return this.mapMedicationToData(medication);
    }
    async getMedications(patientId) {
        const medications = await this.prisma.patientReportedMedication.findMany({
            where: { patient_id: patientId },
            orderBy: { created_at: 'desc' },
        });
        return medications.map((m) => this.mapMedicationToData(m));
    }
    async updateMedication(medicationId, patientId, data) {
        const medication = await this.prisma.patientReportedMedication.findUnique({ where: { id: medicationId } });
        if (!medication || medication.patient_id !== patientId) {
            throw new Error('Medication not found or unauthorized access');
        }
        const updated = await this.prisma.patientReportedMedication.update({
            where: { id: medicationId },
            data: {
                medication_name: data.medicationName ?? medication.medication_name,
                dose: data.dose ?? medication.dose,
                frequency: data.frequency ?? medication.frequency,
                currently_taking: data.currentlyTaking ?? medication.currently_taking,
                notes: data.notes ?? medication.notes,
                updated_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('TRANSFORM', patientId, 'PatientReportedMedication', medicationId, 'Updated medication record');
        return this.mapMedicationToData(updated);
    }
    async deleteMedication(medicationId, patientId) {
        const medication = await this.prisma.patientReportedMedication.findUnique({ where: { id: medicationId } });
        if (!medication || medication.patient_id !== patientId) {
            throw new Error('Medication not found or unauthorized access');
        }
        await this.prisma.patientReportedMedication.delete({ where: { id: medicationId } });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedMedication', medicationId, 'Deleted medication record');
    }
    // === CONDITIONS ===
    async createCondition(patientId, data) {
        const condition = await this.prisma.patientReportedCondition.create({
            data: {
                patient_id: patientId,
                condition_name: data.conditionName,
                condition_code: data.conditionCode,
                condition_system: data.conditionSystem,
                condition_display: data.conditionDisplay,
                diagnosis_date: data.diagnosisDate ? new Date(data.diagnosisDate) : null,
                status: data.status,
                treating_facility: data.treatingFacility,
                notes: data.notes,
                source: 'PATIENT',
                verification_status: 'UNVERIFIED',
                recorded_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedCondition', condition.id, 'Created condition record');
        return this.mapConditionToData(condition);
    }
    async getConditions(patientId) {
        const conditions = await this.prisma.patientReportedCondition.findMany({
            where: { patient_id: patientId },
            orderBy: { created_at: 'desc' },
        });
        return conditions.map((c) => this.mapConditionToData(c));
    }
    async updateCondition(conditionId, patientId, data) {
        const condition = await this.prisma.patientReportedCondition.findUnique({ where: { id: conditionId } });
        if (!condition || condition.patient_id !== patientId) {
            throw new Error('Condition not found or unauthorized access');
        }
        const updated = await this.prisma.patientReportedCondition.update({
            where: { id: conditionId },
            data: {
                condition_name: data.conditionName ?? condition.condition_name,
                status: data.status ?? condition.status,
                notes: data.notes ?? condition.notes,
                updated_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('TRANSFORM', patientId, 'PatientReportedCondition', conditionId, 'Updated condition record');
        return this.mapConditionToData(updated);
    }
    async deleteCondition(conditionId, patientId) {
        const condition = await this.prisma.patientReportedCondition.findUnique({ where: { id: conditionId } });
        if (!condition || condition.patient_id !== patientId) {
            throw new Error('Condition not found or unauthorized access');
        }
        await this.prisma.patientReportedCondition.delete({ where: { id: conditionId } });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedCondition', conditionId, 'Deleted condition record');
    }
    // === PROCEDURES ===
    async createProcedure(patientId, data) {
        const procedure = await this.prisma.patientReportedProcedure.create({
            data: {
                patient_id: patientId,
                procedure_name: data.procedureName,
                procedure_code: data.procedureCode,
                procedure_system: data.procedureSystem,
                procedure_display: data.procedureDisplay,
                procedure_date: data.procedureDate ? new Date(data.procedureDate) : null,
                facility_name: data.facilityName,
                notes: data.notes,
                source: 'PATIENT',
                verification_status: 'UNVERIFIED',
                recorded_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedProcedure', procedure.id, 'Created procedure record');
        return this.mapProcedureToData(procedure);
    }
    async getProcedures(patientId) {
        const procedures = await this.prisma.patientReportedProcedure.findMany({
            where: { patient_id: patientId },
            orderBy: { created_at: 'desc' },
        });
        return procedures.map((p) => this.mapProcedureToData(p));
    }
    async updateProcedure(procedureId, patientId, data) {
        const procedure = await this.prisma.patientReportedProcedure.findUnique({ where: { id: procedureId } });
        if (!procedure || procedure.patient_id !== patientId) {
            throw new Error('Procedure not found or unauthorized access');
        }
        const updated = await this.prisma.patientReportedProcedure.update({
            where: { id: procedureId },
            data: {
                procedure_name: data.procedureName ?? procedure.procedure_name,
                facility_name: data.facilityName ?? procedure.facility_name,
                notes: data.notes ?? procedure.notes,
                updated_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('TRANSFORM', patientId, 'PatientReportedProcedure', procedureId, 'Updated procedure record');
        return this.mapProcedureToData(updated);
    }
    async deleteProcedure(procedureId, patientId) {
        const procedure = await this.prisma.patientReportedProcedure.findUnique({ where: { id: procedureId } });
        if (!procedure || procedure.patient_id !== patientId) {
            throw new Error('Procedure not found or unauthorized access');
        }
        await this.prisma.patientReportedProcedure.delete({ where: { id: procedureId } });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedProcedure', procedureId, 'Deleted procedure record');
    }
    // === FAMILY HISTORY ===
    async createFamilyMember(patientId, data) {
        const member = await this.prisma.familyMember.create({
            data: {
                patient_id: patientId,
                relative_name: data.relativeName,
                relationship: data.relationship,
                condition_name: data.conditionName,
                condition_code: data.conditionCode,
                condition_system: data.conditionSystem,
                condition_display: data.conditionDisplay,
                onset_date: data.onsetDate ? new Date(data.onsetDate) : null,
                notes: data.notes,
                source: 'PATIENT',
                verification_status: 'UNVERIFIED',
                recorded_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('INGEST', patientId, 'FamilyMember', member.id, 'Created family history record');
        return this.mapFamilyMemberToData(member);
    }
    async getFamilyMembers(patientId) {
        const members = await this.prisma.familyMember.findMany({
            where: { patient_id: patientId },
            orderBy: { created_at: 'desc' },
        });
        return members.map((m) => this.mapFamilyMemberToData(m));
    }
    async updateFamilyMember(memberId, patientId, data) {
        const member = await this.prisma.familyMember.findUnique({ where: { id: memberId } });
        if (!member || member.patient_id !== patientId) {
            throw new Error('Family member record not found or unauthorized access');
        }
        const updated = await this.prisma.familyMember.update({
            where: { id: memberId },
            data: {
                relative_name: data.relativeName ?? member.relative_name,
                condition_name: data.conditionName ?? member.condition_name,
                notes: data.notes ?? member.notes,
                updated_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('TRANSFORM', patientId, 'FamilyMember', memberId, 'Updated family history record');
        return this.mapFamilyMemberToData(updated);
    }
    async deleteFamilyMember(memberId, patientId) {
        const member = await this.prisma.familyMember.findUnique({ where: { id: memberId } });
        if (!member || member.patient_id !== patientId) {
            throw new Error('Family member record not found or unauthorized access');
        }
        await this.prisma.familyMember.delete({ where: { id: memberId } });
        await this.auditChain.recordEvent('INGEST', patientId, 'FamilyMember', memberId, 'Deleted family history record');
    }
    // === SOCIAL HISTORY ===
    async createOrUpdateSocialHistory(patientId, data) {
        const existing = await this.prisma.patientReportedSocialHistory.findUnique({
            where: { patient_id: patientId },
        });
        const socialHistory = await this.prisma.patientReportedSocialHistory.upsert({
            where: { patient_id: patientId },
            update: {
                smoking_status: data.smokingStatus,
                smoking_frequency: data.smokingFrequency,
                tobacco_use: data.tobaccoUse,
                tobacco_frequency: data.tobaccoFrequency,
                physical_activity: data.physicalActivity,
                activity_notes: data.activityNotes,
                occupation: data.occupation,
                sleep_hours: data.sleepHours,
                sleep_quality: data.sleepQuality,
                other_risk_factors: data.otherRiskFactors,
                updated_at: new Date(),
            },
            create: {
                patient_id: patientId,
                smoking_status: data.smokingStatus,
                smoking_frequency: data.smokingFrequency,
                tobacco_use: data.tobaccoUse,
                tobacco_frequency: data.tobaccoFrequency,
                physical_activity: data.physicalActivity,
                activity_notes: data.activityNotes,
                occupation: data.occupation,
                sleep_hours: data.sleepHours,
                sleep_quality: data.sleepQuality,
                other_risk_factors: data.otherRiskFactors,
                source: 'PATIENT',
                verification_status: 'UNVERIFIED',
                recorded_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedSocialHistory', socialHistory.id, `Patient ${existing ? 'updated' : 'created'} social history`);
        return this.mapSocialHistoryToData(socialHistory);
    }
    async getSocialHistory(patientId) {
        const socialHistory = await this.prisma.patientReportedSocialHistory.findUnique({
            where: { patient_id: patientId },
        });
        return socialHistory ? this.mapSocialHistoryToData(socialHistory) : null;
    }
    // === VITAL OBSERVATIONS ===
    async createVitalObservation(patientId, data) {
        const vital = await this.prisma.patientReportedVitalObservation.create({
            data: {
                patient_id: patientId,
                observation_type: data.observationType,
                observation_code: data.observationCode,
                observation_system: data.observationSystem,
                observation_display: data.observationDisplay,
                value_quantity: data.valueQuantity,
                value_unit: data.valueUnit,
                value_text: data.valueText,
                systolic: data.systolic,
                diastolic: data.diastolic,
                device_name: data.deviceName,
                device_manufacturer: data.deviceManufacturer,
                device_model: data.deviceModel,
                device_identifier: data.deviceIdentifier,
                measurement_method: data.measurementMethod,
                recorded_at: new Date(data.recordedAt),
                measurement_notes: data.measurementNotes,
                source: 'PATIENT',
                verification_status: 'UNVERIFIED',
            },
        });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedVitalObservation', vital.id, 'Created vital observation');
        return this.mapVitalObservationToData(vital);
    }
    async getVitalObservations(patientId, observationType) {
        const vitals = await this.prisma.patientReportedVitalObservation.findMany({
            where: {
                patient_id: patientId,
                ...(observationType && { observation_type: observationType }),
            },
            orderBy: { recorded_at: 'desc' },
        });
        return vitals.map((v) => this.mapVitalObservationToData(v));
    }
    async deleteVitalObservation(vitalId, patientId) {
        const vital = await this.prisma.patientReportedVitalObservation.findUnique({ where: { id: vitalId } });
        if (!vital || vital.patient_id !== patientId) {
            throw new Error('Vital observation not found or unauthorized access');
        }
        await this.prisma.patientReportedVitalObservation.delete({ where: { id: vitalId } });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientReportedVitalObservation', vitalId, 'Deleted vital observation');
    }
    // === DOCUMENTS ===
    async createDocument(patientId, data) {
        const document = await this.prisma.patientUploadedDocument.create({
            data: {
                patient_id: patientId,
                filename: data.filename,
                file_mimetype: data.fileMimetype,
                file_size_bytes: data.fileSizeBytes,
                document_category: data.documentCategory,
                document_description: data.documentDescription,
                storage_reference: data.storageReference,
                processing_status: data.processingStatus,
                extracted_data: data.extractedData,
                extraction_error: data.extractionError,
                verification_status: data.verificationStatus,
                verification_notes: data.verificationNotes,
                source: 'PATIENT',
                upload_timestamp: new Date(),
            },
        });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientUploadedDocument', document.id, `Uploaded document: ${data.filename}`);
        return this.mapDocumentToData(document);
    }
    async getDocuments(patientId, category) {
        const documents = await this.prisma.patientUploadedDocument.findMany({
            where: {
                patient_id: patientId,
                ...(category && { document_category: category }),
            },
            orderBy: { upload_timestamp: 'desc' },
        });
        return documents.map((d) => this.mapDocumentToData(d));
    }
    async updateDocumentStatus(documentId, patientId, processingStatus, verificationStatus) {
        const document = await this.prisma.patientUploadedDocument.findUnique({ where: { id: documentId } });
        if (!document || document.patient_id !== patientId) {
            throw new Error('Document not found or unauthorized access');
        }
        const updated = await this.prisma.patientUploadedDocument.update({
            where: { id: documentId },
            data: {
                processing_status: processingStatus,
                verification_status: verificationStatus ?? document.verification_status,
                updated_at: new Date(),
            },
        });
        await this.auditChain.recordEvent('TRANSFORM', patientId, 'PatientUploadedDocument', documentId, `Updated document status to ${processingStatus}`);
        return this.mapDocumentToData(updated);
    }
    async deleteDocument(documentId, patientId) {
        const document = await this.prisma.patientUploadedDocument.findUnique({ where: { id: documentId } });
        if (!document || document.patient_id !== patientId) {
            throw new Error('Document not found or unauthorized access');
        }
        await this.prisma.patientUploadedDocument.delete({ where: { id: documentId } });
        await this.auditChain.recordEvent('INGEST', patientId, 'PatientUploadedDocument', documentId, 'Deleted document');
    }
    // === COMPOSITE HEALTH PROFILE ===
    async getPatientHealthProfile(patientId) {
        return {
            profile: await this.getProfile(patientId),
            allergies: await this.getAllergies(patientId),
            medications: await this.getMedications(patientId),
            conditions: await this.getConditions(patientId),
            procedures: await this.getProcedures(patientId),
            familyHistory: await this.getFamilyMembers(patientId),
            socialHistory: await this.getSocialHistory(patientId),
            vitalObservations: await this.getVitalObservations(patientId),
            documents: await this.getDocuments(patientId),
        };
    }
    // === PRIVATE MAPPING METHODS ===
    mapProfileToData(profile) {
        return {
            patientId: profile.patient_id,
            preferredFirstName: profile.preferred_first_name,
            preferredLastName: profile.preferred_last_name,
            preferredLanguage: profile.preferred_language,
            emergencyContactName: profile.emergency_contact_name,
            emergencyContactPhone: profile.emergency_contact_phone,
            emergencyContactRelationship: profile.emergency_contact_relationship,
            addressLine: profile.address_line,
            addressCity: profile.address_city,
            addressDistrict: profile.address_district,
            addressPostalCode: profile.address_postal_code,
            source: profile.source,
            verificationStatus: profile.verification_status,
            recordedAt: profile.recorded_at.toISOString(),
            notes: profile.notes,
        };
    }
    mapAllergyToData(allergy) {
        return {
            patientId: allergy.patient_id,
            allergenName: allergy.allergen_name,
            allergenCode: allergy.allergen_code,
            allergenSystem: allergy.allergen_system,
            allergenDisplay: allergy.allergen_display,
            reactionText: allergy.reaction_text,
            reactionSeverity: allergy.reaction_severity,
            onsetDate: allergy.onset_date?.toISOString(),
            isMedicallyDiagnosed: allergy.is_medically_diagnosed,
            notes: allergy.notes,
            source: allergy.source,
            verificationStatus: allergy.verification_status,
            recordedAt: allergy.recorded_at.toISOString(),
        };
    }
    mapMedicationToData(medication) {
        return {
            patientId: medication.patient_id,
            medicationName: medication.medication_name,
            medicationCode: medication.medication_code,
            medicationSystem: medication.medication_system,
            medicationDisplay: medication.medication_display,
            strength: medication.strength,
            dose: medication.dose,
            frequency: medication.frequency,
            route: medication.route,
            reasonForUse: medication.reason_for_use,
            startDate: medication.start_date?.toISOString(),
            endDate: medication.end_date?.toISOString(),
            currentlyTaking: medication.currently_taking,
            notes: medication.notes,
            source: medication.source,
            verificationStatus: medication.verification_status,
            recordedAt: medication.recorded_at.toISOString(),
        };
    }
    mapConditionToData(condition) {
        return {
            patientId: condition.patient_id,
            conditionName: condition.condition_name,
            conditionCode: condition.condition_code,
            conditionSystem: condition.condition_system,
            conditionDisplay: condition.condition_display,
            diagnosisDate: condition.diagnosis_date?.toISOString(),
            status: condition.status,
            treatingFacility: condition.treating_facility,
            notes: condition.notes,
            source: condition.source,
            verificationStatus: condition.verification_status,
            recordedAt: condition.recorded_at.toISOString(),
        };
    }
    mapProcedureToData(procedure) {
        return {
            patientId: procedure.patient_id,
            procedureName: procedure.procedure_name,
            procedureCode: procedure.procedure_code,
            procedureSystem: procedure.procedure_system,
            procedureDisplay: procedure.procedure_display,
            procedureDate: procedure.procedure_date?.toISOString(),
            facilityName: procedure.facility_name,
            notes: procedure.notes,
            source: procedure.source,
            verificationStatus: procedure.verification_status,
            recordedAt: procedure.recorded_at.toISOString(),
        };
    }
    mapFamilyMemberToData(member) {
        return {
            patientId: member.patient_id,
            relativeName: member.relative_name,
            relationship: member.relationship,
            conditionName: member.condition_name,
            conditionCode: member.condition_code,
            conditionSystem: member.condition_system,
            conditionDisplay: member.condition_display,
            onsetDate: member.onset_date?.toISOString(),
            notes: member.notes,
            source: member.source,
            verificationStatus: member.verification_status,
            recordedAt: member.recorded_at.toISOString(),
        };
    }
    mapSocialHistoryToData(socialHistory) {
        return {
            patientId: socialHistory.patient_id,
            smokingStatus: socialHistory.smoking_status,
            smokingFrequency: socialHistory.smoking_frequency,
            tobaccoUse: socialHistory.tobacco_use,
            tobaccoFrequency: socialHistory.tobacco_frequency,
            physicalActivity: socialHistory.physical_activity,
            activityNotes: socialHistory.activity_notes,
            occupation: socialHistory.occupation,
            sleepHours: socialHistory.sleep_hours,
            sleepQuality: socialHistory.sleep_quality,
            otherRiskFactors: socialHistory.other_risk_factors,
            source: socialHistory.source,
            verificationStatus: socialHistory.verification_status,
            recordedAt: socialHistory.recorded_at.toISOString(),
        };
    }
    mapVitalObservationToData(vital) {
        return {
            patientId: vital.patient_id,
            observationType: vital.observation_type,
            observationCode: vital.observation_code,
            observationSystem: vital.observation_system,
            observationDisplay: vital.observation_display,
            valueQuantity: vital.value_quantity,
            valueUnit: vital.value_unit,
            valueText: vital.value_text,
            systolic: vital.systolic,
            diastolic: vital.diastolic,
            deviceName: vital.device_name,
            deviceManufacturer: vital.device_manufacturer,
            deviceModel: vital.device_model,
            deviceIdentifier: vital.device_identifier,
            measurementMethod: vital.measurement_method,
            recordedAt: vital.recorded_at.toISOString(),
            measurementNotes: vital.measurement_notes,
            source: vital.source,
            verificationStatus: vital.verification_status,
        };
    }
    mapDocumentToData(document) {
        return {
            patientId: document.patient_id,
            filename: document.filename,
            fileMimetype: document.file_mimetype,
            fileSizeBytes: document.file_size_bytes,
            documentCategory: document.document_category,
            documentDescription: document.document_description,
            storageReference: document.storage_reference,
            processingStatus: document.processing_status,
            extractedData: document.extracted_data,
            extractionError: document.extraction_error,
            verificationStatus: document.verification_status,
            verificationNotes: document.verification_notes,
            source: document.source,
            uploadTimestamp: document.upload_timestamp.toISOString(),
        };
    }
}
//# sourceMappingURL=patient-reported-health-service.js.map