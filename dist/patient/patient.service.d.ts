export declare function validateSelfServicePayload(body: any): {
    valid: boolean;
    error?: string;
    normalized?: any;
};
export declare function getPatientSelfView(patientId: string, userId: string): Promise<{
    patient: {
        identifiers: {
            id: string;
            type: string;
            source_system_id: string | null;
            patient_id: string;
            value: string;
            system: string | null;
            is_active: boolean;
            first_seen_at: Date;
        }[];
    } & {
        id: string;
        gender: string | null;
        phone: string | null;
        email: string | null;
        status: string;
        source_system_id: string | null;
        source_record_id: string | null;
        internal_id: string;
        first_name: string | null;
        last_name: string | null;
        first_name_ar: string | null;
        last_name_ar: string | null;
        birth_date: Date | null;
        created_at: Date;
        updated_at: Date;
    };
    profile: {
        id: string;
        source: string;
        created_at: Date;
        updated_at: Date;
        patient_id: string;
        verification_status: string;
        preferred_first_name: string | null;
        preferred_last_name: string | null;
        preferred_language: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        emergency_contact_relationship: string | null;
        address_line: string | null;
        address_city: string | null;
        address_district: string | null;
        address_postal_code: string | null;
        recorded_at: Date;
        notes: string | null;
    };
    userFresh: {
        organization: {
            id: string;
            status: string;
            created_at: Date;
            region: string | null;
            organization_name: string;
            organization_name_ar: string | null;
            organization_type: string;
            parent_organization_id: string | null;
        };
        role: {
            id: string;
            role_code: import(".prisma/client").$Enums.RoleCode;
            role_name: string;
            description: string | null;
            is_system_role: boolean;
        };
    } & {
        id: string;
        phone: string | null;
        email: string | null;
        created_at: Date;
        updated_at: Date;
        is_active: boolean;
        organization_id: string;
        username: string;
        password_hash: string;
        full_name: string;
        role_id: string;
        patient_profile_id: string | null;
        deleted_at: Date | null;
    };
}>;
export declare function updatePatientSelfData(patientId: string, userId: string, organizationId: string, body: any): Promise<{
    updatedFields: string[];
    freshPatient: {
        identifiers: {
            id: string;
            type: string;
            source_system_id: string | null;
            patient_id: string;
            value: string;
            system: string | null;
            is_active: boolean;
            first_seen_at: Date;
        }[];
    } & {
        id: string;
        gender: string | null;
        phone: string | null;
        email: string | null;
        status: string;
        source_system_id: string | null;
        source_record_id: string | null;
        internal_id: string;
        first_name: string | null;
        last_name: string | null;
        first_name_ar: string | null;
        last_name_ar: string | null;
        birth_date: Date | null;
        created_at: Date;
        updated_at: Date;
    };
    freshUser: {
        organization: {
            id: string;
            status: string;
            created_at: Date;
            region: string | null;
            organization_name: string;
            organization_name_ar: string | null;
            organization_type: string;
            parent_organization_id: string | null;
        };
        role: {
            id: string;
            role_code: import(".prisma/client").$Enums.RoleCode;
            role_name: string;
            description: string | null;
            is_system_role: boolean;
        };
    } & {
        id: string;
        phone: string | null;
        email: string | null;
        created_at: Date;
        updated_at: Date;
        is_active: boolean;
        organization_id: string;
        username: string;
        password_hash: string;
        full_name: string;
        role_id: string;
        patient_profile_id: string | null;
        deleted_at: Date | null;
    };
    freshProfile: {
        id: string;
        source: string;
        created_at: Date;
        updated_at: Date;
        patient_id: string;
        verification_status: string;
        preferred_first_name: string | null;
        preferred_last_name: string | null;
        preferred_language: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        emergency_contact_relationship: string | null;
        address_line: string | null;
        address_city: string | null;
        address_district: string | null;
        address_postal_code: string | null;
        recorded_at: Date;
        notes: string | null;
    };
}>;
