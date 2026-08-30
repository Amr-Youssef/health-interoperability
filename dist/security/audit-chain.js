import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
export class CryptographicAuditChain {
    persistPath;
    chain = [];
    genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
    constructor(persistPath) {
        if (persistPath === null) {
            this.persistPath = '';
            this.createGenesisBlock();
        }
        else {
            this.persistPath = persistPath || path.resolve(process.cwd(), '.data', 'audit-chain.json');
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
            fs.writeFileSync(this.persistPath, JSON.stringify(this.chain, null, 2), 'utf-8');
        }
        catch (err) {
            console.warn('⚠️ CryptographicAuditChain disk persistence warning:', err.message);
        }
    }
    loadFromDisk() {
        if (!this.persistPath)
            return;
        try {
            if (fs.existsSync(this.persistPath)) {
                const raw = fs.readFileSync(this.persistPath, 'utf-8');
                const blocks = JSON.parse(raw);
                if (blocks.length > 0) {
                    this.chain = blocks;
                    console.log(`📂 Loaded ${this.chain.length} cryptographic audit blocks from disk.`);
                    return;
                }
            }
        }
        catch (err) {
            console.warn('⚠️ CryptographicAuditChain disk load warning:', err.message);
        }
        this.createGenesisBlock();
    }
    createGenesisBlock() {
        const timestamp = '2026-01-01T00:00:00.000Z';
        const blockId = 'genesis-block-0';
        const payload = `0:${blockId}:${timestamp}:GENESIS:SYSTEM:PLATFORM:ROOT:${this.genesisHash}`;
        const currentHash = crypto.createHash('sha256').update(payload).digest('hex');
        this.chain.push({
            index: 0,
            blockId,
            timestamp,
            action: 'INGEST',
            actor: 'SYSTEM_BOOTSTRAP',
            entityType: 'SaudiNationalHealthInteroperabilityEngine',
            entityId: 'ROOT',
            details: 'Genesis audit block initialized with SHA-256 cryptographic chaining (NCA Compliant).',
            previousHash: this.genesisHash,
            currentHash
        });
        this.saveToDisk();
    }
    recordEvent(action, actor, entityType, entityId, details) {
        const index = this.chain.length;
        const blockId = uuidv4();
        const timestamp = new Date().toISOString();
        const previousHash = this.chain[this.chain.length - 1].currentHash;
        const payload = `${index}:${blockId}:${timestamp}:${action}:${actor}:${entityType}:${entityId}:${details}:${previousHash}`;
        const currentHash = crypto.createHash('sha256').update(payload).digest('hex');
        const block = {
            index,
            blockId,
            timestamp,
            action,
            actor,
            entityType,
            entityId,
            details,
            previousHash,
            currentHash
        };
        this.chain.push(block);
        this.saveToDisk();
        return block;
    }
    getChain() {
        return [...this.chain];
    }
    getRecentEvents(limit = 20) {
        return [...this.chain].slice(-limit).reverse();
    }
    verifyChainIntegrity() {
        for (let i = 1; i < this.chain.length; i++) {
            const current = this.chain[i];
            const prev = this.chain[i - 1];
            // 1. Verify previous hash pointer
            if (current.previousHash !== prev.currentHash) {
                return { isValid: false, brokenAtIndex: i, totalBlocks: this.chain.length };
            }
            // 2. Re-calculate current block hash
            const payload = `${current.index}:${current.blockId}:${current.timestamp}:${current.action}:${current.actor}:${current.entityType}:${current.entityId}:${current.details}:${current.previousHash}`;
            const recalculatedHash = crypto.createHash('sha256').update(payload).digest('hex');
            if (recalculatedHash !== current.currentHash) {
                return { isValid: false, brokenAtIndex: i, totalBlocks: this.chain.length };
            }
        }
        return { isValid: true, totalBlocks: this.chain.length };
    }
    clearAll() {
        this.chain = [];
        this.createGenesisBlock();
        this.saveToDisk();
    }
}
//# sourceMappingURL=audit-chain.js.map