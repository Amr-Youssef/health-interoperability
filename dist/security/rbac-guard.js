export class RbacGuard {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Middleware: Extracts and validates user identity & role context
     */
    extractContext = (req, res, next) => {
        const userId = req.headers['x-user-id'] || req.query.userId;
        const roleHeader = req.headers['x-role'] || req.query.role;
        const orgHeader = req.headers['x-organization-id'] || req.query.orgId;
        const patientHeader = req.headers['x-patient-id'] || req.query.patientId;
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        // If userId provided, verify in DB
        if (userId) {
            const user = this.db.getUser(userId);
            if (user && user.isActive) {
                req.context = {
                    userId: user.id,
                    username: user.username,
                    roleCode: user.roleCode,
                    organizationId: user.organizationId,
                    patientProfileId: user.patientProfileId,
                    ipAddress
                };
                return next();
            }
        }
        // Default / Header-based Context Resolution
        const roleCode = roleHeader || 'HOSPITAL_ADMIN';
        const organizationId = orgHeader || 'ORG-MOH-HQ';
        req.context = {
            userId: userId || `user-${roleCode.toLowerCase()}`,
            username: `user_${roleCode.toLowerCase()}`,
            roleCode,
            organizationId,
            patientProfileId: patientHeader,
            ipAddress
        };
        next();
    };
    /**
     * Middleware: Require one of the specified system roles
     */
    requireRole = (allowedRoles) => {
        return (req, res, next) => {
            if (!req.context) {
                res.status(401).json({ error: 'Unauthorized: Missing request authentication context.' });
                return;
            }
            if (!allowedRoles.includes(req.context.roleCode)) {
                this.db.logAudit(req.context.userId, req.context.organizationId, 'SECURITY_ACCESS', req.path, 'READ', null, { status: 'FORBIDDEN', reason: `Role [${req.context.roleCode}] is not allowed.` }, req.context.ipAddress);
                res.status(403).json({
                    error: `Forbidden: Access restricted. Role [${req.context.roleCode}] does not have required permissions.`
                });
                return;
            }
            next();
        };
    };
    /**
     * Middleware: Enforce Organization Scope
     * - Hospital Admin can only access data belonging to their organization
     * - MOH Admin has national scope
     */
    enforceOrganizationScope = (paramName = 'organizationId') => {
        return (req, res, next) => {
            if (!req.context) {
                res.status(401).json({ error: 'Unauthorized: Missing authentication context.' });
                return;
            }
            const targetOrgId = req.params[paramName] || req.body[paramName] || req.query[paramName] || req.context.organizationId;
            // MOH Admin has global access
            if (req.context.roleCode === 'MOH_ADMIN') {
                return next();
            }
            // Hospital Admin must match target organization
            if (req.context.roleCode === 'HOSPITAL_ADMIN') {
                if (targetOrgId && targetOrgId !== req.context.organizationId) {
                    this.db.logAudit(req.context.userId, req.context.organizationId, 'ORGANIZATION_SCOPE_VIOLATION', targetOrgId, 'READ', null, { error: 'Attempted cross-organization access' }, req.context.ipAddress);
                    res.status(403).json({
                        error: `Forbidden: You are only authorized to access records for organization [${req.context.organizationId}].`
                    });
                    return;
                }
            }
            // Patient cannot access organizational administration
            if (req.context.roleCode === 'PATIENT') {
                res.status(403).json({ error: 'Forbidden: Patients cannot access organizational administrative records.' });
                return;
            }
            next();
        };
    };
    /**
     * Middleware: Enforce Patient Scope
     * - Patient can only access their own patientProfileId
     * - Hospital Admin can only access patients registered/linked to their organization
     * - MOH Admin can access under supervised audit
     */
    enforcePatientScope = (paramName = 'patientId') => {
        return (req, res, next) => {
            if (!req.context) {
                res.status(401).json({ error: 'Unauthorized: Missing authentication context.' });
                return;
            }
            const targetPatientId = req.params[paramName] || req.body[paramName] || req.query[paramName];
            if (!targetPatientId) {
                return next();
            }
            // 1. Patient Role Check
            if (req.context.roleCode === 'PATIENT') {
                if (req.context.patientProfileId !== targetPatientId) {
                    this.db.logAudit(req.context.userId, req.context.organizationId, 'PATIENT_PRIVACY_VIOLATION', targetPatientId, 'READ', null, { error: 'Attempted unauthorized access to another patient record' }, req.context.ipAddress);
                    res.status(403).json({
                        error: 'Forbidden: You are only permitted to access your personal health record.'
                    });
                    return;
                }
            }
            // 2. Hospital Admin Check
            if (req.context.roleCode === 'HOSPITAL_ADMIN') {
                const patient = this.db.getPatient(targetPatientId);
                if (patient) {
                    const linkedPatients = this.db.getPatientsByOrganization(req.context.organizationId);
                    const isLinked = linkedPatients.some(p => p.id === targetPatientId);
                    if (!isLinked) {
                        this.db.logAudit(req.context.userId, req.context.organizationId, 'HOSPITAL_PATIENT_SCOPE_VIOLATION', targetPatientId, 'READ', null, { error: 'Patient not registered or linked to this hospital' }, req.context.ipAddress);
                        res.status(403).json({
                            error: `Forbidden: Patient [${targetPatientId}] is not linked to your hospital [${req.context.organizationId}].`
                        });
                        return;
                    }
                }
            }
            next();
        };
    };
}
//# sourceMappingURL=rbac-guard.js.map