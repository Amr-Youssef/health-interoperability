import net from 'node:net';
export declare class MllpFrameCodec {
    static encode(message: string): Buffer;
    static decode(frame: Buffer): string;
}
export interface MllpServerOptions {
    port: number;
    host?: string;
    onMessage: (message: string) => Promise<any> | any;
}
export declare function startMllpServer(options: MllpServerOptions): Promise<net.Server>;
