import { v4 as uuidv4 } from 'uuid';
import { InternalPatientIdentity, DuplicateCandidate, MatchRecord } from '../core/domain/mpi-identity.js';
import { PatientIdentifier } from '../core/domain/patient-identifier.js';

export interface ResolveIdentityInput {
  sourceSystemId: string;
  nationalId?: string;
  iqamaNo?: string;
  passportNo?: string;
  mrn?: string;
  givenName?: string;
  familyName?: string;
  givenNameAr?: string;
  familyNameAr?: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
}

import fs from 'fs';
import path from 'path';

export interface ResolveIdentityResult {
  internalPatientId: string;
  isNewPatient: boolean;
  confidence: number;
  matchStrategy: string;
  linkedIdentifiersCount: number;
}

export class MasterPatientIndexService {
  private persistPath: string;
  private identities: Map<string, InternalPatientIdentity> = new Map();
  private duplicateCandidates: Map<string, DuplicateCandidate> = new Map();

  constructor(persistPath?: string | null) {
    if (persistPath === null) {
      this.persistPath = '';
    } else {
      this.persistPath = persistPath || path.resolve(process.cwd(), '.data', 'mpi-store.json');
      this.loadFromDisk();
    }
  }

  private saveToDisk(): void {
    if (!this.persistPath) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const snapshot = {
        identities: Array.from(this.identities.values()),
        duplicateCandidates: Array.from(this.duplicateCandidates.values()),
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.persistPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('⚠️ MasterPatientIndexService disk persistence warning:', err.message);
    }
  }

