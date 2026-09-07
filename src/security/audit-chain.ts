import { prisma as defaultPrisma } from '../lib/prisma.js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';

export interface AuditBlock {
  index: number;
  blockId: string;
  timestamp: string;
  action: 'INGEST' | 'TRANSFORM' | 'QUERY' | 'CONSENT_CHANGE' | 'BREAK_GLASS' | 'BULK_EXPORT';
  actor: string;
  entityType: string;
  entityId: string;
  details: string;
  previousHash: string;
  currentHash: string;
}

export class CryptographicAuditChain {
  private prisma: PrismaClient;
  private genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || defaultPrisma as unknown as PrismaClient;
  }

  private async getChainLength(): Promise<number> {
    return await this.prisma.auditLog.count({ where: { old_values: { not: null } } }); // Very simplistic assumption
  }

  private static readonly CHAIN_ACTIONS = ['INGEST','TRANSFORM','QUERY','CONSENT_CHANGE','BREAK_GLASS','BULK_EXPORT','GENESIS'] as const;

  private async getLastBlock(): Promise<AuditBlock | null> {
    try {
      const last = await (this.prisma as any).auditBlock.findFirst({ orderBy: { index: 'desc' } });
      if (last) return { index: last.index, blockId: last.id, timestamp: last.timestamp.toISOString(), action: last.action as any, actor: last.actor, entityType: last.entityType, entityId: last.entityId, details: last.details, previousHash: last.previousHash, currentHash: last.currentHash };
    } catch {}
    const lastLog = await this.prisma.auditLog.findFirst({
      where: { action: { in: [...CryptographicAuditChain.CHAIN_ACTIONS] as any }, new_values: { not: null } },
      orderBy: { created_at: 'desc' }
    });
    if (!lastLog) return null;
    try {
      const parsed = JSON.parse(lastLog.new_values || '{}');
      if (parsed.index !== undefined && parsed.currentHash) {
        return { index: parsed.index, blockId: lastLog.id, timestamp: lastLog.created_at.toISOString(), action: lastLog.action as any, actor: lastLog.actor_id || 'UNKNOWN', entityType: lastLog.entity_type, entityId: lastLog.entity_id, details: lastLog.details || '', previousHash: parsed.previousHash, currentHash: parsed.currentHash };
      }
    } catch {}
    return null;
  }

  async recordEvent(
    action: 'INGEST' | 'TRANSFORM' | 'QUERY' | 'CONSENT_CHANGE' | 'BREAK_GLASS' | 'BULK_EXPORT',
    actor: string,
    entityType: string,
    entityId: string,
    details: string
  ): Promise<AuditBlock> {
    const lastBlock = await this.getLastBlock();
    
    let index = 0;
    let previousHash = this.genesisHash;

    if (lastBlock) {
      index = lastBlock.index + 1;
      previousHash = lastBlock.currentHash;
    } else {
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

    const block: AuditBlock = {
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

    try {
      await (this.prisma as any).auditBlock.create({ data: { id: blockId, index, timestamp: new Date(timestamp), action, actor, entityType, entityId, details, previousHash, currentHash } });
    } catch {
      await this.prisma.auditLog.create({ data: { id: blockId, entity_type: entityType, entity_id: entityId, action, actor_id: actor, details, new_values: JSON.stringify({ index, previousHash, currentHash }), created_at: new Date(timestamp) } });
    }
    return block;
  }

  async getRecentEvents(limit: number = 20): Promise<AuditBlock[]> {
    try {
      const blocks = await (this.prisma as any).auditBlock.findMany({ orderBy: { index: 'desc' }, take: limit });
      if (blocks.length) return blocks.map((b: any) => ({ index: b.index, blockId: b.id, timestamp: b.timestamp.toISOString(), action: b.action, actor: b.actor, entityType: b.entityType, entityId: b.entityId, details: b.details, previousHash: b.previousHash, currentHash: b.currentHash }));
    } catch {}
    const logs = await this.prisma.auditLog.findMany({
      where: { action: { in: [...CryptographicAuditChain.CHAIN_ACTIONS] as any } },
      orderBy: { created_at: 'desc' },
      take: limit
    });

    const blocks: AuditBlock[] = [];
    for (const log of logs) {
      try {
        const parsed = JSON.parse(log.new_values || '{}');
        if (parsed.currentHash) {
          blocks.push({
            index: parsed.index,
            blockId: log.id,
            timestamp: log.created_at.toISOString(),
            action: log.action as any,
            actor: log.actor_id || 'UNKNOWN',
            entityType: log.entity_type,
            entityId: log.entity_id,
            details: log.details || '',
            previousHash: parsed.previousHash,
            currentHash: parsed.currentHash
          });
        }
      } catch (e) {}
    }
    return blocks;
  }

  async verifyChainIntegrity(): Promise<{ isValid: boolean; brokenAtIndex?: number; totalBlocks: number }> {
    try {
      const ablocks = await (this.prisma as any).auditBlock.findMany({ orderBy: { index: 'asc' } });
      if (ablocks.length) {
        const blocks: AuditBlock[] = ablocks.map((b: any) => ({ index: b.index, blockId: b.id, timestamp: b.timestamp.toISOString(), action: b.action, actor: b.actor, entityType: b.entityType, entityId: b.entityId, details: b.details, previousHash: b.previousHash, currentHash: b.currentHash }));
        if (blocks.length <= 1) return { isValid: true, totalBlocks: blocks.length };
        for (let i = 1; i < blocks.length; i++) {
          const current = blocks[i]; const prev = blocks[i-1];
          if (current.previousHash !== prev.currentHash) return { isValid: false, brokenAtIndex: current.index, totalBlocks: blocks.length };
          const payload = `${current.index}:${current.blockId}:${current.timestamp}:${current.action}:${current.actor}:${current.entityType}:${current.entityId}:${current.details}:${current.previousHash}`;
          if (crypto.createHash('sha256').update(payload).digest('hex') !== current.currentHash) return { isValid: false, brokenAtIndex: current.index, totalBlocks: blocks.length };
        }
        return { isValid: true, totalBlocks: blocks.length };
      }
    } catch {}
    const logs = await this.prisma.auditLog.findMany({
      where: { action: { in: [...CryptographicAuditChain.CHAIN_ACTIONS] as any } },
      orderBy: { created_at: 'asc' }
    });

    const blocks: AuditBlock[] = [];
    for (const log of logs) {
      try {
        const parsed = JSON.parse(log.new_values || '{}');
        if (parsed.currentHash) {
          blocks.push({
            index: parsed.index,
            blockId: log.id,
            timestamp: log.created_at.toISOString(),
            action: log.action as any,
            actor: log.actor_id || 'UNKNOWN',
            entityType: log.entity_type,
            entityId: log.entity_id,
            details: log.details || '',
            previousHash: parsed.previousHash,
            currentHash: parsed.currentHash
          });
        }
      } catch (e) {}
    }

    if (blocks.length <= 1) return { isValid: true, totalBlocks: blocks.length };

    const genesisP = `0:genesis-block-0:2026-01-01T00:00:00.000Z:GENESIS:SYSTEM:PLATFORM:ROOT:${this.genesisHash}`;
    const expectedGenesisPrevHash = crypto.createHash('sha256').update(genesisP).digest('hex');

    for (let i = 1; i < blocks.length; i++) {
      const current = blocks[i];
      const prev = blocks[i - 1];
      if (current.previousHash !== prev.currentHash) {
        return { isValid: false, brokenAtIndex: current.index, totalBlocks: blocks.length };
      }

      const payload = `${current.index}:${current.blockId}:${current.timestamp}:${current.action}:${current.actor}:${current.entityType}:${current.entityId}:${current.details}:${current.previousHash}`;
      const recalculatedHash = crypto.createHash('sha256').update(payload).digest('hex');

      if (recalculatedHash !== current.currentHash) {
        return { isValid: false, brokenAtIndex: current.index, totalBlocks: blocks.length };
      }
    }

    return { isValid: true, totalBlocks: blocks.length };
  }

  async clearAll(): Promise<void> {
    try { await (this.prisma as any).auditBlock.deleteMany({}); } catch {}
    await this.prisma.auditLog.deleteMany({ where: { action: { in: [...CryptographicAuditChain.CHAIN_ACTIONS] as any } } });
  }
}
