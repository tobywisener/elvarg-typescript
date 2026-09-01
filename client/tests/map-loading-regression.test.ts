import assert from "node:assert/strict";

import { MapManager } from "../game/MapManager";
import { decodeServerPacket } from "../network/packet/ServerBinaryDecoder";
import { onLocAddChange } from "../render/render/locs";
import { onLocDel } from "../render/render/locs2";
import { MapFileLoader } from "../rs/map/MapFileLoader";

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
incomingMapsRenderBeforeTheWholeGridIsReady();
duplicateLocReplayIsIgnored();
crossShapeReplacementKeepsBaseWallHidden();
regionReplacementUsesNativeMapData();
console.log("Map loading regression tests passed");
