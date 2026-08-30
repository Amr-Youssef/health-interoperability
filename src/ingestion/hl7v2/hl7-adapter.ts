import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { SourceAdapter, SourceSchemaDescriptor, AdapterStatus } from '../adapters/adapter.interface.js';
import { RawRecord } from '../../core/domain/raw-record.js';
import { Hl7v2MessageParser, ParsedHl7Message } from './hl7-parser.js';

export class Hl7v2FeedAdapter implements SourceAdapter {
  readonly sourceSystemId = 'hl7v2-mllp-feed';
  readonly sourceSystemName = 'HL7 v2.5 MLLP Network Ingestion Feed';
  readonly adapterVersion = '1.0.0';

  private parser = new Hl7v2MessageParser();
  private queuedRecords: RawRecord[] = [];

  async extractAll(batchId?: string): Promise<RawRecord[]> {
    const records = [...this.queuedRecords];
    this.queuedRecords = [];
    return records;
  }

  async extractEntity(entityType: string, batchId?: string): Promise<RawRecord[]> {
    const records = this.queuedRecords.filter(r => r.sourceEntityType === entityType);
    this.queuedRecords = this.queuedRecords.filter(r => r.sourceEntityType !== entityType);
    return records;
  }

  describeSchema(): SourceSchemaDescriptor {
    return {
      systemId: this.sourceSystemId,
      systemName: this.sourceSystemName,
      sourceType: 'hl7v2',
      entityTypes: ['hl7_patient_admission', 'hl7_lab_results'],
      fieldCatalog: {
        'hl7_patient_admission': [
          { field: 'MSH', type: 'segment', arabicLabel: 'رأس الرسالة' },
          { field: 'PID', type: 'segment', arabicLabel: 'بيانات المريض' },
          { field: 'PV1', type: 'segment', arabicLabel: 'الزيارة' }
        ],
        'hl7_lab_results': [
          { field: 'MSH', type: 'segment', arabicLabel: 'رأس الرسالة' },
          { field: 'OBR', type: 'segment', arabicLabel: 'طلب الاختبار' },
          { field: 'OBX', type: 'segment', arabicLabel: 'نتيجة الاختبار' }
        ]
      }
    };
  }

  async healthCheck(): Promise<AdapterStatus> {
    return {
      systemId: this.sourceSystemId,
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      latencyMs: 10,
      extractedRecordCount: this.queuedRecords.length,
      version: this.adapterVersion
    };
  }

  /**
   * Process incoming raw HL7 v2.x string, compute SHA-256, and produce RawRecord
   */
  processHl7Message(rawHl7: string, batchId?: string): { rawRecord: RawRecord; parsed: ParsedHl7Message } {
    const parsed = this.parser.parse(rawHl7);
    const checksum = crypto.createHash('sha256').update(rawHl7).digest('hex');
    const timestamp = new Date().toISOString();

    let entityType = 'HL7_MESSAGE';
    let payloadData: any = { rawHl7, parsed };

    if (parsed.messageType === 'ADT') {
      entityType = 'hl7_patient_admission';
      payloadData = {
        ...payloadData,
        patient: this.parser.extractPatient(parsed),
        encounter: this.parser.extractEncounter(parsed)
      };
    } else if (parsed.messageType === 'ORU') {
      entityType = 'hl7_lab_results';
      payloadData = {
        ...payloadData,
        observations: this.parser.extractObservations(parsed)
      };
    }

    const rawRecord: RawRecord = {
      id: uuidv4(),
      sourceSystemId: this.sourceSystemId,
      sourceEntityType: entityType,
      sourceRecordId: parsed.messageControlId,
      payload: payloadData,
      payloadFormat: 'json',
      checksum,
      adapterVersion: this.adapterVersion,
      ingestedAt: timestamp,
      processingStatus: 'PENDING',
      batchId: batchId || uuidv4()
    };

    this.queuedRecords.push(rawRecord);
    return { rawRecord, parsed };
  }
}
