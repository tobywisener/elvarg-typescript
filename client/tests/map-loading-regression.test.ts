import assert from "node:assert/strict";

import { MapManager } from "../game/MapManager";
import { decodeServerPacket } from "../network/packet/ServerBinaryDecoder";
import { onLocAddChange } from "../render/render/locs";
import { onLocDel, scheduleLocReload } from "../render/render/locs2";
import { getMapSquareId } from "../rs/map/MapFileIndex";
import { MapFileLoader } from "../rs/map/MapFileLoader";
import { LocModelLoader } from "../rs/config/loctype/LocModelLoader";
import { LocModelType } from "../rs/config/loctype/LocModelType";
import { LocType } from "../rs/config/loctype/LocType";
import { ModelData } from "../rs/model/ModelData";
import { getEditModeSceneLoadingStatus } from "../game/plugins/editmode/editModeLoadingScreen";
import { isMapProfileEnabled } from "../render/render/mapLoadProfile";

function mapProfilingRequiresExplicitFlag(): void {
    const original = Object.getOwnPropertyDescriptor(globalThis, "location");
    try {
        for (const [search, enabled] of [["", false], ["?edit=1", false],
            ["?edit=1&map-profile=0", false], ["?edit=1&map-profile=1", true],
            ["?map-profile=1", true]] as const) {
            Object.defineProperty(globalThis, "location", { configurable: true, value: { search } });
            assert.equal(isMapProfileEnabled(), enabled, search);
        }
    } finally {
        if (original) Object.defineProperty(globalThis, "location", original);
        else Reflect.deleteProperty(globalThis, "location");
    }
}

function editorWaitsForRenderableRegion(): void {
    const maps = new MapManager<any>(4, () => {});
    const progress = { pending: 3, active: 1, downloadedBytes: 2.5 * 1048576 };
    const client = {
        scenePreviewEnabled: true,
        scenePreviewLoadingStartedAt: performance.now(),
        renderer: { mapManager: maps },
        js5: { getProgress: () => progress },
    } as any;
    assert.match(getEditModeSceneLoadingStatus(client)!, /Downloading scenery - 2.5 MiB received/);
    progress.pending = 20; // A build pass discovers more dependencies.
    assert.match(getEditModeSceneLoadingStatus(client)!, /Downloading scenery - 2.5 MiB received/);
    progress.downloadedBytes = 3 * 1048576;
    progress.pending = 0;
    maps.loadingMapIds.add(1);
    assert.match(getEditModeSceneLoadingStatus(client)!, /Building the first region - 3.0 MiB received/);
    client.js5 = undefined;
    maps.loadingMapIds.add(1);
    assert.match(getEditModeSceneLoadingStatus(client)!, /Building the first region/);
    // A received/uploaded region alone must not dismiss the screen.
    maps.mapSquares.set(1, { mapX: 0, mapY: 1 });
    assert.ok(getEditModeSceneLoadingStatus(client));
    maps.visibleMaps = [{ mapX: 0, mapY: 1 }];
    maps.visibleMapCount = 1;
    assert.ok(getEditModeSceneLoadingStatus(client), "stale visible regions must not dismiss loading");
    maps.isMapInTargetGrid = () => true;
    assert.equal(getEditModeSceneLoadingStatus(client), undefined);
    assert.equal(client.scenePreviewLoadingStartedAt, undefined);
    maps.visibleMapCount = 0;
    assert.equal(getEditModeSceneLoadingStatus(client), undefined, "later streaming must not reopen startup loading");
    client.scenePreviewLoadingStartedAt = performance.now();
    client.scenePreviewEnabled = false;
    assert.equal(getEditModeSceneLoadingStatus(client), undefined, "leaving preview must release the overlay");
}

function multipartLocsRequestAllMissingModelsTogether(): void {
    for (const typed of [false, true]) {
        const requested: number[] = [];
        const present = new Set<number>();
        const loader = new LocModelLoader({} as any, {
            getModel(id) {
                requested.push(id);
                return present.has(id) ? new ModelData() : undefined;
            },
        }, {} as any, {} as any, {} as any, undefined);
        const loc = new LocType(1, { game: "oldschool", revision: 237 } as any);
        loc.models = [[10, 20, 30]];
        loc.types = typed ? [LocModelType.NORMAL] : undefined;

        assert.equal(loader.getLocModelData(loc, LocModelType.NORMAL, 0), undefined);
        assert.deepEqual(requested, [10, 20, 30], "all missing parts must be requested in one build pass");
        present.add(10);
        present.add(30);
        assert.equal(loader.getLocModelData(loc, LocModelType.NORMAL, 0), undefined,
            "a missing middle part must not merge stale or partial geometry");
        present.add(20);
        assert.ok(loader.getLocModelData(loc, LocModelType.NORMAL, 0));
    }
}

function mapLoadBackoff(): void {
    const originalNow = Date.now;
    let now = 1000;
    Date.now = () => now;
    try {
        let loads = 0;
        const manager = new MapManager(1, () => {
            loads++;
        });

        manager.loadMap(37, 48);
        assert.equal(loads, 1);
        manager.deferFailedMapLoad(37, 48);
        manager.loadMap(37, 48);
        assert.equal(loads, 1);

        now += 250;
        manager.loadMap(37, 48);
        assert.equal(loads, 2);
    } finally {
        Date.now = originalNow;
    }
}

