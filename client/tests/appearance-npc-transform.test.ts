import assert from "assert";
import { decodeAppearanceBinary } from "../game/sync/AppearanceDecoder";

const bytes = new Uint8Array([
    0, 255, 255, 255, 255, 0, 172,
    0, 0, 0, 0, 0,
    3, 40, 3, 55, 3, 51, 3, 52, 3, 53, 3, 54, 3, 56,
    84, 111, 98, 121, 0,
    3, 0, 32, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 255, 255, 255, 255,
]);
const appearance = decodeAppearanceBinary(bytes);
assert.strictEqual(appearance?.npcTransformationId, 172);
assert.strictEqual(appearance?.name, "Toby");
console.log("npc-transform appearance decode passed");
