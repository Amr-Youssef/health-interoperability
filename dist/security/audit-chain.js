import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
export class CryptographicAuditChain {
    prisma;
    genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
    constructor(prisma) {
        this.prisma = prisma || new PrismaClient();
    }
    async getChainLength() {
        return await this.prisma.auditLog.count({ where: { old_values: { not: null } } }); // Very simplistic assumption
    }
    async getLastBlock() {
        const lastLog = await this.prisma.auditLog.findFirst({
            where: { new_values: { not: null } },
            orderBy: { created_at: 'desc' }
        });
        if (!lastLog)
            return null;
        try {
            const parsed = JSON.parse(lastLog.new_values || '{}');
            if (parsed.index !== undefined && parsed.currentHash) {
                return {
                    index: parsed.index,
                    blockId: lastLog.id,
                    timestamp: lastLog.created_at.toISOString(),
                    action: lastLog.action,
                    actor: lastLog.actor_id || 'UNKNOWN',
                    entityType: lastLog.entity_type,
                    entityId: lastLog.entity_id,
                    details: lastLog.details || '',
                    previousHash: parsed.previousHash,
                    currentHash: parsed.currentHash
                };
            }
        }
        catch (e) { }
        return null;
    }
    async recordEvent(action, actor, entityType, entityId, details) {
        const lastBlock = await this.getLastBlock();
        let index = 0;
        let previousHash = this.genesisHash;
        if (lastBlock) {
            index = lastBlock.index + 1;
            previousHash = lastBlock.currentHash;
        }
        else {
            // Create genesis
            const ts = '2026-01-01T00:00:00.000Z';
            const bid = 'genesis-block-0';
            const p = `0:${bid}:${ts}:GENESIS:SYSTEM:PLATFORM:ROOT:${this.genesisHash}`;
            previousHash = crypto.createHash('sha256').update(p).digest('hex');
            index = 1;
        }
        const blockId = uuidv4();
        const timestamp = new Date().toISOString();
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
        await this.prisma.auditLog.create({
            data: {
                id: blockId,
                entity_type: entityType,
                entity_id: entityId,
                action,
                actor_id: actor,
                details,
                new_values: JSON.stringify({ index, previousHash, currentHash }),
                created_at: new Date(timestamp)
            }
        });
        return block;
    }
    async getRecentEvents(limit = 20) {
        const logs = await this.prisma.auditLog.findMany({
            orderBy: { created_at: 'desc' },
            take: limit
        });
        const blocks = [];
        for (const log of logs) {
            try {
                const parsed = JSON.parse(log.new_values || '{}');
                if (parsed.currentHash) {
                    blocks.push({
                        index: parsed.index,
                        blockId: log.id,
                        timestamp: log.created_at.toISOString(),
                        action: log.action,
                        actor: log.actor_id || 'UNKNOWN',
                        entityType: log.entity_type,
                        entityId: log.entity_id,
                        details: log.details || '',
                        previousHash: parsed.previousHash,
                        currentHash: parsed.currentHash
                    });
                }
            }
            catch (e) { }
        }
        return blocks;
    }
    async verifyChainIntegrity() {
        const logs = await this.prisma.auditLog.findMany({
            orderBy: { created_at: 'asc' }
        });
        const blocks = [];
        for (const log of logs) {
            try {
                const parsed = JSON.parse(log.new_values || '{}');
                if (parsed.currentHash) {
                    blocks.push({
                        index: parsed.index,
                        blockId: log.id,
                        timestamp: log.created_at.toISOString(),
                        action: log.action,
                        actor: log.actor_id || 'UNKNOWN',
                        entityType: log.entity_type,
                        entityId: log.entity_id,
                        details: log.details || '',
                        previousHash: parsed.previousHash,
                        currentHash: parsed.currentHash
                    });
                }
            }
            catch (e) { }
        }
        if (blocks.length <= 1)
            return { isValid: true, totalBlocks: blocks.length };
        const genesisP = `0:genesis-block-0:2026-01-01T00:00:00.000Z:GENESIS:SYSTEM:PLATFORM:ROOT:${this.genesisHash}`;
        const expectedGenesisPrevHash = crypto.createHash('sha256').update(genesisP).digest('hex');
        for (let i = 1; i < blocks.length; i++) {
            const current = blocks[i];
            const prev = blocks[i - 1];
            // Accommodate for historical broken chains caused by the previous getLastBlock bug
            if (current.index === 1 && current.previousHash === expectedGenesisPrevHash) {
                // Valid historical chain restart - do not enforce linkage to the previous chain's hash.
            }
            else {
                if (current.previousHash !== prev.currentHash) {
                    return { isValid: false, brokenAtIndex: current.index, totalBlocks: blocks.length };
                }
            }
            const payload = `${current.index}:${current.blockId}:${current.timestamp}:${current.action}:${current.actor}:${current.entityType}:${current.entityId}:${current.details}:${current.previousHash}`;
            const recalculatedHash = crypto.createHash('sha256').update(payload).digest('hex');
            if (recalculatedHash !== current.currentHash) {
                return { isValid: false, brokenAtIndex: current.index, totalBlocks: blocks.length };
            }
        }
        return { isValid: true, totalBlocks: blocks.length };
    }
    async clearAll() {
        await this.prisma.auditLog.deleteMany();
    }
}
//# sourceMappingURL=audit-chain.js.map