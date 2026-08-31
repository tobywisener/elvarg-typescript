import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { CacheDefinitions } from "../src/main/typescript/elvarg/game/cache/CacheDefinitions";
import { CachePipeline } from "../src/main/typescript/elvarg/game/cache/CachePipeline";
import { LunarSpells } from "../src/main/typescript/elvarg/game/content/combat/magic/LunarSpells";
import { MagicSpellbook } from "../src/main/typescript/elvarg/game/model/MagicSpellbook";

function spellbookPlayer() {
    let runesDeleted = 0;
    let experience = 0;
    const attributes = new Map();
    const inventory = {
        containsAllItem: () => true,
        deletes: () => { runesDeleted++; },
    };
    const player: any = {
        getSpellbook: () => MagicSpellbook.LUNAR,
        getAttribute: (key: unknown) => attributes.get(key),
        setAttribute: (key: unknown, value: unknown) => attributes.set(key, value),
        getSkillManager: () => ({
            getCurrentLevel: () => 99,
            getMaxLevel: () => 99,
            addExperiences: (_skill: unknown, xp: number) => { experience += xp; },
        }),
        getInventory: () => inventory,
        getEquipment: () => ({ getItems: () => Array.from({ length: 14 }, () => ({ getId: () => -1 })), containsAllItem: () => true, hasStaffEquipped: () => false }),
        getCombat: () => ({ reset: () => {}, setCastSpell: () => {}, setAutocastSpell: () => {}, getPoisonImmunityTimer: () => ({ start: () => {} }) }),
        performAnimation: () => {}, performGraphic: () => {},
        setPoisonDamage: () => {}, setVenomed: () => {},
        getPacketSender: () => ({ sendPoisonType: () => {}, sendMessage: () => {} }),
    };
    return { player, getRunesDeleted: () => runesDeleted, getExperience: () => experience };
}

async function main() {
    const cure = spellbookPlayer();
    assert.equal(LunarSpells.handleSelf(cure.player, "Cure Me"), true);
    assert.equal(cure.getRunesDeleted(), 3, "Cure Me consumes its three rune requirements");
    assert.equal(cure.getExperience(), 69);

    const lunar: any = LunarSpells;
    const requirements = (name: string) => Array.from(lunar.SELF.get(name).itemsRequired()).map((item: any) => [item.getId(), item.getAmount()]);
    assert.deepEqual(requirements("cure me"), [[9075, 2], [564, 2], [563, 1]]);
    assert.deepEqual(lunar.TELEPORTS.get("waterbirth teleport").itemsRequired().map((item: any) => [item.getId(), item.getAmount()]), [[9075, 1], [555, 2], [563, 1]]);
    assert.equal(LunarSpells.handleSelf(cure.player, "not a lunar spell"), false);

    await CachePipeline.initialize();
    assert.equal(CacheDefinitions.getSpellName((218 << 16) | 107, 0xffff), "Lunar Home Teleport");
    assert.equal(CacheDefinitions.getSpellName((218 << 16) | 114, 0xffff), "Moonclan Teleport");
    assert.equal(CacheDefinitions.getSpellName((218 << 16) | 116, 0xffff), "Cure Me");
    assert.equal(CacheDefinitions.getSpellName((218 << 16) | 145, 0xffff), "Vengeance");

    const networkBuilder = fs.readFileSync(
        path.resolve(__dirname, "../src/main/typescript/elvarg/net/NetworkBuilder.ts"),
        "utf8",
    );
    for (const route of [
        "LunarSpells.handleSelf(",
        "LunarSpells.handlePlayerTarget(",
        "LunarSpells.handleNpcTarget(",
        "LunarSpells.handleItemTarget(",
    ]) {
        assert.ok(networkBuilder.includes(route), `missing Lunar packet route: ${route}`);
    }

    console.info("Lunar spellbook support and packet routing OK");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
