import { StringUtil } from "../util/StringUtil";
import { ApiType } from "./ApiType";
import { Archive } from "./Archive";
import type { CacheDecodeProfile } from "./CacheDecodeProfile";
import { resolveCacheDecodeProfile } from "./CacheDecodeProfile";
import { CacheFiles } from "./CacheFiles";
import type { CacheInfo } from "./CacheInfo";
import { CacheIndex, CacheIndexDat, CacheIndexDat2, LegacyCacheIndex } from "./CacheIndex";
import { detectCacheType } from "./CacheType";
import { IndexType } from "./IndexType";
import { PresenceBitset } from "./js5/PresenceBitset";
import { MemoryStore } from "./store/MemoryStore";
import { SparseMemoryStore } from "./store/SparseMemoryStore";

export class CacheSystem<A extends ApiType = ApiType.SYNC> {
    static loadIndicesFromStore(cacheType: "dat" | "dat2", store: MemoryStore) {
        return store.indexFiles.map((indexFile, id) => {
            if (!indexFile) {
                return undefined;
            }
            if (cacheType === "dat") {
                return CacheIndexDat.fromStore(id, store, indexFile);
            } else {
                return CacheIndexDat2.fromStore(id, store);
            }
        });
    }

    /** Load a single index from an ArrayBuffer and add it to the system */
    static loadIndexFromData(
        cacheType: "dat" | "dat2",
        store: MemoryStore,
        indexId: number,
        data: ArrayBuffer,
    ): CacheIndex<ApiType.SYNC> | undefined {
        // Add to the store first
        store.addIndexFile(indexId, data);

        // Create the index
        if (cacheType === "dat") {
            return CacheIndexDat.fromStore(indexId, store, data);
        } else {
            return CacheIndexDat2.fromStore(indexId, store);
        }
    }

    static loadLegacy(cacheFiles: CacheFiles, cacheInfo: CacheInfo): CacheSystem {
        const configData = cacheFiles.files.get("config");
        if (!configData) {
            throw new Error("Missing config file");
        }
        const configArchive = Archive.decodeOld(0, new Int8Array(configData), true);
        const configIndex = new LegacyCacheIndex(IndexType.LEGACY.configs, [configArchive]);

        const mediaData = cacheFiles.files.get("media");
        if (!mediaData) {
            throw new Error("Missing media file");
        }
        const mediaArchive = Archive.decodeOld(0, new Int8Array(mediaData), true);
        const mediaIndex = new LegacyCacheIndex(IndexType.LEGACY.media, [mediaArchive]);

        const textureData = cacheFiles.files.get("textures");
        if (!textureData) {
            throw new Error("Missing textures file");
        }
        const textureArchive = Archive.decodeOld(0, new Int8Array(textureData), true);
        const textureIndex = new LegacyCacheIndex(IndexType.LEGACY.textures, [textureArchive]);

        const modelData = cacheFiles.files.get("models");
        if (!modelData) {
            throw new Error("Missing models file");
        }
        const modelArchive = Archive.decodeOld(0, new Int8Array(modelData), true);
        const modelIndex = new LegacyCacheIndex(IndexType.LEGACY.models, [modelArchive]);

        const mapsPrefix = "maps/";
        const mapArchives: Archive[] = [];
        const mapArchiveNameHashes = new Map<number, number>();
        for (const [name, data] of cacheFiles.files) {
            if (!name.startsWith(mapsPrefix)) {
                continue;
            }
            const archiveName = name.substring(mapsPrefix.length);
            const archiveId = mapArchives.length;
            mapArchives.push(Archive.create(archiveId, new Int8Array(data)));
            mapArchiveNameHashes.set(StringUtil.hashOld(archiveName), archiveId);
        }
        const mapIndex = new LegacyCacheIndex(
            IndexType.LEGACY.maps,
            mapArchives,
            mapArchiveNameHashes,
        );

        return new CacheSystem(
            [configIndex, mediaIndex, textureIndex, modelIndex, mapIndex],
            undefined,
            undefined,
            cacheInfo,
        );
    }

    static fromFiles(
        cacheInfo: CacheInfo,
        cacheFiles: CacheFiles,
        indicesToLoad: number[] = [],
        /** When set, builds a SparseMemoryStore over a partially-downloaded dat2. */
        presence?: PresenceBitset,
    ): CacheSystem {
        const cacheType = detectCacheType(cacheInfo);
        switch (cacheType) {
            case "legacy":
                return CacheSystem.loadLegacy(cacheFiles, cacheInfo);
            case "dat":
            case "dat2":
                const store =
                    presence && cacheType === "dat2"
                        ? SparseMemoryStore.fromSparseFiles(cacheFiles, presence, indicesToLoad)
                        : MemoryStore.fromFiles(cacheFiles, indicesToLoad);
                const indices = CacheSystem.loadIndicesFromStore(cacheType, store);
                return new CacheSystem(indices, store, cacheType, cacheInfo);
        }
        throw new Error("Not implemented");
    }

    readonly indices: (CacheIndex<A> | undefined)[];
    private readonly store?: MemoryStore;
    private readonly cacheType?: "dat" | "dat2";
    readonly decodeProfile: CacheDecodeProfile;

    constructor(
        indices: (CacheIndex<A> | undefined)[],
        store?: MemoryStore,
        cacheType?: "dat" | "dat2",
        cacheInfo?: CacheInfo,
    ) {
        this.indices = indices;
        this.store = store;
        this.cacheType = cacheType;
        this.decodeProfile = resolveCacheDecodeProfile(cacheInfo);
    }

    /**
     * Dynamically add an index from raw data.
     * Used for incremental loading during LOADING phase.
     */
    addIndexFromData(indexId: number, data: ArrayBuffer): boolean {
        if (!this.store || !this.cacheType) {
            console.warn("[CacheSystem] Cannot add index - no store available");
            return false;
        }

        const index = CacheSystem.loadIndexFromData(this.cacheType, this.store, indexId, data);
        if (index) {
            (this.indices as (CacheIndex<A> | undefined)[])[indexId] = index as CacheIndex<A>;
            return true;
        }
        return false;
    }

    getStore(): MemoryStore | undefined {
        return this.store;
    }

    indexExists(indexId: number): boolean {
        return !!this.indices[indexId];
    }

    getIndex(indexId: number): CacheIndex<A> {
        const index = this.indices[indexId];
        if (!index) {
            throw new Error("Index not found: " + indexId);
        }
        return index;
    }
}
