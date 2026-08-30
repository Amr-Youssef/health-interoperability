import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
export class ConsentManager {
    persistPath;
    consents = new Map();
    breakGlassLog = [];
    constructor(persistPath) {
        if (persistPath === null) {
            this.persistPath = '';
            this.consents.set('ahmed-rashidi-id', {
                patientId: 'ahmed-rashidi-id',
                policy: 'OPT_IN_FULL',
                allowedOrganizations: ['hospital-a', 'hospital-b', 'hospital-c', 'hospital-d'],
                blockedCategories: [],
                allowEmergencyOverride: true,
                lastUpdated: new Date().toISOString()
            });
        }
        else {
            this.persistPath = persistPath || path.resolve(process.cwd(), '.data', 'consent-store.json');
            this.loadFromDisk();
        }
    }
    saveToDisk() {
        if (!this.persistPath)
            return;
        try {
            const dir = path.dirname(this.persistPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            const snapshot = {
                consents: Array.from(this.consents.values()),
                breakGlassLog: this.breakGlassLog,
                savedAt: new Date().toISOString()
            };
            fs.writeFileSync(this.persistPath, JSON.stringify(snapshot, null, 2), 'utf-8');
        }
        catch (err) {
            console.warn('⚠️ ConsentManager disk persistence warning:', err.message);
        }
    }
    loadFromDisk() {
        if (!this.persistPath)
            return;
        try {
            if (fs.existsSync(this.persistPath)) {
                const raw = fs.readFileSync(this.persistPath, 'utf-8');
                const data = JSON.parse(raw);
                if (data.consents) {
                    for (const c of data.consents) {
                        this.consents.set(c.patientId, c);
                    }
                }
                if (data.breakGlassLog) {
                    this.breakGlassLog = data.breakGlassLog;
                }
                console.log(`📂 Loaded ${this.consents.size} consent directive(s) from disk.`);
                return;
            }
        }
        catch (err) {
            console.warn('⚠️ ConsentManager disk load warning:', err.message);
        }
        // Default national policy for Ahmed Al-Rashidi
        this.consents.set('ahmed-rashidi-id', {
            patientId: 'ahmed-rashidi-id',
            policy: 'OPT_IN_FULL',
            allowedOrganizations: ['hospital-a', 'hospital-b', 'hospital-c', 'hospital-d'],
            blockedCategories: [],
            allowEmergencyOverride: true,
            lastUpdated: new Date().toISOString()
        });
        this.saveToDisk();
    }
    setConsent(directive) {
        this.consents.set(directive.patientId, directive);
        this.saveToDisk();
    }
    getConsent(patientId) {
        const existing = this.consents.get(patientId);
        if (existing)
            return existing;
        // Default Saudi PDPL compliant baseline
        const baseline = {
            patientId,
            policy: 'OPT_IN_FULL',
            allowedOrganizations: ['*'],
            blockedCategories: [],
            allowEmergencyOverride: true,
            lastUpdated: new Date().toISOString()
        };
        this.consents.set(patientId, baseline);
        this.saveToDisk();
        return baseline;
    }
    evaluateAccess(patientId, requestingOrgId, category = 'general') {
        const consent = this.getConsent(patientId);
        if (consent.policy === 'OPT_IN_FULL') {
            return { isGranted: true, reason: 'Patient consented to full national health record exchange across accredited health facilities.' };
        }
        if (consent.blockedCategories.includes(category)) {
            return { isGranted: false, reason: `Data category '${category}' is blocked by patient privacy directive.` };
        }
        if (consent.allowedOrganizations.includes('*') || consent.allowedOrganizations.includes(requestingOrgId)) {
            return { isGranted: true, reason: 'Organization is authorized by patient consent directive.' };
        }
        return { isGranted: false, reason: 'Access denied: requesting facility is not in the patient approved organization list.' };
    }
    executeBreakTheGlass(patientId, practitionerId, requestingOrgId, emergencyReason) {
        const eventId = uuidv4();
        const timestamp = new Date().toISOString();
        const payload = `${eventId}:${patientId}:${practitionerId}:${requestingOrgId}:${emergencyReason}:${timestamp}`;
        const auditHashSha256 = crypto.createHash('sha256').update(payload).digest('hex');
        const event = {
            id: eventId,
            patientId,
            practitionerId,
            requestingOrgId,
            emergencyReason,
            timestamp,
            auditHashSha256,
            isFlaggedForReview: true
        };
        this.breakGlassLog.push(event);
        this.saveToDisk();
        return event;
    }
    getAllBreakGlassEvents() {
        return [...this.breakGlassLog];
    }
    clearAll() {
        this.consents.clear();
        this.breakGlassLog = [];
        this.saveToDisk();
    }
}
//# sourceMappingURL=consent-manager.js.map