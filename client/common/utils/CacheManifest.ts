import { resolveCacheKey } from "../../rs/cache/CacheFiles";

const DB_NAME = "osrs-typescript-cache-manifest";
const DB_VERSION = 1;
const STORE_NAME = "manifests";

export interface CacheManifestEntry {
    cacheName: string;
    files: string[];
    updatedAt: string;
    size?: number;
    revision?: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB not available"));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "cacheName" });
            }
        };
    });
}

async function storeManifestEntry(entry: CacheManifestEntry): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(entry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch {}
}

async function deleteManifestEntry(cacheName: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(cacheName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch {}
}

export async function getCacheManifestEntry(
    cacheName: string,
): Promise<CacheManifestEntry | undefined> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(cacheName);
            request.onsuccess = () => resolve(request.result as CacheManifestEntry | undefined);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return undefined;
    }
}

export async function removeCacheManifestEntry(cacheName: string): Promise<void> {
    await deleteManifestEntry(cacheName);
}

export async function writeCacheManifestEntry(entry: CacheManifestEntry): Promise<void> {
    await storeManifestEntry(entry);
}

function extractCacheFileName(url: string): string {
    try {
        const origin =
            typeof window !== "undefined" && window.location
                ? window.location.origin
                : "http://local";
        const parsed = new URL(url, origin);
        return parsed.pathname.substring(parsed.pathname.lastIndexOf("/") + 1);
    } catch {
        const idx = url.lastIndexOf("/");
        return idx >= 0 ? url.substring(idx + 1) : url;
    }
}

export async function isCacheManifestComplete(entry: CacheManifestEntry): Promise<boolean> {
    if (typeof (globalThis as any).caches === "undefined") {
        return true;
    }
    try {
        const cache = await (globalThis as any).caches.open(resolveCacheKey(entry.cacheName));
        const requests: Request[] = await cache.keys();
        const existing = new Set<string>();
        for (const req of requests) {
            existing.add(extractCacheFileName(req.url));
            // Streaming stores dat2 as ranges; its manifest replaces the full-file entry.
            if (new URL(req.url).pathname.endsWith("/main_file_cache.dat2/range/manifest")) {
                existing.add("main_file_cache.dat2");
            }
        }
        for (const expected of entry.files) {
            if (!existing.has(expected)) {
                return false;
            }
        }
        return true;
    } catch {
        return false;
    }
}
