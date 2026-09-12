import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { SoundEffectSystem, type PlaySoundOptions } from "../game/audio/SoundEffectSystem";
import { ClientScriptLoader } from "../game/cs2/ClientScriptLoader";
import type { SoundEffectLoader } from "../rs/audio/SoundEffectLoader";
import type { RawSoundData } from "../rs/audio/legacy/SoundEffect";
import { GroupMissingError } from "../rs/cache/js5/GroupMissingError";
import { parseContentRange, validatePartialContentResponse } from "../rs/cache/js5/HttpRange";
import { PresenceBitset } from "../rs/cache/js5/PresenceBitset";
import { rebuildGroundItemsForMap } from "../render/render/draw3";

async function shellActivationPreservesGameAssets(): Promise<void> {
    const handlers = new Map<string, (event: any) => void>();
    const deleted: string[] = [];
    runInNewContext(readFileSync(new URL("../public/service-worker.js", import.meta.url), "utf8"), {
        self: { addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
            clients: { claim: async () => {} } },
        caches: {
            keys: async () => ["osrs-typescript-shell-v2", "osrs-typescript-shell-v3",
                "osrs-typescript::cache::osrs-237", "another-app-cache"],
            delete: async (key: string) => { deleted.push(key); return true; },
        },
    });
    let completion: Promise<void> | undefined;
    handlers.get("activate")!({ waitUntil: (promise: Promise<void>) => { completion = promise; } });
    await completion;
    assert.deepEqual(deleted, ["osrs-typescript-shell-v2"]);
}

function contentRangeParsing(): void {
    assert.deepEqual(parseContentRange("bytes 10-19/100"), {
        start: 10,
        endExclusive: 20,
        total: 100,
    });
    assert.deepEqual(parseContentRange("bytes 0-0/*"), {
        start: 0,
        endExclusive: 1,
        total: undefined,
    });
    assert.equal(parseContentRange("bytes 10-9/100"), undefined);
    assert.equal(parseContentRange("bytes 0-100/100"), undefined);
    assert.equal(parseContentRange("garbage"), undefined);
}

function exactRangeValidation(): void {
    const valid = new Response(new Uint8Array(10), {
        status: 206,
        headers: { "Content-Range": "bytes 10-19/100" },
    });
    assert.deepEqual(validatePartialContentResponse(valid, 10, 20, "cache.dat2"), {
        start: 10,
        endExclusive: 20,
        total: 100,
    });

    const missingHeader = new Response(new Uint8Array(10), { status: 206 });
    assert.throws(
        () => validatePartialContentResponse(missingHeader, 10, 20, "cache.dat2"),
        /Invalid Content-Range/,
    );

    const wrongRange = new Response(new Uint8Array(10), {
        status: 206,
        headers: { "Content-Range": "bytes 20-29/100" },
    });
    assert.throws(
        () => validatePartialContentResponse(wrongRange, 10, 20, "cache.dat2"),
        /Unexpected Content-Range/,
    );
}

function sectorPresenceTracking(): void {
    const presence = PresenceBitset.forSectorCount(20, false);
    assert.equal(presence.hasSectors(3, 4), false);
    presence.markSectors(3, 4);
    assert.equal(presence.hasSectors(3, 4), true);
    assert.equal(presence.hasSectors(2, 5), false);
    presence.markSectors(0, 16);
    assert.equal(presence.hasSectors(0, 16), true);
    assert.equal(presence.hasSectors(19, 2), false);
}

async function clientScriptRetryLifecycle(): Promise<void> {
    const originalSetTimeout = globalThis.setTimeout;
    (globalThis as any).setTimeout = (callback: () => void) => {
        queueMicrotask(callback);
        return 0;
    };

    try {
        const script = { id: 10 } as any;
        const loader = new ClientScriptLoader({} as any);
        let attempts = 0;
        (loader as any).tryLoad = () => {
            attempts++;
            if (attempts < 3) throw new GroupMissingError(12, 10, 0, 1);
            return script;
        };

        const first = loader.loadWithRetry(10);
        const duplicate = loader.loadWithRetry(10);
        assert.equal(first, duplicate);
        assert.equal(await first, script);
        assert.equal(attempts, 3);

        const absentLoader = new ClientScriptLoader({} as any);
        let absentAttempts = 0;
        (absentLoader as any).tryLoad = () => {
            absentAttempts++;
            return null;
        };
        assert.equal(await absentLoader.loadWithRetry(11), null);
        assert.equal(absentAttempts, 1);

        const exhaustedLoader = new ClientScriptLoader({} as any);
        let exhaustedAttempts = 0;
        (exhaustedLoader as any).tryLoad = () => {
            exhaustedAttempts++;
            throw new GroupMissingError(12, 12, 0, 1);
        };
        assert.equal(await exhaustedLoader.loadWithRetry(12), null);
        assert.equal(exhaustedAttempts, 20);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
    }
}

