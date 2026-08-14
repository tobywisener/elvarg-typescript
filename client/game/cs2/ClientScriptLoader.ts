import { CacheSystem } from "../../rs/cache/CacheSystem";
import { IndexType } from "../../rs/cache/IndexType";
import { type Script as Cs2Script, parseScriptFromBytes } from "../../rs/cs2/Script";

export type ClientScriptLoaderDeps = {
    getCacheSystem: () => CacheSystem;
};

/**
 * LRU-ish client script cache and on-demand loader from the DAT2 clientScript index.
 */
export class ClientScriptLoader {
    private static readonly CACHE_CAPACITY = 128;
    private readonly cache: Map<number, Cs2Script> = new Map();

    constructor(private readonly deps: ClientScriptLoaderDeps) {}

    clear(): void {
        this.cache.clear();
    }

    load(scriptId: number): Cs2Script | null {
        const cached = this.cache.get(scriptId);
        if (cached) {
            this.cache.delete(scriptId);
            this.cache.set(scriptId, cached);
            return cached;
        }

        try {
            const scriptIdx = this.deps.getCacheSystem().getIndex(IndexType.DAT2.clientScript);
            const arch = scriptIdx.getArchive(scriptId);
            const file = arch?.getFile(0);
            if (!file?.data) {
                return null;
            }

            const script = parseScriptFromBytes(
                scriptId,
                file.data,
                this.deps.getCacheSystem().decodeProfile,
            );
            this.cacheClientScript(scriptId, script);
            return script;
        } catch (e) {
            console.warn(`[Cs2Vm] Failed to load script ${scriptId}`, e);
            return null;
        }
    }

    loadIfExists(scriptId: number): Cs2Script | null {
        const cached = this.cache.get(scriptId);
        if (cached) {
            this.cache.delete(scriptId);
            this.cache.set(scriptId, cached);
            return cached;
        }

        try {
            const scriptIdx = this.deps.getCacheSystem().getIndex(IndexType.DAT2.clientScript);
            if (!scriptIdx.archiveExists(scriptId | 0)) return null;
            const arch = scriptIdx.getArchive(scriptId | 0);
            const file = arch?.getFile(0);
            if (!file?.data) return null;
            const script = parseScriptFromBytes(
                scriptId | 0,
                file.data,
                this.deps.getCacheSystem().decodeProfile,
            );
            this.cacheClientScript(scriptId | 0, script);
            return script;
        } catch {
            return null;
        }
    }

    private cacheClientScript(scriptId: number, script: Cs2Script): void {
        if (this.cache.has(scriptId)) {
            this.cache.delete(scriptId);
        }
        this.cache.set(scriptId, script);

        if (this.cache.size > ClientScriptLoader.CACHE_CAPACITY) {
            const oldestKey = this.cache.keys().next().value as number | undefined;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
    }
}
