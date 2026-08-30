import { IdentifierType } from './types.js';
export interface PatientIdentifier {
    value: string;
    type: IdentifierType;
    system: string;
    sourceSystemId: string;
    isActive: boolean;
    firstSeenAt: string;
    verified?: boolean;
}
