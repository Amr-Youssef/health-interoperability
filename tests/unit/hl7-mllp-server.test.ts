import { describe, it, expect } from 'vitest';
import net from 'node:net';
import { MllpFrameCodec, startMllpServer } from '../../src/ingestion/hl7v2/mllp-server.js';

describe('HL7 MLLP transport', () => {
  it('encodes and decodes MLLP frames correctly', () => {
    const raw = 'MSH|^~\\&|TEST|HOSP|TEST|HOSP|20240101010101||ADT^A01|MSG1|P|2.5';
    const framed = MllpFrameCodec.encode(raw);
    const decoded = MllpFrameCodec.decode(framed);
    expect(decoded).toBe(raw);
    expect(framed[0]).toBe(0x0b);
    expect(framed[framed.length - 2]).toBe(0x1c);
    expect(framed[framed.length - 1]).toBe(0x0d);
  });

  it('accepts a real TCP MLLP message and returns a processed result', async () => {
    const server = await startMllpServer({ port: 0, onMessage: async (msg) => ({ ok: true, message: msg }) });
    const port = (server.address() as net.AddressInfo).port;

    const message = 'MSH|^~\\&|APP|HOSP|APP|HOSP|20240101010101||ADT^A01|MSG2|P|2.5\r\nPID|1||1234567890^^^NID~MRN-001||Sample^Patient||19800101|M';
    const client = net.createConnection({ port }, async () => {
      client.write(MllpFrameCodec.encode(message));
    });

    const reply = await new Promise((resolve, reject) => {
      client.on('data', (chunk) => resolve(chunk));
      client.on('error', reject);
      client.setTimeout(2000, () => reject(new Error('timeout waiting for MLLP ack')));
    });

    expect(reply.length).toBeGreaterThan(0);
    server.close();
  });
});
