import assert = require("assert");

import { CacheDefinitions } from "../src/main/typescript/elvarg/game/cache/CacheDefinitions";
import { CachePipeline } from "../src/main/typescript/elvarg/game/cache/CachePipeline";
import { ItemIdentifiers } from "../src/main/typescript/elvarg/util/ItemIdentifiers";

const { FOOD } = require("../plugins/items/Food.plugin.js");

async function main(): Promise<void> {
    assert.equal(FOOD.get(ItemIdentifiers.BANANA)?.heal, 2);
    assert.equal(FOOD.get(ItemIdentifiers.PEACH)?.heal, 8);

    await CachePipeline.initialize();
    assert.equal(CacheDefinitions.getSpellName(0, 3280), "Bones to Bananas");
    console.log("bones fruit check passed");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
