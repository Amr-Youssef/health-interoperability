import { NationalHealthDB } from './national-health-db.js';
export declare class MigrationRunner {
    private db;
    constructor(db: NationalHealthDB);
    /**
     * 1. Cleanup Legacy & Stale Store Files
     */
    cleanupLegacy(): Promise<void>;
    /**
     * 2. Seed Clean Standard System Roles
     */
    seedRealRoles(): void;
    /**
     * 3. Seed MOH Central Root Organization
     */
    seedMOHRootOrganization(): void;
    /**
     * Run All Migrations and Seeders
     */
    runAll(): Promise<{
        cleaned: boolean;
        seededRoles: number;
        seededOrgs: number;
    }>;
}
