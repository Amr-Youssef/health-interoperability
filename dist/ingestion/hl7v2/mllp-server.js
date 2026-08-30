import net from 'node:net';
export class MllpFrameCodec {
    static encode(message) {
        const clean = message.replace(/\r/g, '');
        return Buffer.from([0x0b, ...Buffer.from(clean), 0x1c, 0x0d]);
    }
    static decode(frame) {
        if (frame.length < 4)
            return frame.toString();
        const body = frame.subarray(1, frame.length - 2);
        return body.toString('utf8');
    }
}
export async function startMllpServer(options) {
    const host = options.host || '127.0.0.1';
    const server = net.createServer(async (socket) => {
        let buffer = Buffer.alloc(0);
        socket.on('data', async (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            while (buffer.length >= 4) {
                const start = buffer[0];
                const end = buffer[buffer.length - 2];
                if (start !== 0x0b || end !== 0x1c) {
                    buffer = buffer.subarray(1);
                    continue;
                }
                const frameEnd = buffer.lastIndexOf(Buffer.from([0x1c, 0x0d]));
                if (frameEnd === -1)
                    break;
                const frame = buffer.subarray(0, frameEnd + 2);
                const msg = MllpFrameCodec.decode(frame);
                const result = await options.onMessage(msg);
                socket.write(Buffer.from([0x0b, ...Buffer.from(JSON.stringify(result)), 0x1c, 0x0d]));
                buffer = buffer.subarray(frameEnd + 2);
            }
        });
    });
    return await new Promise((resolve) => {
        server.listen(options.port, host, () => resolve(server));
    });
}
//# sourceMappingURL=mllp-server.js.map