function incomingMapsRenderBeforeTheWholeGridIsReady(): void {
    const manager = new MapManager(1, () => {});
    const camera = { getPosX: () => 3232, getPosZ: () => 3232 } as any;
    const map = (mapX: number, mapY: number) => ({
        mapX,
        mapY,
        canRender: () => true,
        delete: () => {},
    });

    manager.update(3232, 3232, camera, 0, 1, 3200, 3200);
    for (const mapId of manager.getGridMapIdsSnapshot()) {
        manager.addMap(mapId >> 8, mapId & 0xff, map(mapId >> 8, mapId & 0xff));
    }
    manager.update(3232, 3232, camera, 1, 1, 3200, 3200);

    manager.update(3296, 3232, camera, 2, 1, 3264, 3200);
    manager.addMap(52, 50, map(52, 50));
    manager.update(3296, 3232, camera, 3, 1, 3264, 3200);

    assert.ok(manager.visibleMaps.some((entry) => entry.mapX === 52 && entry.mapY === 50));
}

function duplicateLocReplayIsIgnored(): void {
    let refreshes = 0;
    const host = {
        addedLocs: new Map(),
        locOverrides: new Map(),
        instanceActive: false,
        osrsClient: { locTypeLoader: { load: () => undefined } },
        scheduleLocGeometryUpdate: () => {
            refreshes++;
        },
    } as any;

    onLocAddChange(host, 411, { x: 2431, y: 3076 }, 1, 10, 1);
    onLocAddChange(host, 411, { x: 2431, y: 3076 }, 1, 10, 1);
    assert.equal(refreshes, 1);

    host.locOverrides.clear();
    onLocAddChange(host, 411, { x: 2431, y: 3076 }, 1, 10, 1);
    assert.equal(refreshes, 2);

    onLocAddChange(host, 411, { x: 2431, y: 3076 }, 1, 10, 0);
    assert.equal(refreshes, 3);
}

function locUpdateBeforeInitialMapDoesNotStartADuplicateMapTask(): void {
    const mapX = 48;
    const mapY = 54;
    const mapId = getMapSquareId(mapX, mapY);
    const host = {
        locReloadVersions: new Map<number, number>(),
        mapManager: {
            loadingMapIds: new Set(),
            getMap: () => undefined,
        },
        pendingLocReloadMaps: new Map(),
        pendingLocReloadFlushTimer: undefined,
        beginLocReloadBatch: () => assert.fail("initial load must not start a second reload"),
    } as any;

    scheduleLocReload(host, mapX, mapY);
    assert.equal(host.locReloadVersions.get(mapId), 1);
    assert.equal(host.pendingLocReloadMaps.size, 0);
}

function crossShapeReplacementKeepsBaseWallHidden(): void {
    const tile = { x: 2643, y: 2592 };
    const host = {
        addedLocs: new Map(),
        locOverrides: new Map(),
        instanceActive: false,
        osrsClient: { locTypeLoader: { load: () => undefined } },
        getLocIdsAtTileAllLevels: () => [],
        scheduleLocGeometryUpdate: () => undefined,
    } as any;

    onLocDel(host, tile, 0, 0, 0);
    onLocAddChange(host, 14245, tile, 0, 22, 0);
    assert.equal(host.locOverrides.get("2643,2592,0,-1").matchType, 0);
    assert.equal(host.addedLocs.get("2643,2592,0,22").locId, 14245);

    onLocDel(host, tile, 0, 22, 0);
    onLocAddChange(host, 14233, tile, 0, 0, 0);
    assert.equal(host.locOverrides.get("2643,2592,0,-1").matchType, 0);
    assert.equal(host.addedLocs.has("2643,2592,0,22"), false);
    assert.equal(host.addedLocs.get("2643,2592,0,0").locId, 14233);
}

function regionReplacementUsesNativeMapData(): void {
    const payload = Uint8Array.from([48, 55, 1, 0, 3, 0, 2, 1, 2, 3, 4, 5]);
    const frame = Uint8Array.from([144, 0, payload.length, ...payload]);
    const decoded = decodeServerPacket(frame) as any;
    assert.equal(decoded.type, "region_replacement");
    assert.equal(decoded.payload.regionId, 12343);
    assert.equal(decoded.payload.allowReload, true);
    assert.deepEqual([...decoded.payload.terrainData], [1, 2, 3]);
    assert.deepEqual([...decoded.payload.objectData], [4, 5]);

    const loader = new MapFileLoader({} as any, {} as any);
    loader.setRegionReplacements(new Map([[12343, {
        terrainData: Int8Array.from([1, 2, 3]),
        objectData: Int8Array.from([4, 5]),
    }]]));
    assert.deepEqual([...loader.getTerrainData(48, 55)!], [1, 2, 3]);
    assert.deepEqual([...loader.getLocData(48, 55, new Map())!], [4, 5]);
}

mapLoadBackoff();
mapProfilingRequiresExplicitFlag();
editorWaitsForRenderableRegion();
multipartLocsRequestAllMissingModelsTogether();
incomingMapsRenderBeforeTheWholeGridIsReady();
duplicateLocReplayIsIgnored();
locUpdateBeforeInitialMapDoesNotStartADuplicateMapTask();
crossShapeReplacementKeepsBaseWallHidden();
regionReplacementUsesNativeMapData();
console.log("Map loading regression tests passed");
