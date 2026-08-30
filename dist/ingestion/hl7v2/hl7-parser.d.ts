export interface ParsedHl7Message {
    messageType: string;
    triggerEvent: string;
    messageControlId: string;
    sendingApplication: string;
    sendingFacility: string;
    dateTime: string;
    segments: Record<string, string[][]>;
}
export declare class Hl7v2MessageParser {
    /**
     * Parse standard pipe-delimited HL7 v2.x string into structured segments
     */
    parse(rawHl7: string): ParsedHl7Message;
    /**
     * Extract Patient Demographics from PID segment
     */
    extractPatient(parsed: ParsedHl7Message): {
        mrn: string;
        nationalId?: string;
        familyName: string;
        givenName: string;
        familyNameAr?: string;
        givenNameAr?: string;
        birthDate: string;
        gender: string;
        phone?: string;
    };
    /**
     * Extract Encounter from PV1 segment
     */
    extractEncounter(parsed: ParsedHl7Message): {
        visitNo: string;
        patientClass: string;
        department: string;
        admitDate: string;
    };
    /**
     * Extract Observation results from OBX segments
     */
    extractObservations(parsed: ParsedHl7Message): Array<{
        testCode: string;
        testName: string;
        value: number;
        unit: string;
        refRange: string;
        status: string;
    }>;
}
