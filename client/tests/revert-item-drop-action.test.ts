import assert from "node:assert/strict";

import type { CacheInfo } from "../rs/cache/CacheInfo";
import { ObjType } from "../rs/config/objtype/ObjType";
import { ByteBuffer } from "../rs/io/ByteBuffer";

const cacheInfo: CacheInfo = {
    name: "test",
    game: "oldschool",
    environment: "live",
    revision: 0,
    timestamp: "",
    size: 0,
};

const item = new ObjType(0, cacheInfo);
item.inventoryActions[1] = "Wield";
item.decodeOpcode(39, new ByteBuffer(new TextEncoder().encode("Revert\0")));

assert.deepEqual(item.inventoryActions, [null, "Wield", null, "Revert", "Drop"]);
console.log("revert item drop action check passed");