  private loadFromDisk(): void {
    if (!this.persistPath) return;
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf-8');
      const data = JSON.parse(raw);
      if (data.identities) {
        for (const id of data.identities) {
          this.identities.set(id.internalPatientId, id);
        }
      }
      if (data.duplicateCandidates) {
        for (const cand of data.duplicateCandidates) {
          this.duplicateCandidates.set(cand.candidateId, cand);
        }
      }
      console.log(`📂 Loaded ${this.identities.size} MPI patient identities from disk store.`);
    } catch (err: any) {
      console.warn('⚠️ MasterPatientIndexService disk load warning:', err.message);
    }
  }

  /**
   * Cleans and normalizes Arabic strings for matching
   */
  private normalizeArabic(text?: string): string {
    if (!text) return '';
    return text
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u065F]/g, '') // remove harakat
      .replace(/[إأآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ');
  }

  /**
   * Main Identity Resolution Algorithm
   */
  async resolvePatientIdentity(input: ResolveIdentityInput): Promise<ResolveIdentityResult> {
    const timestamp = new Date().toISOString();

    // 1. DETERMINISTIC MATCHING: Exact National ID match
    if (input.nationalId && input.nationalId.trim()) {
      const nid = input.nationalId.trim();
      for (const identity of this.identities.values()) {
        if (identity.status !== 'ACTIVE') continue;
        const hasMatch = identity.linkedIdentifiers.some(
          id => id.type === 'NID' && id.value.trim() === nid
        );
        if (hasMatch) {
          this.linkNewIdentifiers(identity, input, 'NID_EXACT', 1.0, timestamp);
          return {
            internalPatientId: identity.internalPatientId,
            isNewPatient: false,
            confidence: 1.0,
            matchStrategy: 'NID_EXACT',
            linkedIdentifiersCount: identity.linkedIdentifiers.length
          };
        }
      }
    }

    // 2. DETERMINISTIC MATCHING: Exact Iqama match
    if (input.iqamaNo && input.iqamaNo.trim()) {
      const iqama = input.iqamaNo.trim();
      for (const identity of this.identities.values()) {
        if (identity.status !== 'ACTIVE') continue;
        const hasMatch = identity.linkedIdentifiers.some(
          id => id.type === 'IQAMA' && id.value.trim() === iqama
        );
        if (hasMatch) {
          this.linkNewIdentifiers(identity, input, 'IQAMA_EXACT', 1.0, timestamp);
          return {
            internalPatientId: identity.internalPatientId,
            isNewPatient: false,
            confidence: 1.0,
            matchStrategy: 'IQAMA_EXACT',
            linkedIdentifiersCount: identity.linkedIdentifiers.length
          };
        }
      }
    }

    // 3. PROBABILISTIC MATCHING: Demographic Match (Name + DOB + Gender)
    const normGiven = this.normalizeArabic(input.givenNameAr || input.givenName);
    const normFamily = this.normalizeArabic(input.familyNameAr || input.familyName);
    const dob = input.birthDate;

    if (normGiven && normFamily && dob) {
      for (const identity of this.identities.values()) {
        if (identity.status !== 'ACTIVE') continue;
        const p = identity.demographicProfile;
        
        const nameMatch = (p.givenNameNormalized === normGiven && p.familyNameNormalized === normFamily);
        const dobMatch = p.birthDate === dob;
        const genderMatch = !input.gender || !p.gender || p.gender === input.gender;

        if (nameMatch && dobMatch && genderMatch) {
          this.linkNewIdentifiers(identity, input, 'DEMOGRAPHIC_EXACT', 0.95, timestamp);
          return {
            internalPatientId: identity.internalPatientId,
            isNewPatient: false,
            confidence: 0.95,
            matchStrategy: 'DEMOGRAPHIC_EXACT',
            linkedIdentifiersCount: identity.linkedIdentifiers.length
          };
        }
      }
    }

    // 4. NO MATCH FOUND: Create New Master Patient Identity
    const newInternalId = input.nationalId && input.nationalId.trim()
      ? `pat-nid-${input.nationalId.trim()}`
      : input.iqamaNo && input.iqamaNo.trim()
      ? `pat-iqama-${input.iqamaNo.trim()}`
      : uuidv4();
    const newIdentifiers: PatientIdentifier[] = [];

    if (input.nationalId) {
      newIdentifiers.push({
        value: input.nationalId.trim(),
        type: 'NID',
        system: 'urn:sa:nid',
        sourceSystemId: input.sourceSystemId,
        isActive: true,
        firstSeenAt: timestamp
      });
    }

    if (input.iqamaNo) {
      newIdentifiers.push({
        value: input.iqamaNo.trim(),
        type: 'IQAMA',
        system: 'urn:sa:iqama',
        sourceSystemId: input.sourceSystemId,
        isActive: true,
        firstSeenAt: timestamp
      });
    }

    if (input.mrn) {
      newIdentifiers.push({
        value: input.mrn.trim(),
        type: 'MRN',
        system: `urn:${input.sourceSystemId}:mrn`,
        sourceSystemId: input.sourceSystemId,
        isActive: true,
        firstSeenAt: timestamp
      });
    }

    const newIdentity: InternalPatientIdentity = {
      internalPatientId: newInternalId,
      status: 'ACTIVE',
      linkedIdentifiers: newIdentifiers,
      demographicProfile: {
        givenNameNormalized: normGiven,
        familyNameNormalized: normFamily,
        birthDate: input.birthDate || '',
        gender: input.gender || '',
        phoneNormalized: input.phone?.replace(/\D/g, '')
      },
      matchHistory: [
        {
          matchStrategy: 'MANUAL',
          confidence: 1.0,
          matchedAt: timestamp,
          matchedBy: 'SYSTEM_INITIAL_INGEST',
          decision: 'AUTO_LINKED',
          details: `Initial identity created from source system [${input.sourceSystemId}]`
        }
      ],
      createdAt: timestamp,
      lastUpdatedAt: timestamp
    };

    this.identities.set(newInternalId, newIdentity);
    this.saveToDisk();

    return {
      internalPatientId: newInternalId,
      isNewPatient: true,
      confidence: 1.0,
      matchStrategy: 'INITIAL_REGISTRATION',
      linkedIdentifiersCount: newIdentifiers.length
    };
  }

  private linkNewIdentifiers(
    identity: InternalPatientIdentity,
    input: ResolveIdentityInput,
    strategy: any,
    confidence: number,
    timestamp: string
  ) {
    // Add MRN if not present
    if (input.mrn) {
      const exists = identity.linkedIdentifiers.some(
        id => id.type === 'MRN' && id.value === input.mrn && id.sourceSystemId === input.sourceSystemId
      );
      if (!exists) {
        identity.linkedIdentifiers.push({
          value: input.mrn.trim(),
          type: 'MRN',
          system: `urn:${input.sourceSystemId}:mrn`,
          sourceSystemId: input.sourceSystemId,
          isActive: true,
          firstSeenAt: timestamp
        });
      }
    }

    // Add NID if not present
    if (input.nationalId) {
      const exists = identity.linkedIdentifiers.some(
        id => id.type === 'NID' && id.value === input.nationalId
      );
      if (!exists) {
        identity.linkedIdentifiers.push({
          value: input.nationalId.trim(),
          type: 'NID',
          system: 'urn:sa:nid',
          sourceSystemId: input.sourceSystemId,
          isActive: true,
          firstSeenAt: timestamp
        });
      }
    }

    // Record in match history
    identity.matchHistory.push({
      matchedIdentifier: input.nationalId || input.iqamaNo || input.mrn,
      matchStrategy: strategy,
      confidence,
      matchedAt: timestamp,
      matchedBy: 'MPI_MATCH_ENGINE',
      decision: 'AUTO_LINKED',
      details: `Matched and linked record from source [${input.sourceSystemId}] with MRN [${input.mrn || 'N/A'}]`
    });

    identity.lastUpdatedAt = timestamp;
    this.identities.set(identity.internalPatientId, identity);
    this.saveToDisk();
  }

  async getIdentity(internalPatientId: string): Promise<InternalPatientIdentity | null> {
    const id = this.identities.get(internalPatientId);
    return id ? { ...id } : null;
  }

  async findByIdentifier(type: string, value: string): Promise<InternalPatientIdentity | null> {
    for (const identity of this.identities.values()) {
      if (identity.status !== 'ACTIVE') continue;
      const match = identity.linkedIdentifiers.some(
        id => id.type.toLowerCase() === type.toLowerCase() && id.value === value
      );
      if (match) return { ...identity };
    }
    return null;
  }

  async getAllIdentities(): Promise<InternalPatientIdentity[]> {
    return Array.from(this.identities.values()).map(id => ({ ...id }));
  }

  /**
   * Deterministic / Probabilistic Patient Identity Merge
   * Links all identifiers from obsolete identity into survivor identity and marks obsolete as MERGED.
   */
  async mergePatientIdentities(
    survivorId: string,
    obsoleteId: string,
    reason: string,
    adminUser: string = 'HIE_ADMIN'
  ): Promise<{ success: boolean; survivor: InternalPatientIdentity; obsolete: InternalPatientIdentity }> {
    const survivor = this.identities.get(survivorId);
    const obsolete = this.identities.get(obsoleteId);

    if (!survivor) throw new Error(`Survivor identity [${survivorId}] not found.`);
    if (!obsolete) throw new Error(`Obsolete identity [${obsoleteId}] not found.`);
    if (survivorId === obsoleteId) throw new Error('Cannot merge an identity into itself.');

    const timestamp = new Date().toISOString();

    // 1. Move/Copy unique identifiers from obsolete to survivor
    for (const obsId of obsolete.linkedIdentifiers) {
      const alreadyPresent = survivor.linkedIdentifiers.some(
        s => s.type === obsId.type && s.value === obsId.value && s.sourceSystemId === obsId.sourceSystemId
      );
      if (!alreadyPresent) {
        survivor.linkedIdentifiers.push({
          ...obsId,
          isActive: true
        });
      }
    }

    // 2. Record merge match audit in survivor match history
    survivor.matchHistory.push({
      matchStrategy: 'MANUAL',
      confidence: 1.0,
      matchedAt: timestamp,
      matchedBy: adminUser,
      decision: 'MANUAL_LINKED',
      details: `Merged obsolete identity [${obsoleteId}] into [${survivorId}]. Reason: ${reason}`
    });
    survivor.lastUpdatedAt = timestamp;

    // 3. Mark obsolete identity as MERGED
    obsolete.status = 'MERGED';
    obsolete.mergedInto = survivorId;
    obsolete.lastUpdatedAt = timestamp;
    obsolete.matchHistory.push({
      matchStrategy: 'MANUAL',
      confidence: 1.0,
      matchedAt: timestamp,
      matchedBy: adminUser,
      decision: 'MANUAL_LINKED',
      details: `Identity merged into [${survivorId}] by [${adminUser}]. Reason: ${reason}`
    });

    this.identities.set(survivorId, survivor);
    this.identities.set(obsoleteId, obsolete);
    this.saveToDisk();

    return {
      success: true,
      survivor: { ...survivor },
      obsolete: { ...obsolete }
    };
  }

  /**
   * Unmerge previously merged identities
   */
  async unmergePatientIdentities(
    survivorId: string,
    obsoleteId: string,
    reason: string,
    adminUser: string = 'HIE_ADMIN'
  ): Promise<{ success: boolean; survivor: InternalPatientIdentity; restored: InternalPatientIdentity }> {
    const survivor = this.identities.get(survivorId);
    const obsolete = this.identities.get(obsoleteId);

    if (!survivor) throw new Error(`Survivor identity [${survivorId}] not found.`);
    if (!obsolete) throw new Error(`Obsolete identity [${obsoleteId}] not found.`);
    if (obsolete.status !== 'MERGED' || obsolete.mergedInto !== survivorId) {
      throw new Error(`Identity [${obsoleteId}] is not merged into [${survivorId}].`);
    }

    const timestamp = new Date().toISOString();

    // 1. Restore obsolete identity to ACTIVE
    obsolete.status = 'ACTIVE';
    delete obsolete.mergedInto;
    obsolete.lastUpdatedAt = timestamp;
    obsolete.matchHistory.push({
      matchStrategy: 'MANUAL',
      confidence: 1.0,
      matchedAt: timestamp,
      matchedBy: adminUser,
      decision: 'AUTO_LINKED',
      details: `Identity unmerged and restored from [${survivorId}]. Reason: ${reason}`
    });

    // 2. Audit in survivor
    survivor.lastUpdatedAt = timestamp;
    survivor.matchHistory.push({
      matchStrategy: 'MANUAL',
      confidence: 1.0,
      matchedAt: timestamp,
      matchedBy: adminUser,
      decision: 'REJECTED',
      details: `Unmerged identity [${obsoleteId}] from [${survivorId}]. Reason: ${reason}`
    });

    this.identities.set(survivorId, survivor);
    this.identities.set(obsoleteId, obsolete);
    this.saveToDisk();

    return {
      success: true,
      survivor: { ...survivor },
      restored: { ...obsolete }
    };
  }

  /**
   * Scans active identities to detect potential duplicate patient candidates for stewardship review
   */
  async findDuplicateCandidates(): Promise<DuplicateCandidate[]> {
    const activeIdentities = Array.from(this.identities.values()).filter(i => i.status === 'ACTIVE');
    const candidates: DuplicateCandidate[] = [];

    for (let i = 0; i < activeIdentities.length; i++) {
      for (let j = i + 1; j < activeIdentities.length; j++) {
        const p1 = activeIdentities[i];
        const p2 = activeIdentities[j];

        const d1 = p1.demographicProfile;
        const d2 = p2.demographicProfile;

        // Calculate demographic scores
        let nameScore = 0;
        if (d1.givenNameNormalized && d2.givenNameNormalized && d1.familyNameNormalized && d2.familyNameNormalized) {
          const givenMatch = d1.givenNameNormalized === d2.givenNameNormalized ? 0.5 : 0;
          const familyMatch = d1.familyNameNormalized === d2.familyNameNormalized ? 0.5 : 0;
          nameScore = givenMatch + familyMatch;
        }

        const dobScore = (d1.birthDate && d2.birthDate && d1.birthDate === d2.birthDate) ? 1.0 : 0;
        const genderScore = (d1.gender && d2.gender && d1.gender === d2.gender) ? 1.0 : 0;
        const phoneScore = (d1.phoneNormalized && d2.phoneNormalized && d1.phoneNormalized === d2.phoneNormalized) ? 1.0 : 0;

        const totalConfidence = (nameScore * 0.4) + (dobScore * 0.3) + (genderScore * 0.1) + (phoneScore * 0.2);

        if (totalConfidence >= 0.70) {
          candidates.push({
            id: `DUP-${p1.internalPatientId.substring(0, 4)}-${p2.internalPatientId.substring(0, 4)}`,
            patientId1: p1.internalPatientId,
            patientId2: p2.internalPatientId,
            confidence: Math.round(totalConfidence * 100) / 100,
            scoreBreakdown: {
              nameScore,
              dobScore,
              genderScore,
              phoneScore
            },
            status: 'PENDING_REVIEW',
            flaggedAt: new Date().toISOString()
          });
        }
      }
    }

    return candidates;
  }

  async clearAll(): Promise<void> {
    this.identities.clear();
    this.duplicateCandidates.clear();
    this.saveToDisk();
  }
}
