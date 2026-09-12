export interface GameSocket extends EventTarget {
    binaryType: BinaryType;
    readonly bufferedAmount: number;
    readonly readyState: number;
    readonly url?: string;
    send(data: ArrayBuffer | ArrayBufferView<ArrayBuffer>): void;
    close(code?: number, reason?: string): void;
    fetchContent?(path: string): Promise<unknown>;
}

export type WebRtcConnectionConfig = {
    signalUrl: string;
    worldId: string;
    iceServers: RTCIceServer[];
};