async function soundRetryLifecycle(): Promise<void> {
    const raw: RawSoundData = {
        sampleRate: 22050,
        samples: new Int8Array([1]),
        start: 0,
        end: 0,
    };
    let resolveRetry!: (value: RawSoundData | undefined) => void;
    let retryCalls = 0;
    const retry = new Promise<RawSoundData | undefined>((resolve) => {
        resolveRetry = resolve;
    });
    const system = new SoundEffectSystem({
        loadWithRetry: () => {
            retryCalls++;
            return retry;
        },
    } as unknown as SoundEffectLoader);
    const plays: Array<{ options: PlaySoundOptions; elapsedMs: number }> = [];
    (system as any).playSoundEffectInternal = (
        _soundId: number,
        options: PlaySoundOptions,
        elapsedMs: number,
    ) => plays.push({ options, elapsedMs });

    (system as any).retryMissingSound(10, { position: { x: 1, y: 1 } });
    (system as any).retryMissingSound(10, { position: { x: 2, y: 2 } });
    assert.equal(retryCalls, 1);
    resolveRetry(raw);
    await retry;
    await Promise.resolve();
    assert.deepEqual(
        plays.map(({ options }) => options),
        [{ position: { x: 1, y: 1 } }, { position: { x: 2, y: 2 } }],
    );
    assert.equal(plays.every(({ elapsedMs }) => elapsedMs >= 0), true);
    assert.equal(
        (SoundEffectSystem as any).remainingDelayMs({ delayMs: 120 }, 0.04, 60),
        100,
    );
    assert.equal((SoundEffectSystem as any).remainingDelayMs({}, 0.04, 60), 0);
    assert.deepEqual(
        (SoundEffectSystem as any).expandFiniteLoop(new Float32Array([0, 1, 2, 3]), 1, 3, 2),
        new Float32Array([0, 1, 2, 1, 2, 1, 2, 3]),
    );

    let resolveDisposedRetry!: (value: RawSoundData | undefined) => void;
    const disposedRetry = new Promise<RawSoundData | undefined>((resolve) => {
        resolveDisposedRetry = resolve;
    });
    const disposedSystem = new SoundEffectSystem({
        loadWithRetry: () => disposedRetry,
    } as unknown as SoundEffectLoader);
    let playedAfterDispose = false;
    (disposedSystem as any).playSoundEffectInternal = () => {
        playedAfterDispose = true;
    };
    (disposedSystem as any).retryMissingSound(11, {});
    disposedSystem.dispose();
    resolveDisposedRetry(raw);
    await disposedRetry;
    await Promise.resolve();
    assert.equal(playedAfterDispose, false);
}

function sequenceSoundSelection(): void {
    const system = new SoundEffectSystem({} as SoundEffectLoader);
    const plays: Array<{ soundId: number; options: PlaySoundOptions }> = [];
    (system as any).playSoundEffect = (soundId: number, options: PlaySoundOptions) =>
        plays.push({ soundId, options });

    const originalRandom = Math.random;
    Math.random = () => 0.25;
    try {
        system.handleSeqFrameSounds(
            [
                { id: 10, weight: 50, loops: 1, location: 4, attenuation: 2 },
                { id: 11, weight: 50, loops: 1, location: 4, attenuation: 3 },
            ],
            { position: { x: 64, y: 64 }, isLocalPlayer: false },
        );
    } finally {
        Math.random = originalRandom;
    }
    assert.deepEqual(plays, [
        {
            soundId: 10,
            options: {
                loops: 0,
                position: { x: 64, y: 64 },
                radius: 512,
                distanceFadeCurve: undefined,
                isLocalPlayer: false,
                attenuation: 2,
            },
        },
    ]);

    system.handleSeqFrameSounds([{ id: 12, loops: 1, location: 0 }], {
        isLocalPlayer: false,
    });
    assert.equal(plays.length, 1);
    system.handleSeqFrameSounds([{ id: 12, loops: 1, location: 0 }], {
        isLocalPlayer: true,
    });
    system.handleSeqFrameSounds([{ id: 12, loops: 1, location: 0 }], {
        isLocalPlayer: true,
    });
    assert.equal(plays.length, 3);
}

function ambientSoundsRetryMissingCacheGroups(): void {
    const system = new SoundEffectSystem({} as SoundEffectLoader);
    (system as any).decode = () => undefined;
    const active = {
        instance: { locId: 1 },
        loopSoundId: undefined,
        currentSoundIndex: -1,
        nextChangeTime: 5,
    };

    (system as any).startLoopSource(active, 10, {}, 5);
    assert.equal(active.loopSoundId, undefined);
    (system as any).playOverlaySound(
        "1",
        active,
        { soundIds: [10], loopSequentially: false },
        {},
        5,
    );
    assert.equal(active.nextChangeTime, 5);
}

function groundItemsRetryUntilRendererReady(): void {
    const stack = [{}] as any;
    assert.equal(rebuildGroundItemsForMap({} as any, {} as any, stack), true);
    assert.equal(rebuildGroundItemsForMap({} as any, {} as any, undefined), false);
}

async function main(): Promise<void> {
    await shellActivationPreservesGameAssets();
    contentRangeParsing();
    exactRangeValidation();
    sectorPresenceTracking();
    groundItemsRetryUntilRendererReady();
    sequenceSoundSelection();
    ambientSoundsRetryMissingCacheGroups();
    await clientScriptRetryLifecycle();
    await soundRetryLifecycle();
    console.log("Cache streaming regression tests passed");
}

void main();
