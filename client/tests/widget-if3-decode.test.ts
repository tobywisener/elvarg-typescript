import assert from "node:assert/strict";

import type { CacheInfo } from "../rs/cache/CacheInfo";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { WidgetLoader } from "../widgets/WidgetLoader";

function encodeModelWidget(modelIdBytes: 2 | 4): Int8Array {
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
    const str = (s: string) => {
        for (const c of s) u8(c.charCodeAt(0));
        u8(0);
    };

    u8(0xff);
    u8(6);
    u16(0);
    u16(10);
    u16(20);
    u16(30);
    u16(40);
    u8(0);
    u8(0);
    u8(0);
    u8(0);
    u16(0xffff);
    u8(0);
    modelIdBytes === 2 ? u16(1234) : u32(1234);
    for (let i = 0; i < 5; i++) u16(0);
    u16(100);
    u16(0xffff);
    u8(0);
    u16(0);
    u8(0);
    u8(0);
    u8(0);
    str("");
    u8(0);
    u8(0);
    u8(0);
    u8(0);
    str("");
    for (let i = 0; i < 21; i++) u8(0);

    return new Int8Array(bytes.map((b) => (b << 24) >> 24));
}

function cacheInfo(revision: number): CacheInfo {
    return {
        name: `test-${revision}`,
        game: "oldschool",
        environment: "live",
        revision,
        timestamp: "",
        size: 0,
    };
}

function decode(revision: number, modelIdBytes: 2 | 4): any {
    const data = encodeModelWidget(modelIdBytes);
    const index = {
        getFileIds: () => new Int32Array([0]),
        getFile: () => ({ data }),
    };
    const cache = new CacheSystem(
        [undefined, undefined, undefined, index as never],
        undefined,
        undefined,
        cacheInfo(revision),
    );
    return new WidgetLoader(cache).loadWidgetGroup(900)?.widgets.get(900 << 16);
}

for (const widget of [decode(236, 2), decode(237, 4)]) {
    assert.ok(widget);
    assert.equal(widget.modelId, 1234);
    assert.equal(widget.modelZoom, 100);
    assert.equal(widget.sequenceId, -1);
    assert.equal(widget.rawWidth, 30);
}

console.log("IF3 widget decode tests passed");
