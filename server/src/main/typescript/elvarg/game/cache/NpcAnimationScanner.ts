import { CachePipeline } from "./CachePipeline";
import { CacheIndexDat2 } from "./codec/rs/cache/CacheIndex";
import { ConfigType } from "./codec/rs/cache/ConfigType";
import { IndexType } from "./codec/rs/cache/IndexType";
import { ByteBuffer } from "./codec/rs/io/ByteBuffer";

function skipSequenceOpcode(buffer: ByteBuffer, opcode: number, revision: number): boolean {
    const skip = (length: number) => {
        if (buffer.remaining < length) return false;
        buffer.offset += length;
        return true;
    };
    if (opcode === 2 || opcode === 6 || opcode === 7) return skip(2);
    if (opcode === 4) return true;
    if ([5, 8, 9, 10, 11, 16].includes(opcode)) return skip(1);
    if (opcode === 3 || opcode === 17) {
        if (buffer.remaining < 1) return false;
        return skip(buffer.readUnsignedByte());
    }
    if (opcode === 12) {
        if (buffer.remaining < 1) return false;
        return skip(buffer.readUnsignedByte() * 4);
    }
    if (opcode === 13) {
        if (revision >= 226) return skip(4);
        if (buffer.remaining < 1) return false;
        return skip(buffer.readUnsignedByte() * 3);
    }
    if (opcode === 14) {
        if (revision < 226) return skip(4);
        if (buffer.remaining < 2) return false;
        return skip(buffer.readUnsignedShort() * 8);
    }
    if (opcode === 15) return revision >= 226 ? skip(4) : false;
    if (opcode === 18) {
        while (buffer.remaining > 0 && buffer.readUnsignedByte() !== 0) {
            // Skip the null-terminated string.
        }
        return true;
    }
    if (opcode === 100) {
        if (buffer.remaining < 1) return false;
        return skip(buffer.readUnsignedByte() * 4);
    }
    return false;
}

export function getSequenceFrameIds(data: Int8Array, revision = 237): number[] {
    const buffer = new ByteBuffer(data);
    while (buffer.remaining > 0) {
        const opcode = buffer.readUnsignedByte();
        if (opcode === 0) return [];
        if (opcode !== 1) {
            if (!skipSequenceOpcode(buffer, opcode, revision)) return [];
            continue;
        }
        if (buffer.remaining < 2) return [];
        const count = buffer.readUnsignedShort();
        if (buffer.remaining < count * 6) return [];
        buffer.offset += count * 2; // frame lengths
        const frameIds = Array.from({ length: count }, () => buffer.readUnsignedShort());
        return frameIds.map((frameId) => frameId | (buffer.readUnsignedShort() << 16));
    }
    return [];
}

export function getLastSequenceId(): number {
    const configs = CacheIndexDat2.fromStore(IndexType.DAT2.configs, CachePipeline.getStore());
    return configs.getArchive(ConfigType.DAT2.seqs).lastFileId;
}

export async function findNpcRigAnimations(baseSequenceIds: number[], minimumId: number, maximumId: number): Promise<number[]> {
    const store = CachePipeline.getStore();
    const configs = CacheIndexDat2.fromStore(IndexType.DAT2.configs, store);
    const sequences = configs.getArchive(ConfigType.DAT2.seqs);
    const frames = CacheIndexDat2.fromStore(IndexType.DAT2.animations, store);
    const skeletonForSequence = (sequenceId: number) => {
        const frameId = getSequenceFrameIds(
            sequences.getFile(sequenceId)?.data ?? new Int8Array(),
            CachePipeline.getActive().revision,
        )[0];
        if (frameId === undefined) return null;
        const frame = frames.getFile(frameId >>> 16, frameId & 0xffff)?.getDataAsBuffer();
        return frame?.readUnsignedShort() ?? null;
    };

    const skeletons = new Set(baseSequenceIds.map(skeletonForSequence).filter(Number.isInteger));
    if (skeletons.size === 0) return [];

    const known = new Set(baseSequenceIds);
    const matches: number[] = [];
    for (let id = minimumId; id <= Math.min(maximumId, sequences.lastFileId); id++) {
        if (!known.has(id) && skeletons.has(skeletonForSequence(id))) matches.push(id);
        if ((id - minimumId) % 128 === 127) {
            await new Promise<void>((resolve) => setImmediate(resolve));
        }
    }
    return matches;
}
