import { Sector } from "../store/Sector";
import { GroupSpan, SparseMemoryStore } from "../store/SparseMemoryStore";
import { validatePartialContentResponse } from "./HttpRange";

export type RangeFetchedListener = (byteOffset: number, bytes: Uint8Array) => void;

type PendingGroup = {
    span: GroupSpan;
    urgent: boolean;
    inFlight: boolean;
    resolve: () => void;
    reject: (err: unknown) => void;
    promise: Promise<void>;
};

type FetchBatch = { groups: PendingGroup[]; start: number; end: number };

function groupKey(span: GroupSpan): string {
    return span.indexId + ":" + span.archiveId;
}

/**
 * Fetches individual cache groups on demand with HTTP Range requests into the
 * statically-hosted dat2 file, the web equivalent of the js5 update protocol.
 * Misses reported by the SparseMemoryStore are queued, batched (adjacent
 * groups coalesce into one Range request), fetched concurrently, written into
 * the sparse buffer and announced to listeners (persistence, worker sync).
 */
export class Js5RangeClient {
    /** Merge queued groups whose spans are within this many bytes of each other. */
    private static readonly MERGE_GAP_BYTES = 256 * Sector.SIZE;
    private static readonly MAX_BATCH_BYTES = 2 * 1024 * 1024;
    /** One miss warms a 260KiB sector-aligned block to avoid RTT-bound tiny reads. */
    private static readonly BLOCK_SECTORS = 512;
    /** Delay before dispatching, letting one frame's misses batch together. */
    private static readonly BATCH_DELAY_MS = 10;

    private readonly pending = new Map<string, PendingGroup>();
    private readonly fetchedListeners: RangeFetchedListener[] = [];
    private activeFetches = 0;
    private downloadedBytes = 0;

    getProgress(): { pending: number; active: number; downloadedBytes: number } {
        return { pending: this.pending.size, active: this.activeFetches, downloadedBytes: this.downloadedBytes };
    }
    private readonly inFlightRanges: Array<{ start: number; end: number }> = [];
    private scheduled = false;

    rangeUnsupported = false;
    onRangeUnsupported?: () => void;

    constructor(
        readonly dat2Url: string,
        readonly store: SparseMemoryStore,
        private readonly maxConcurrent: number = 6,
    ) {
        store.onMiss = (span) => {
            this.requestSpan(span, true);
        };
    }

    onFetched(listener: RangeFetchedListener): void {
        this.fetchedListeners.push(listener);
    }

    /** Resolves once the group's data is available locally. */
    requestGroup(indexId: number, archiveId: number, urgent: boolean = true): Promise<void> {
        if (this.store.isGroupPresent(indexId, archiveId)) {
            return Promise.resolve();
        }
        const span = this.store.getGroupSpan(indexId, archiveId);
        if (!span) {
            return Promise.resolve();
        }
        return this.requestSpan(span, urgent);
    }

