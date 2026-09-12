import assert from "node:assert/strict";
import { isCacheManifestComplete } from "../common/utils/CacheManifest";

async function main() {
    const original = globalThis.caches;
    let urls = ["main_file_cache.idx255", "main_file_cache.dat2/range/manifest"];
    (globalThis as any).caches = { open: async () => ({
        keys: async () => urls.map(path => new Request(`https://rsps.app/play/caches/test/${path}`)),
    }) };
    const entry = { cacheName: "test", files: ["main_file_cache.idx255", "main_file_cache.dat2"], updatedAt: "" };
    try {
        assert.equal(await isCacheManifestComplete(entry), true, "Persisted sparse cache must survive reload");
        urls = ["main_file_cache.idx255"];
        assert.equal(await isCacheManifestComplete(entry), false, "Missing dat2 still invalidates cache");
        urls = ["main_file_cache.idx255", "main_file_cache.dat2"];
        assert.equal(await isCacheManifestComplete(entry), true, "Full cache remains supported");
    } finally { (globalThis as any).caches = original; }
    console.log("Sparse cache manifest regression passed");
}
void main();
