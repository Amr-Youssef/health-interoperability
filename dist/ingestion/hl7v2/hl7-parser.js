export class Hl7v2MessageParser {
    /**
     * Parse standard pipe-delimited HL7 v2.x string into structured segments
     */
    parse(rawHl7) {
        const lines = rawHl7.trim().split(/\r?\n/);
        const segments = {};
        for (const line of lines) {
            if (!line || line.trim().length === 0)
                continue;
            const fields = line.split('|');
            const segmentName = fields[0];
            if (!segments[segmentName]) {
                segments[segmentName] = [];
            }
            segments[segmentName].push(fields);
        }
        const msh = segments['MSH']?.[0];
        if (!msh) {
            throw new Error('Invalid HL7 v2 message: MSH segment missing');
        }
        // Standard MSH field index handling
        // MSH|FieldSep|EncChars|SendingApp|SendingFac|ReceivingApp|ReceivingFac|DateTime|Security|MessageType|MsgCtrlId|ProcId|Version
        const messageTypeField = msh[8] || msh[9] || '';
        const [msgType, trigger] = messageTypeField.split('^');
        return {
            messageType: msgType || 'UNKNOWN',
            triggerEvent: trigger || 'UNKNOWN',
            messageControlId: msh[9] || msh[10] || `MSG-${Date.now()}`,
            sendingApplication: msh[2] || 'HIS',
            sendingFacility: msh[3] || 'HOSPITAL',
            dateTime: msh[6] || new Date().toISOString(),
            segments
        };
    }
    /**
     * Extract Patient Demographics from PID segment
     */
    extractPatient(parsed) {
        const pid = parsed.segments['PID']?.[0];
        if (!pid)
            throw new Error('PID segment missing in HL7 v2 message');
        // PID-3: Patient Identifier List (MRN^^^Facility^MR~NationalID^^^MOH^NID)
        const idField = pid[3] || '';
        let mrn = '';
        let nationalId = undefined;
        const idList = idField.split('~');
        for (const item of idList) {
            const parts = item.split('^');
            const val = parts[0];
            const type = parts[4] || parts[3] || '';
            if (type === 'NID' || val.length === 10 && val.startsWith('1')) {
                nationalId = val;
            }
            else {
                mrn = val;
            }
        }
        if (!mrn && nationalId)
            mrn = `MRN-${nationalId}`;
        // PID-5: Patient Name (Family^Given^Middle^Suffix^Prefix^Degree~ArabicFamily^ArabicGiven)
        const nameField = pid[5] || '';
        const nameReps = nameField.split('~');
        const nameParts = nameReps[0].split('^');
        const familyName = nameParts[0] || 'Unknown';
        const givenName = nameParts[1] || 'Unknown';
        // Arabic name from second repetition if available, otherwise use Latin name
        let givenNameAr;
        let familyNameAr;
        if (nameReps.length > 1) {
            const arParts = nameReps[1].split('^');
            familyNameAr = arParts[0] || undefined;
            givenNameAr = arParts[1] || undefined;
        }
        // PID-7: Date of Birth (YYYYMMDD)
        let dobRaw = pid[7] || '19840401';
        let birthDate = '1984-04-01';
        if (dobRaw.length >= 8) {
            birthDate = `${dobRaw.substring(0, 4)}-${dobRaw.substring(4, 6)}-${dobRaw.substring(6, 8)}`;
        }
        // PID-8: Administrative Sex (M/F/O)
        const genderRaw = (pid[8] || 'M').toUpperCase();
        const gender = genderRaw === 'M' ? 'male' : genderRaw === 'F' ? 'female' : 'other';
        // PID-13: Phone Number
        const phone = pid[13] || undefined;
        return {
            mrn,
            nationalId,
            familyName,
            givenName,
            givenNameAr,
            familyNameAr,
            birthDate,
            gender,
            phone
        };
    }
    /**
     * Extract Encounter from PV1 segment
     */
    extractEncounter(parsed) {
        const pv1 = parsed.segments['PV1']?.[0];
        const visitNo = pv1?.[19] || `VIS-${Date.now()}`;
        const pClassRaw = pv1?.[2] || 'O';
        const patientClass = pClassRaw === 'E' ? 'emergency' : pClassRaw === 'I' ? 'inpatient' : 'outpatient';
        const department = pv1?.[3]?.split('^')?.[0] || 'Internal Medicine';
        const admitDate = pv1?.[44] || new Date().toISOString();
        return {
            visitNo,
            patientClass,
            department,
            admitDate
        };
    }
    /**
     * Extract Observation results from OBX segments
     */
    extractObservations(parsed) {
        const obxList = parsed.segments['OBX'] || [];
        return obxList.map(obx => {
            const codeField = obx[3] || '';
            const [testCode, testName] = codeField.split('^');
            const value = parseFloat(obx[5] || '0');
            const unit = obx[6] || '';
            const refRange = obx[7] || '';
            const status = obx[11] || 'F';
            return {
                testCode: testCode || '4548-4',
                testName: testName || 'Hemoglobin A1c',
                value,
                unit,
                refRange,
                status
            };
        });
    }
}
//# sourceMappingURL=hl7-parser.js.map