import assert = require("assert");

import { CacheDefinitions } from "../src/main/typescript/elvarg/game/cache/CacheDefinitions";
import { CachePipeline } from "../src/main/typescript/elvarg/game/cache/CachePipeline";
import { CacheInfo } from "../src/main/typescript/elvarg/game/cache/codec/rs/cache/CacheInfo";
import { ObjType } from "../src/main/typescript/elvarg/game/cache/codec/rs/config/objtype/ObjType";
import { ByteBuffer } from "../src/main/typescript/elvarg/game/cache/codec/rs/io/ByteBuffer";
import { ItemDefinition } from "../src/main/typescript/elvarg/game/definition/ItemDefinition";

const cacheInfo: CacheInfo = {
    name: "test",
    game: "oldschool",
    environment: "live",
    revision: 0,
    timestamp: "",
    size: 0,
};

async function main(): Promise<void> {
    const item = new ObjType(0, cacheInfo);
    item.inventoryActions[1] = "Wield";
    item.decodeOpcode(39, new ByteBuffer(Buffer.from("Revert\0")));

    assert.deepEqual(item.inventoryActions, [null, "Wield", null, "Revert", "Drop"]);

    await CachePipeline.initialize();
    assert.equal(CacheDefinitions.getItem(24227).inventoryActions[4], "Drop");
    assert(ItemDefinition.forId(24227).isDropable(), "Granite maul should be droppable");
    console.log("revert item drop action check passed");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
