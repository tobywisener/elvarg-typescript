import { strict as assert } from "assert";
import { LunarSpells } from "../src/main/typescript/elvarg/game/content/combat/magic/LunarSpells";
import { ArceuusSpells } from "../src/main/typescript/elvarg/game/content/combat/magic/ArceuusSpells";
import { CombatSpells } from "../src/main/typescript/elvarg/game/content/combat/magic/CombatSpells";
import { MagicSpellbook } from "../src/main/typescript/elvarg/game/model/MagicSpellbook";

function player(spellbook: MagicSpellbook) {
    const attributes = new Map<object, object>();
    let runesDeleted = 0;
    return {
        player: {
            getAttribute: (key: object) => attributes.get(key),
            setAttribute: (key: object, value: object) => attributes.set(key, value),
            getSpellbook: () => spellbook,
            getSkillManager: () => ({ getCurrentLevel: () => 99, getMaxLevel: () => 99, addExperiences: () => {} }),
            getInventory: () => ({ containsAllItem: () => true, deletes: () => { runesDeleted++; } }),
            getEquipment: () => ({ getItems: () => Array.from({ length: 14 }, () => ({ getId: () => -1 })), containsAllItem: () => true }),
            getPacketSender: () => ({ sendMessage: () => {}, sendPoisonType: () => {} }),
            getCombat: () => ({ reset: () => {}, setCastSpell: () => {}, getPoisonImmunityTimer: () => ({ start: () => {} }) }),
            performAnimation: () => {},
            performGraphic: () => {},
            setPoisonDamage: () => {},
            setVenomed: () => {},
        } as any,
        getRunesDeleted: () => runesDeleted,
    };
}

const originalNow = Date.now;
let now = 10_000;
Date.now = () => now;
try {
    assert.equal(CombatSpells.WIND_STRIKE.getAttackSpeed(), 5, "combat spells use the standard five-tick cadence");
    assert.equal(CombatSpells.UNDEAD_GRASP.getAttackSpeed(), 4, "Arceuus combat spells use their four-tick cadence");

    const combat = player(MagicSpellbook.NORMAL);
    assert.equal(CombatSpells.WIND_STRIKE.canCast(combat.player, true), true);
    assert.equal(CombatSpells.WIND_STRIKE.canCast(combat.player, true), false, "combat spells keep the one-tick cast gate");

    const lunar = player(MagicSpellbook.LUNAR);
    assert.equal(LunarSpells.handleSelf(lunar.player, "cure me"), true);
    assert.equal(LunarSpells.handleSelf(lunar.player, "cure me"), true);
    assert.equal(lunar.getRunesDeleted(), 6, "utility spells do not inherit the combat cast gate");
    now += 600;
    assert.equal(LunarSpells.handleSelf(lunar.player, "cure me"), true);
    assert.equal(lunar.getRunesDeleted(), 9);

    const arceuus = player(MagicSpellbook.ARCEUUS);
    const offering = (ArceuusSpells as any).SELF_SPELLS.get("demonic offering");
    now += 600;
    assert.equal(offering.canCast(arceuus.player, true), true);
    now += 600;
    assert.equal(offering.canCast(arceuus.player, true), false, "offering cooldown is independent of the combat cast gate");
    now += 4_800;
    assert.equal(offering.canCast(arceuus.player, true), true);

    const home = (ArceuusSpells as any).TELEPORTS.get("arceuus home teleport");
    now += 600;
    assert.equal(home.canCast(arceuus.player, true), true);
    now += 600;
    assert.equal(home.canCast(arceuus.player, true), false, "Arceuus Home Teleport has its 30-minute cooldown");
    now += 1_799_400;
    assert.equal(home.canCast(arceuus.player, true), true);

    const thrall = (ArceuusSpells as any).SELF_SPELLS.get("resurrect lesser ghost");
    now += 600;
    assert.equal(thrall.canCast(arceuus.player, true), true);
    now += 600;
    assert.equal(thrall.canCast(arceuus.player, true), false, "all resurrection spells share the 30-second cooldown");
    now += 29_400;
    assert.equal(thrall.canCast(arceuus.player, true), true);
} finally {
    Date.now = originalNow;
}

console.log("spell cooldown smoke passed");
