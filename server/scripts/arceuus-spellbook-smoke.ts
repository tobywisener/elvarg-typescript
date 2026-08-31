import * as assert from "node:assert/strict";
import { ArceuusItemSpells } from "../src/main/typescript/elvarg/game/content/combat/magic/ArceuusItemSpells";
import { ArceuusSpells } from "../src/main/typescript/elvarg/game/content/combat/magic/ArceuusSpells";
import { ArceuusThralls } from "../src/main/typescript/elvarg/game/content/combat/magic/ArceuusThralls";
import { ArceuusUtilities } from "../src/main/typescript/elvarg/game/content/combat/magic/ArceuusUtilities";
import { CombatSpells } from "../src/main/typescript/elvarg/game/content/combat/magic/CombatSpells";
import { EffectSpells } from "../src/main/typescript/elvarg/game/content/combat/magic/EffectSpells";
import { Item } from "../src/main/typescript/elvarg/game/model/Item";
import { MagicSpellbook } from "../src/main/typescript/elvarg/game/model/MagicSpellbook";
import { TeleportType } from "../src/main/typescript/elvarg/game/model/teleportation/TeleportType";

const ids = (items: any[]) => items.map((item) => [item.getId(), item.getAmount()]);

function main() {
    assert.equal(MagicSpellbook.ARCEUUS.getInterfaceId(), 39999);
    assert.equal(MagicSpellbook.ARCEUUS.getTeleportType(), TeleportType.ARCEUUS);

    const selfSpells: Map<string, any> = (ArceuusSpells as any).SELF_SPELLS;
    const teleports: Map<string, any> = (ArceuusSpells as any).TELEPORTS;
    for (const name of [
        "ward of arceuus", "mark of darkness", "lesser corruption", "greater corruption",
        "demonic offering", "sinister offering", "death charge", "degrime", "shadow veil", "vile vigour",
        "resurrect lesser ghost", "resurrect superior ghost", "resurrect greater ghost",
        "resurrect lesser skeleton", "resurrect superior skeleton", "resurrect greater skeleton",
        "resurrect lesser zombie", "resurrect superior zombie", "resurrect greater zombie",
    ]) assert(selfSpells.has(name), `missing Arceuus self spell: ${name}`);
    for (const name of [
        "arceuus home teleport", "arceuus library teleport", "draynor manor teleport", "battlefront teleport",
        "mind altar teleport", "respawn teleport", "salve graveyard teleport", "fenkenstrain's castle teleport",
        "west ardougne teleport", "harmony island teleport", "cemetery teleport", "barrows teleport", "ape atoll teleport",
    ]) assert(teleports.has(name), `missing Arceuus teleport: ${name}`);

    assert.deepEqual(ids(selfSpells.get("vile vigour").itemsRequired()), [[566, 1], [556, 3]]);
    assert.deepEqual(ids(selfSpells.get("resurrect greater zombie").itemsRequired()), [[565, 5], [554, 10], [564, 1]]);
    assert.deepEqual(ids(teleports.get("battlefront teleport").itemsRequired()), [[557, 1], [554, 1], [563, 1]]);
    assert.deepEqual(ids(teleports.get("salve graveyard teleport").itemsRequired()), [[566, 2], [563, 1]]);

    let runEnergy = 90;
    let prayerDecrease = 0;
    const vileVigourPlayer: any = {
        getRunEnergy: () => runEnergy,
        setRunEnergy: (value: number) => runEnergy = value,
        getSkillManager: () => ({
            getCurrentLevel: () => 25,
            decreaseCurrentLevel: (_skill: any, amount: number) => prayerDecrease += amount,
        }),
        getPacketSender: () => ({ sendRunEnergy: () => {} }),
    };
    (selfSpells.get("vile vigour") as any).data.effect(vileVigourPlayer);
    assert.equal(prayerDecrease, 25, "Vile Vigour consumes all remaining Prayer");
    assert.equal(runEnergy, 100, "Vile Vigour caps converted run energy at 100");

    assert.equal(CombatSpells.GHOSTLY_GRASP.getSpellbook(), MagicSpellbook.ARCEUUS);
    assert.deepEqual(ids(CombatSpells.GHOSTLY_GRASP.itemsRequired(null as any)), [[556, 4], [562, 1]]);
    assert.equal(CombatSpells.DARK_DEMONBANE.getSpellbook(), MagicSpellbook.ARCEUUS);
    assert.equal(CombatSpells.MARK_OF_DARKNESS.getSpellbook(), MagicSpellbook.ARCEUUS);
    assert.equal(CombatSpells.GREATER_CORRUPTION.getSpellbook(), MagicSpellbook.ARCEUUS);
    const combatSpellNames: Array<[string, any]> = [
        ["Ghostly Grasp", CombatSpells.GHOSTLY_GRASP],
        ["Skeletal Grasp", CombatSpells.SKELETAL_GRASP],
        ["Undead Grasp", CombatSpells.UNDEAD_GRASP],
        ["Inferior Demonbane", CombatSpells.INFERIOR_DEMONBANE],
        ["Superior Demonbane", CombatSpells.SUPERIOR_DEMONBANE],
        ["Dark Demonbane", CombatSpells.DARK_DEMONBANE],
        ["Dark Lure", CombatSpells.DARK_LURE],
    ];
    for (const [name, spell] of combatSpellNames) {
        assert.equal(CombatSpells.getCombatSpellByName(name), spell, `client spell name should resolve: ${name}`);
    }
    assert.equal(ArceuusItemSpells.BASIC_REANIMATION, 11997);
    assert.equal(ArceuusItemSpells.MASTER_REANIMATION, 6888);
    assert.equal(EffectSpells.forSpellId(9136), EffectSpells.VENGEANCE, "cache Vengeance id should resolve");

    const summonCalls: any[][] = [];
    const originalSummon = ArceuusThralls.summon;
    (ArceuusThralls as any).summon = (...args: any[]) => summonCalls.push(args);
    try {
        (selfSpells.get("resurrect superior ghost") as any).data.effect({});
        (selfSpells.get("resurrect greater zombie") as any).data.effect({});
    } finally {
        (ArceuusThralls as any).summon = originalSummon;
    }
    assert.deepEqual(summonCalls.map((call) => call.slice(1)), [[10879, 4, 2, 6], [10886, 6, 3, 1]]);
    for (const [name, spell] of selfSpells) {
        if (name.startsWith("resurrect ")) {
            assert.deepEqual((spell as any).data.cooldown, { attribute: "arceuus:thrallUntil", duration: 30_000 });
            assert.equal((spell as any).usesSharedCastDelay(), true);
        }
    }
    assert.equal((selfSpells.get("demonic offering") as any).usesSharedCastDelay(), false);

    let pvpMessage = "";
    assert.equal(ArceuusSpells.handleSpell({
        getCombat: () => ({ getTarget: () => ({ isPlayer: () => true }), getAttacker: () => null }),
        getPacketSender: () => ({ sendMessage: (message: string) => pvpMessage = message }),
    } as any, "resurrect lesser ghost"), true);
    assert.equal(pvpMessage, "You cannot summon a Thrall during PvP combat.");

    const herbs = [new Item(199), new Item(3049), new Item(3051)];
    let herbloreXp = 0;
    const utilityPlayer: any = {
        getInventory: () => ({ getValidItems: () => herbs, refreshItems: () => {} }),
        getSkillManager: () => ({ addExperiences: (_skill: any, xp: number) => herbloreXp += xp }),
    };
    ArceuusUtilities.degrime(utilityPlayer);
    assert.deepEqual(herbs.map((herb) => herb.getId()), [249, 2998, 3000]);
    assert.equal(herbloreXp, 15.75);
    console.info("Arceuus spellbook definitions OK");
}

main();