    /** Resolves once every currently-queued group fetch has finished. */
    async settled(timeoutMs: number = 30000): Promise<void> {
        const deadline = performance.now() + timeoutMs;
        while (this.pending.size > 0 && !this.rangeUnsupported) {
            const remaining = deadline - performance.now();
            if (remaining <= 0) {
                console.warn(`[js5] Timed out waiting for ${this.pending.size} group fetches`);
                return;
            }
            const inFlight = Array.from(this.pending.values(), (group) => group.promise);
            await Promise.race([
                Promise.allSettled(inFlight),
                new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 1000))),
            ]);
        }
    }

    private requestSpan(span: GroupSpan, urgent: boolean): Promise<void> {
        if (this.rangeUnsupported) {
            // Nothing will ever service the queue; fail fast instead of
            // handing out a promise that never settles.
            const rejected = Promise.reject<void>(
                new Error("js5 disabled: server does not support Range requests"),
            );
            rejected.catch(() => {});
            return rejected;
        }
        const key = groupKey(span);
        const existing = this.pending.get(key);
        if (existing) {
            if (urgent) {
                existing.urgent = true;
            }
            return existing.promise;
        }
        let resolve!: () => void;
        let reject!: (err: unknown) => void;
        const promise = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        // Many callers fire-and-forget; keep failed fetches from surfacing as
        // unhandled rejections while still rejecting for callers that await.
        promise.catch(() => {});
        this.pending.set(key, { span, urgent, inFlight: false, resolve, reject, promise });
        this.schedule();
        return promise;
    }

    private schedule(): void {
        if (this.scheduled || this.rangeUnsupported) {
            return;
        }
        this.scheduled = true;
        setTimeout(() => {
            this.scheduled = false;
            this.tick();
        }, Js5RangeClient.BATCH_DELAY_MS);
    }

    private tick(): void {
        while (this.activeFetches < this.maxConcurrent) {
            const batch = this.takeNextBatch();
            if (!batch) {
                break;
            }
            this.fetchBatch(batch);
        }
    }

    private takeNextBatch(): FetchBatch | undefined {
        const waiting: PendingGroup[] = [];
        for (const group of this.pending.values()) {
            if (!group.inFlight) {
                // A neighbouring batch may already have downloaded this group.
                if (this.store.isGroupPresent(group.span.indexId, group.span.archiveId)) {
                    this.finishGroup(group);
                    continue;
                }
                waiting.push(group);
            }
        }
        if (waiting.length === 0) {
            return undefined;
        }
        waiting.sort((a, b) => a.span.startByte - b.span.startByte);

        const seedIndices = [
            ...waiting.map((group, index) => group.urgent ? index : -1).filter((index) => index >= 0),
            ...waiting.map((group, index) => group.urgent ? -1 : index).filter((index) => index >= 0),
        ];
        for (const seedIndex of seedIndices) {
            const groups = [waiting[seedIndex]];
            let start = waiting[seedIndex].span.startByte;
            let end = start + waiting[seedIndex].span.byteLength;
            for (let i = seedIndex + 1; i < waiting.length; i++) {
                const span = waiting[i].span;
                if (span.startByte - end > Js5RangeClient.MERGE_GAP_BYTES) break;
                const nextEnd = Math.max(end, span.startByte + span.byteLength);
                if (nextEnd - start > Js5RangeClient.MAX_BATCH_BYTES) break;
                end = nextEnd;
                groups.push(waiting[i]);
            }
            for (let i = seedIndex - 1; i >= 0; i--) {
                const span = waiting[i].span;
                if (start - (span.startByte + span.byteLength) > Js5RangeClient.MERGE_GAP_BYTES) break;
                if (end - span.startByte > Js5RangeClient.MAX_BATCH_BYTES) break;
                start = Math.min(start, span.startByte);
                groups.push(waiting[i]);
            }
            const range = this.expandToBlock(start, end);
            if (this.inFlightRanges.some((active) => range.start < active.end && active.start < range.end)) {
                continue;
            }
            for (const group of groups) group.inFlight = true;
            this.inFlightRanges.push(range);
            return { groups, ...range };
        }
        return undefined;
    }

    private expandToBlock(start: number, end: number): { start: number; end: number } {
        const blockBytes = Js5RangeClient.BLOCK_SECTORS * Sector.SIZE;
        return {
            start: Math.floor(start / blockBytes) * blockBytes,
            end: Math.min(Math.ceil(end / blockBytes) * blockBytes, this.store.dataFile.byteLength),
        };
    }

    private async fetchBatch(batch: FetchBatch): Promise<void> {
        this.activeFetches++;
        const startedAt = performance.now();
        const params = new URLSearchParams(globalThis.location?.search);
        const profile = params.get("map-profile") === "1";
        try {
            const bytes = await this.fetchRange(batch.start, batch.end - batch.start);
            this.downloadedBytes += bytes.byteLength;
            this.store.applyRange(batch.start, bytes);
            this.notifyFetched(batch.start, bytes);
            if (profile) console.info(`[js5-profile] range groups=${batch.groups.length} bytes=${bytes.byteLength} elapsed=${Math.round(performance.now() - startedAt)}ms pending=${this.pending.size} active=${this.activeFetches}`);
            for (const group of batch.groups) {
                this.finishGroup(group);
            }
        } catch (e) {
            for (const group of batch.groups) {
                this.pending.delete(groupKey(group.span));
                group.reject(e);
            }
            if (!this.rangeUnsupported) {
                console.warn("[js5] Range fetch failed:", e);
            }
        } finally {
            this.activeFetches--;
            const rangeIndex = this.inFlightRanges.findIndex((range) => range.start === batch.start && range.end === batch.end);
            if (rangeIndex >= 0) this.inFlightRanges.splice(rangeIndex, 1);
            for (const group of this.pending.values()) {
                if (!group.inFlight) {
                    this.schedule();
                    break;
                }
            }
        }
    }

    private finishGroup(group: PendingGroup): void {
        const key = groupKey(group.span);
        if (!this.isChainContiguous(group.span)) {
            console.warn(
                `[js5] Fragmented group ${key}, falling back to chain-following fetch`,
            );
            this.fetchGroupByChain(group);
            return;
        }
        if (!this.store.isGroupPresent(group.span.indexId, group.span.archiveId)) {
            this.pending.delete(key);
            group.reject(new Error(`js5 fetch did not cover group ${key}`));
            return;
        }
        this.pending.delete(key);
        group.resolve();
    }

    /**
     * Verify the group's sectors form the contiguous run the presence check
     * assumes. Caches are packed contiguously; this guards against a future
     * fragmented repack silently corrupting reads.
     */
    private isChainContiguous(span: GroupSpan): boolean {
        const u8 = new Uint8Array(this.store.dataFile);
        const nextSectorOffset = span.archiveId > 0xffff ? 6 : 4;
        let sector = span.startSector;
        for (let i = 0; i < span.sectorCount - 1; i++) {
            const base = sector * Sector.SIZE + nextSectorOffset;
            if (base + 3 > u8.byteLength) {
                return false;
            }
            const next = (u8[base] << 16) | (u8[base + 1] << 8) | u8[base + 2];
            if (next !== sector + 1) {
                return false;
            }
            sector++;
        }
        return true;
    }

    /** Rare fallback: follow the sector chain with per-sector Range requests. */
    private async fetchGroupByChain(group: PendingGroup): Promise<void> {
        const { span } = group;
        const key = groupKey(span);
        const extended = span.archiveId > 0xffff;
        const headerSize = extended ? Sector.EXTENDED_HEADER_SIZE : Sector.HEADER_SIZE;
        const dataPerSector = extended ? Sector.EXTENDED_DATA_SIZE : Sector.DATA_SIZE;
        const nextSectorOffset = extended ? 6 : 4;
        try {
            const data = new Int8Array(span.dataSize);
            let sector = span.startSector;
            let offset = 0;
            while (offset < span.dataSize) {
                if (sector <= 0) {
                    throw new Error(`Broken sector chain for group ${key}`);
                }
                const take = Math.min(dataPerSector, span.dataSize - offset);
                const bytes = await this.fetchRange(sector * Sector.SIZE, headerSize + take);
                if (bytes.byteLength < headerSize + take) {
                    throw new Error(`Short sector read for group ${key}`);
                }
                data.set(
                    new Int8Array(bytes.buffer, bytes.byteOffset + headerSize, take),
                    offset,
                );
                offset += take;
                sector =
                    (bytes[nextSectorOffset] << 16) |
                    (bytes[nextSectorOffset + 1] << 8) |
                    bytes[nextSectorOffset + 2];
            }
            this.store.setOverride(span.indexId, span.archiveId, data);
            this.pending.delete(key);
            group.resolve();
        } catch (e) {
            this.pending.delete(key);
            group.reject(e);
        }
    }

    private async fetchRange(start: number, length: number): Promise<Uint8Array> {
        const end = Math.min(start + length, this.store.dataFile.byteLength);
        const resp = await fetch(this.dat2Url, {
            headers: { Range: `bytes=${start}-${end - 1}` },
        });
        if (resp.status === 200) {
            // Server ignored the Range header; on-demand loading can't work.
            try {
                resp.body?.cancel();
            } catch {}
            throw this.disableRangeRequests("Server does not support Range requests");
        }
        if (resp.status !== 206) {
            throw new Error(`Failed range fetch ${this.dat2Url} (${start}-${end}): ${resp.status}`);
        }
        try {
            validatePartialContentResponse(resp, start, end, this.dat2Url);
        } catch (error) {
            try {
                resp.body?.cancel();
            } catch {}
            const message = error instanceof Error ? error.message : String(error);
            throw this.disableRangeRequests(message);
        }
        const bytes = new Uint8Array(await resp.arrayBuffer());
        if (bytes.byteLength !== end - start) {
            throw new Error(
                `Truncated range fetch ${this.dat2Url} (${start}-${end}): ` +
                    `received ${bytes.byteLength} of ${end - start} bytes`,
            );
        }
        return bytes;
    }

    private disableRangeRequests(reason: string): Error {
        const error = new Error(`js5 disabled: ${reason}`);
        if (this.rangeUnsupported) {
            return error;
        }
        this.rangeUnsupported = true;
        // Fail queued-but-undispatched groups; nothing will service them.
        for (const [key, group] of this.pending) {
            if (!group.inFlight) {
                this.pending.delete(key);
                group.reject(error);
            }
        }
        this.onRangeUnsupported?.();
        return error;
    }

    private notifyFetched(byteOffset: number, bytes: Uint8Array): void {
        for (const listener of this.fetchedListeners) {
            try {
                listener(byteOffset, bytes);
            } catch (e) {
                console.warn("[js5] Fetch listener failed:", e);
            }
        }
    }
}
