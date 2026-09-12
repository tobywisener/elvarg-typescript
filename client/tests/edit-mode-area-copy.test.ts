import assert from "node:assert/strict";
import { buildAreaClipboard, buildRegionPack } from "../game/plugins/editmode/RegionPack";

for (const wide of [false, true]) {
    const value = (n: number) => wide ? [n >> 8, n & 255] : [n];
    // Overlay shape 2, rotation 3; flag 5; underlay 9; explicit height 7.
    const terrainTile = [...value(13), ...value(42), ...value(54), ...value(90), ...value(1), 7];
    const terrain = Uint8Array.from(Array.from({ length: 4 * 64 * 64 }, () => terrainTile).flat());
    const edits = [
        { kind: "place", tileX: 63, tileY: 9, plane: 3, locId: 123, shape: 10, rotation: 2 },
        { kind: "place", tileX: 62, tileY: 9, plane: 0, locId: 456, shape: 10, rotation: 0 },
        { kind: "height", tileX: 64, tileY: 10, plane: 2, locId: 11, shape: 0, rotation: 0 },
    ] as const;
    const requested: number[] = [];
    const copied = JSON.parse(buildAreaClipboard({ minX: 63, maxX: 64, minY: 9, maxY: 10 }, (x, y) => {
        const id = ((x >> 6) << 8) | (y >> 6);
        requested.push(id);
        return buildRegionPack(id, 1, 2, new Uint8Array([0]), terrain, edits, wide);
    }, wide));
    assert.deepEqual(requested, [0, 256], "read each intersecting region once");
    assert.equal(copied.tiles.length, 16, "2x2 selection includes all four planes");
    assert.deepEqual(copied.origin, { x: 63, y: 9 });
    assert.equal(copied.wideTerrain, wide);
    assert.deepEqual(copied.objects, [{ id: 123, x: 0, y: 0, plane: 3, shape: 10, rotation: 2 }]);
    for (const tile of copied.tiles) {
        const expected = [...terrainTile];
        if (tile.x === 1 && tile.y === 1 && tile.plane === 2) expected[expected.length - 1] = 11;
        assert.deepEqual(tile.terrain, expected, "retain every terrain byte and unsaved height edits");
    }
}
assert.throws(() => buildAreaClipboard({ minX: 0, maxX: 1, minY: 0, maxY: 1 }, () => {
    throw new Error("Region is not loaded");
}, false), /not loaded/);
console.info("Area clipboard preserves all planes, terrain records, objects and edits across regions");
