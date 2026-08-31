import assert = require("node:assert/strict");
import { getSequenceFrameIds } from "../src/main/typescript/elvarg/game/cache/NpcAnimationScanner";

assert.deepEqual(getSequenceFrameIds(new Int8Array([
    1, 0, 2,
    0, 3, 0, 4,
    0, 10, 0, 11,
    0, 1, 0, 2,
])), [65546, 131083]);
assert.deepEqual(getSequenceFrameIds(new Int8Array([
    2, 0, 16, // frame step
    16, 8, // revision 226+ vertical offset
    1, 0, 1,
    0, 4,
    0, 10,
    0, 1,
])), [65546]);
assert.deepEqual(getSequenceFrameIds(new Int8Array([2, 0, 0])), []);
console.info("npc animation scanner smoke passed");
