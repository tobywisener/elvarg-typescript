import assert from "node:assert/strict";

import { resolveCacheDecodeProfile } from "../rs/cache/CacheDecodeProfile";
import { parseScriptFromBytes } from "../rs/cs2/Script";

function encodeScript(longCounts: boolean): Int8Array {
    const bytes: number[] = [];
    const u8 = (v: number) => bytes.push(v & 0xff);
    const u16 = (v: number) => {
        u8(v >> 8);
        u8(v);
    };
    const u32 = (v: number) => {
        u16(v >> 16);
        u16(v);
    };

    for (const c of "test_script") u8(c.charCodeAt(0));
    u8(0);
    u16(0);
    u32(7);
    u16(3);
    for (const c of "hi") u8(c.charCodeAt(0));
    u8(0);
    u16(21);
    u8(0);
    u32(3);
    u16(5);
    u16(2);
    if (longCounts) u16(3);
    u16(1);
    u16(1);
    if (longCounts) u16(2);
    u8(0);
    u16(1);

    return new Int8Array(bytes.map((b) => (b << 24) >> 24));
}

const script236 = parseScriptFromBytes(
    42,
    encodeScript(false),
    resolveCacheDecodeProfile({ game: "oldschool", revision: 236 }),
);
const script237 = parseScriptFromBytes(
    43,
    encodeScript(true),
    resolveCacheDecodeProfile({ game: "oldschool", revision: 237 }),
);

for (const script of [script236, script237]) {
    assert.equal(script.name, "test_script");
    assert.equal(script.instructions.length, 3);
    assert.deepEqual(Array.from(script.instructions), [0, 3, 21]);
    assert.equal(script.localIntCount, 5);
    assert.equal(script.intOperands[0], 7);
    assert.equal(script.stringOperands[1], "hi");
}
assert.equal(script236.localLongCount, 0);
assert.equal(script236.longArgCount, 0);
assert.equal(script237.localLongCount, 3);
assert.equal(script237.longArgCount, 2);

console.log("CS2 script parse tests passed");
