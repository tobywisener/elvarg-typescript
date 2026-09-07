import assert = require("assert");
import fs = require("fs");
import { CacheDefinitions } from "../src/main/typescript/elvarg/game/cache/CacheDefinitions";
import { CachePipeline } from "../src/main/typescript/elvarg/game/cache/CachePipeline";
import { ItemDefinition } from "../src/main/typescript/elvarg/game/definition/ItemDefinition";
import { NpcDefinition } from "../src/main/typescript/elvarg/game/definition/NpcDefinition";
import { ObjectDefinition } from "../src/main/typescript/elvarg/game/definition/ObjectDefinition";
import { RegionManager } from "../src/main/typescript/elvarg/game/collision/RegionManager";
import { MapRegionReplacementManager } from "../src/main/typescript/elvarg/game/collision/MapRegionReplacementManager";
import { NpcDefinitionLoader } from "../src/main/typescript/elvarg/game/definition/loader/impl/NpcDefinitionLoader";
import { NPC } from "../src/main/typescript/elvarg/game/entity/impl/npc/NPC";
import { EquipmentType } from "../src/main/typescript/elvarg/game/model/EquipmentType";
import { Location } from "../src/main/typescript/elvarg/game/model/Location";
import { ItemIdentifiers } from "../src/main/typescript/elvarg/util/ItemIdentifiers";

async function main() {
    await CachePipeline.initialize();
    assert(!fs.existsSync("data/definitions/items.json"));
    assert(!fs.existsSync("data/definitions/npc_defs.json"));
    const counts = CacheDefinitions.getCounts();
    assert(counts.npcs > 7_748, `expected cache NPC definitions, got ${counts.npcs}`);
    assert(counts.items > 26_562, `expected cache item definitions, got ${counts.items}`);
    assert(counts.objects > 30_000, `expected cache object definitions, got ${counts.objects}`);
    assert.notEqual(CacheDefinitions.getNpc(100).name, "null");
    assert.notEqual(CacheDefinitions.getItem(4151).name, "null");
    assert.notEqual(CacheDefinitions.getObject(2213).name, "null");
    assert.equal(CacheDefinitions.getSpellName((218 << 16) | 9, 0xffff), "Wind Strike");
    new NpcDefinitionLoader().load();
    assert.equal(NpcDefinition.forId(100).getName(), CacheDefinitions.getNpc(100).name);
    assert.equal(NpcDefinition.forId(100).getAttackAnim(), 1312);
    assert.equal(NpcDefinition.forId(100).getDeathSound(), 719);
    assert.equal(NpcDefinition.forId(73).getAttackAnim(), 5485);
    assert.equal(NpcDefinition.forId(73).getDefenceAnim(), 5489);
    assert.equal(NpcDefinition.forId(73).getDeathAnim(), 5491);
    assert.equal(NpcDefinition.forId(1).getAttackAnim(), 6014);
    assert.equal(NpcDefinition.forId(1).getDefenceAnim(), 6012);
    assert.equal(NpcDefinition.forId(1).getDeathAnim(), 6013);
    assert.equal(NpcDefinition.forId(70).getAttackAnim(), 5485);
    assert.equal(NpcDefinition.forId(70).getDefenceAnim(), 5489);
    assert.equal(NpcDefinition.forId(70).getDeathAnim(), 5491);
    assert.equal(NpcDefinition.forId(7).getAttackAnim(), 6184);
    assert.equal(NpcDefinition.forId(1062).getAttackAnim(), 4933);
    assert.equal(NpcDefinition.forId(1062).getDefenceAnim(), 4934);
    assert.equal(NpcDefinition.forId(1062).getDeathAnim(), 4935);
    assert.equal(NpcDefinition.forId(5243).getAttackAnim(), 5327);
    assert.equal(NpcDefinition.forId(5243).getDefenceAnim(), 5328);
    assert.equal(NpcDefinition.forId(5243).getDeathAnim(), 5329);
    assert.equal(NpcDefinition.forId(1705).getSpawnAnim(), 6871);
    assert.equal(NpcDefinition.forId(1704).getSpawnAnim(), null);
    const spawnedRavager = new NPC(1705, new Location(0, 0, 0));
    spawnedRavager.onAdd();
    assert.equal(spawnedRavager.getAnimation()?.getId(), 6871);
    assert(NpcDefinition.forId(3129).isDemon(), "expected K'ril Tsutsaroth to retain the monster-dump demon attribute");
    assert(NpcDefinition.forId(239).getMaxHit() > 1);
    require("../plugins/items/ItemDefinitionLoader.plugin.js").register({ log() {} });
    assert.equal(ItemDefinition.forId(4151).getEquipmentType(), EquipmentType.WEAPON);
    assert.equal(ItemDefinition.forId(4151).getName(), CacheDefinitions.getItem(4151).name);
    assert.equal(CacheDefinitions.getItem(ItemIdentifiers.AVERNIC_TREADS).wearPos, 10);
    assert.equal(ItemDefinition.forId(ItemIdentifiers.AVERNIC_TREADS).getEquipmentType().getSlot(), 10);
    assert.deepEqual(ItemDefinition.forId(ItemIdentifiers.AVERNIC_TREADS).getBonuses(), [
        5, 5, 5, 11, 15,
        21, 25, 25, 10, 10,
        4, 2, 1, 0,
    ]);
    RegionManager.init();
    assert.equal(ObjectDefinition.forId(2213)?.getName(), CacheDefinitions.getObject(2213).name);
    RegionManager.loadMapFiles(3200, 3200);
    assert(RegionManager.getRegionid(12850)?.isLoaded(), "expected Lumbridge clipping to load");
    const analysis = require("../plugins/world/RegionBuildingAnalysisUtil.js");
    assert(analysis.decodeRegionTerrainData(12850));
    assert(analysis.decodeRegionObjects(12850).length > 0);
    RegionManager.loadMapFiles(3089, 3524);
    const replaced = RegionManager.getRegionid(12343);
    assert(replaced?.isLoaded(), "expected replacement region clipping to load");
    assert(replaced.clips.some((plane) => plane.some((row) => row.some(Boolean))));
    assert(MapRegionReplacementManager.getRegionPack(12343)?.equals(
        fs.readFileSync("data/regions/12343.pack"),
    ));
    console.info("cache definitions decoded", counts);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
