import assert from "node:assert/strict";
import { EditModePlugin } from "../game/plugins/editmode/EditModePlugin";
import { waterArea, generateIslandEdits } from "../game/plugins/editmode/IslandGenerator";
import { buildAreaClipboard, buildRegionPack } from "../game/plugins/editmode/RegionPack";

const bounds = { minX: 55, maxX: 78, minY: 8, maxY: 29 };
const terrain = Uint8Array.from(Array.from({ length: 4 * 64 * 64 }, () => [0, 2, 1, 186, 0, 1, 1]).flat());
const copy = (edits: Parameters<typeof buildRegionPack>[5] = []) => buildAreaClipboard(bounds, (x, y) =>
    buildRegionPack(((x >> 6) << 8) | (y >> 6), 1, 2, new Uint8Array([0]), terrain, edits, true), true);
const isWater = (id: number) => id === 442;
const area = waterArea(copy(), isWater)!;
assert.ok(area);
assert.equal(waterArea(JSON.stringify({ ...area, width: 2 }), isWater), undefined);
for (const [locId, shape] of [[0, 0], [442, 1]]) {
    assert.equal(waterArea(copy([{ kind: "terrain", tileX: 60, tileY: 10, plane: 0, locId, shape, rotation: 0 }]), isWater), undefined);
}
for (let seed = 0; seed < 20; seed++) {
    const edits = generateIslandEdits(area, () => seed / 20);
    assert.ok(edits.some((edit) => edit.kind === "height" && edit.locId > 2));
    assert.ok(edits.some((edit) => edit.kind === "terrain" && edit.shape === 1));
    assert.ok(edits.some((edit) => edit.kind === "terrain" && edit.locId === 0));
    assert.ok(edits.every((edit) => edit.plane === 0 && edit.tileX > bounds.minX && edit.tileX < bounds.maxX && edit.tileY > bounds.minY && edit.tileY < bounds.maxY));
    assert.ok(edits.every((edit) => !["place", "delete", "npc"].includes(edit.kind)));
    const result = JSON.parse(copy(edits));
    assert.equal(waterArea(JSON.stringify(result), isWater), undefined);
    const land = edits.find((edit) => edit.kind === "underlay")!;
    const tile = result.tiles.find((tile: any) => tile.plane === 0 && tile.x === land.tileX - bounds.minX && tile.y === land.tileY - bounds.minY);
    assert.ok(tile.terrain.some((value: number, i: number) => value === 0 && tile.terrain[i + 1] === land.locId + 81), "underlay exported");
    for (const tile of result.tiles) {
        if (tile.plane !== 0 || tile.x === 0 || tile.y === 0 || tile.x === area.width - 1 || tile.y === area.height - 1) {
            assert.deepEqual(tile.terrain, [0, 2, 1, 186, 0, 1, 1]);
        }
    }
}
const tiny = { ...area, width: 3, height: 3 };
assert.ok(generateIslandEdits(tiny, () => 0).some((edit) => edit.kind === "terrain" && edit.locId === 0));
console.info("Island eligibility, shoreline, heights, borders and cross-region export passed");

const plugin = new EditModePlugin();
const internals = plugin as any;
internals.selection = { tileX: bounds.minX, tileY: bounds.minY, tileEndX: bounds.maxX, tileEndY: bounds.maxY, plane: 0, locId: -1, locName: "" };
internals.host = { isWaterOverlay: isWater, copyArea: (_bounds: unknown, edits: any) => copy(edits), getTerrainHeight: () => 0 };
assert.equal(plugin.canGenerateIsland(), true);
internals.selection.plane = 1;
assert.equal(plugin.canGenerateIsland(), false);
internals.selection.plane = 0;
let committed = 0;
internals.commitEdits = (edits: any[], immediate: boolean) => {
    assert.equal(immediate, false, "one region rebuild instead of reloading every tile");
    committed++;
    plugin.setConfig({ edits });
};
plugin.generateIsland();
assert.equal(committed, 1);
assert.equal(plugin.canGenerateIsland(), false, "pending land edits immediately hide the action");
plugin.generateIsland();
assert.equal(committed, 1, "action rechecks water eligibility");
assert.ok(plugin.getConfig().edits.some((edit) => edit.kind === "underlay"), "underlays survive configuration normalization");

// Reproduce the reported three-water-side tip pattern across narrow island outlines.
for (let seed = 0; seed < 100; seed++) {
    const edits = generateIslandEdits({ ...area, width: 15, height: 21 }, () => seed / 100);
    const land = new Set(edits.filter((edit) => edit.kind === "terrain").map((edit) => `${edit.tileX}:${edit.tileY}`));
    for (const edit of edits.filter((edit) => edit.kind === "terrain")) {
        const neighbours = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([dx, dy]) => land.has(`${edit.tileX + dx}:${edit.tileY + dy}`));
        assert.ok([-1, 1].some((dx) => [-1, 1].some((dy) =>
            land.has(`${edit.tileX + dx}:${edit.tileY}`) &&
            land.has(`${edit.tileX}:${edit.tileY + dy}`) &&
            land.has(`${edit.tileX + dx}:${edit.tileY + dy}`),
        )), "coast tiles belong to a solid 2x2 patch, with no diagonal whiskers");
        assert.ok(neighbours.length >= 2, `no square tip at ${edit.tileX},${edit.tileY}, seed ${seed}`);
    }
}
const profile = (peak: number, steepness: number) => {
    const values = [0.25, peak, steepness];
    return generateIslandEdits(area, () => values.shift()!);
};
const gentle = profile(0, 1);
const steep = profile(1, 0);
assert.deepEqual(gentle.filter((edit) => edit.kind === "terrain"), steep.filter((edit) => edit.kind === "terrain"), "height variation does not alter the coastline");
const gentleHeights = gentle.filter((edit) => edit.kind === "height");
const steepHeights = steep.filter((edit) => edit.kind === "height");
assert.ok(Math.max(...steepHeights.map((edit) => edit.locId)) > Math.max(...gentleHeights.map((edit) => edit.locId)));
for (const heights of [gentleHeights, steepHeights]) {
    const interior = heights.filter((edit) => Math.abs(edit.tileX - (bounds.minX + area.width / 2)) <= 2 && Math.abs(edit.tileY - (bounds.minY + area.height / 2)) <= 2);
    const levels = interior.map((edit) => edit.locId);
    assert.ok(levels.length >= 16);
    assert.ok(Math.max(...levels) <= 22, "plateau stays low");
    assert.ok(Math.max(...levels) - Math.min(...levels) <= 3, "broad interior is flat with gentle variation");
    assert.ok(new Set(levels).size > 1, "interior retains some variation");
    const byTile = new Map(heights.map((edit) => [`${edit.tileX}:${edit.tileY}`, edit.locId]));
    for (const edit of heights) {
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const neighbour = byTile.get(`${edit.tileX + dx}:${edit.tileY + dy}`) ?? 0;
            assert.ok(Math.abs(edit.locId - neighbour) <= 15, "short shoreline ramp stays below a vertical cliff");
        }
    }
}
const steepByTile = new Map(steepHeights.map((edit) => [`${edit.tileX}:${edit.tileY}`, edit.locId]));
assert.ok(steepHeights.some((edit) => Math.abs(edit.locId - (steepByTile.get(`${edit.tileX + 1}:${edit.tileY}`) ?? 0)) >= 9), "short ramp produces steeper sides despite the lower plateau");
console.info("Lower flat interiors and steeper shoreline slopes passed");
