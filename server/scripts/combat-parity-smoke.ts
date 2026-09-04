/**
 * Covers the LostCity combat-parity fixes:
 *  - NPC defence bonuses are read from stats[10..14] instead of hard-coded 0
 *  - hit XP ratios (magic 1/2, hitpoints 1/3, defensive-cast defence 1/4)
 *  - damage is capped to the target's HP at roll time (tick eating)
 *  - HitQueue drains once per cycle, at the top of the owner's turn
 *  - monsters-complete.json normalisation, attack_type styles and venom
 */
import * as assert from "node:assert/strict";
// Import order matters: the combat graph is circular, and pulling the formula
// module first initialises PrayerHandler before QuickPrayers is ready.
import { World } from "../src/main/typescript/elvarg/game/World";
import { Combat } from "../src/main/typescript/elvarg/game/content/combat/Combat";
import { CombatFactory } from "../src/main/typescript/elvarg/game/content/combat/CombatFactory";
import { AccuracyFormulasDpsCalc } from "../src/main/typescript/elvarg/game/content/combat/formula/AccuracyFormulasDpsCalc";
import { DamageFormulas } from "../src/main/typescript/elvarg/game/content/combat/formula/DamageFormulas";
import { CombatType } from "../src/main/typescript/elvarg/game/content/combat/CombatType";
import { HitDamage } from "../src/main/typescript/elvarg/game/content/combat/hit/HitDamage";
import { HitMask } from "../src/main/typescript/elvarg/game/content/combat/hit/HitMask";
import { HitQueue } from "../src/main/typescript/elvarg/game/content/combat/hit/HitQueue";
import { PendingHit } from "../src/main/typescript/elvarg/game/content/combat/hit/PendingHit";
import { BonusManager } from "../src/main/typescript/elvarg/game/model/equipment/BonusManager";
import { Skill } from "../src/main/typescript/elvarg/game/model/Skill";
import { NpcDefinitionLoader } from "../src/main/typescript/elvarg/game/definition/loader/impl/NpcDefinitionLoader";

void World;
void Combat;

const originalGetHitDamage = CombatFactory.getHitDamage;
const originalApplyExtraHitRolls = CombatFactory.applyExtraHitRolls;
const originalRollAccuracy = AccuracyFormulasDpsCalc.rollAccuracy;
const originalExecuteHit = CombatFactory.executeHit;

try {
    // --- integer combat arithmetic ------------------------------------------
    assert.equal(
        (DamageFormulas as any).scalePercent(100, 115),
        115,
        "a 15% multiplier must not become 114 through binary floating point"
    );
    assert.equal(
        (AccuracyFormulasDpsCalc as any).scaleRatio(99, 1125, 1000),
        111,
        "elite Void's 12.5% multiplier is floored at its own step"
    );
    assert.equal(
        (DamageFormulas as any).scaleSpecial(10, 1.15),
        11,
        "special multipliers apply after the base max hit is floored"
    );

    for (let attackRoll = 0; attackRoll < 50; attackRoll++) {
        for (let defenceRoll = 0; defenceRoll < 50; defenceRoll++) {
            let wins = 0;
            for (let attack = 0; attack <= attackRoll; attack++) {
                for (let defence = 0; defence <= defenceRoll; defence++) {
                    if (attack > defence) wins++;
                }
            }
            const total = (attackRoll + 1) * (defenceRoll + 1);
            const expectedChance = attackRoll > defenceRoll
                ? 1 - ((defenceRoll + 2) / (2 * (attackRoll + 1)))
                : attackRoll / (2 * (defenceRoll + 1));
            assert.equal(
                AccuracyFormulasDpsCalc.hitChance(attackRoll, defenceRoll),
                expectedChance,
                "the reported hit chance must use the OSRS branch formula"
            );
            if (attackRoll > defenceRoll) {
                assert.equal(
                    wins * 2 * (attackRoll + 1),
                    (2 * attackRoll - defenceRoll) * total,
                    "inclusive accuracy rolls must match the OSRS hit-chance formula"
                );
            } else {
                assert.equal(
                    wins * 2 * (defenceRoll + 1),
                    attackRoll * total,
                    "inclusive accuracy rolls must match the OSRS hit-chance formula"
                );
            }
        }
    }

    // --- NPC defence bonuses are actually read -------------------------------
    // stats[2] is the defence level, stats[10..14] the per-style defence bonuses
    // in BonusManager.DEFENCE_* order. Both used to be ignored for NPCs.
    const armouredNpc = (): any => {
        const stats = new Array(18).fill(0);
        stats[0] = 1;    // attack level 1 -> effective 10
        stats[2] = 1;    // defence level 1 -> effective 10
        stats[3] = 1;    // ranged level
        stats[4] = 1;    // magic level
        stats[5] = 30;   // melee accuracy bonus
        stats[7] = 15;   // magic accuracy bonus
        stats[9] = 25;   // ranged accuracy bonus
        stats[10] = 0;   // stab
        stats[12] = 100; // crush
        stats[14] = 40;  // ranged
        stats[13] = 20;  // magic
        const npc: any = {
            isNpc: () => true,
            isPlayer: () => false,
            getCurrentDefinition: () => ({ getStats: () => stats }),
        };
        npc.getAsNpc = () => npc;
        return npc;
    };

    const npc = armouredNpc();
    assert.equal(
        AccuracyFormulasDpsCalc.defenseMeleeRoll(npc, BonusManager.ATTACK_CRUSH),
        10 * (100 + 64),
        "an NPC's crush defence bonus must feed the defence roll"
    );
    assert.equal(
        AccuracyFormulasDpsCalc.defenseMeleeRoll(npc, BonusManager.ATTACK_STAB),
        10 * (0 + 64),
        "a zero bonus still yields the bare +64 roll"
    );
    assert.equal(
        AccuracyFormulasDpsCalc.defenseRangedRoll(armouredNpc()),
        10 * (40 + 64),
        "an NPC's ranged defence bonus must feed the ranged defence roll"
    );

    // ...and the attack side, which used to be a bare `effective x 64`.
    assert.equal(
        AccuracyFormulasDpsCalc.attackMeleeRoll(armouredNpc()),
        10 * (30 + 64),
        "an NPC's melee accuracy bonus must feed the attack roll"
    );
    assert.equal(
        AccuracyFormulasDpsCalc.attackRangedRoll(armouredNpc()),
        10 * (25 + 64),
        "an NPC's ranged accuracy bonus must feed the attack roll"
    );
    assert.equal(
        AccuracyFormulasDpsCalc.attackMagicRoll(armouredNpc()),
        10 * (15 + 64),
        "an NPC's magic accuracy bonus must feed the attack roll"
    );

    // --- monster dump -> internal stats --------------------------------------
    const dumped = NpcDefinitionLoader.fromMonsterDump({
        name: "King Black Dragon",
        hitpoints: 240, attack_level: 240, strength_level: 240, defence_level: 240,
        magic_level: 240, ranged_level: 70, attack_speed: 4, max_hit: 25,
        aggressive: true, poisonous: false, slayer_monster: false, slayer_level: 0,
        attack_bonus: 80, attack_magic: 0, attack_ranged: 0,
        defence_stab: 40, defence_slash: 90, defence_crush: 90, defence_magic: 80,
        defence_ranged_standard: 70, defence_ranged_light: 5, defence_ranged_heavy: 9,
    });
    assert.equal(dumped.defenceBonuses?.ranged, 70, "ranged defence comes from the standard split");
    assert.equal(dumped.attackBonuses?.melee, 80, "melee accuracy bonus is imported");
    assert.equal(dumped.maxHit, 25, "max hit is imported when present");

    assert.equal(
        NpcDefinitionLoader.fromMonsterDump({ name: "x", max_hit: null }).maxHit,
        undefined,
        "a null max hit must not become 0 - it has to fall through to the default"
    );

    // --- attack_type -> combat style ------------------------------------------
    const rat = NpcDefinitionLoader.resolveAttackType;
    assert.equal(rat(["ranged"]), CombatType.RANGED, "a pure ranged monster ranges");
    assert.equal(rat(["magic"]), CombatType.MAGIC, "a pure magic monster casts");
    assert.equal(rat(["magic", "ranged"]), CombatType.RANGED, "ranged wins over magic when both and no melee");
    assert.equal(rat(["crush"]), CombatType.MELEE, "a melee token means melee");
    assert.equal(rat(["crush", "ranged"]), CombatType.MELEE,
        "a hybrid that can melee keeps meleeing - one method per NPC");
    assert.equal(rat(["magic", "melee"]), CombatType.MELEE, "...including the explicit melee token");
    assert.equal(rat(["dragonfire", "slash"]), CombatType.MELEE, "dragonfire is not a style we model");
    assert.equal(rat(["typeless"]), CombatType.MELEE, "typeless falls back to melee");
    assert.equal(rat([]), CombatType.MELEE, "so does an empty list");
    assert.equal(rat(undefined), CombatType.MELEE, "and a missing one");

    // --- venomous -------------------------------------------------------------
    assert.equal(
        NpcDefinitionLoader.fromMonsterDump({ name: "Zulrah", venomous: true }).venomous,
        true,
        "a venomous monster is flagged"
    );
    assert.equal(
        NpcDefinitionLoader.fromMonsterDump({ name: "Rat", poisonous: true }).venomous,
        false,
        "a merely poisonous one is not"
    );

    // --- hit XP ratios -------------------------------------------------------
    // One melee style is the unit (4 xp/damage in OSRS). Magic pays half that,
    // hitpoints a third, and a defensive cast splits 1.33 magic / 1.0 defence.
    const awarded: Array<[string, number]> = [];
    const xpPlayer: any = {
        getSkillManager: () => ({
            addExperience: (skill: any, xp: number) => awarded.push([skill.getName(), xp]),
        }),
        getCombat: () => ({ getPreviousCast: () => ({}) }),
    };
    const xpHit = (type: CombatType, damage: number, skills: number[]): any => ({
        getTotalDamage: () => damage,
        getSkills: () => skills,
        getCombatType: () => type,
        isAccurate: () => true,
    });
    const xpFor = (skill: string) =>
        awarded.filter(([name]) => name === skill).reduce((total, [, xp]) => total + xp, 0);

    awarded.length = 0;
    CombatFactory.rewardExp(xpPlayer, xpHit(CombatType.MELEE, 12, [Skill.ATTACK.getIndex()]));
    assert.equal(xpFor("Attack"), 12, "a single melee style takes the full unit");
    assert.equal(xpFor("Hitpoints"), 4, "hitpoints is a third of the style xp, not 0.7x");

    awarded.length = 0;
    CombatFactory.rewardExp(xpPlayer, xpHit(CombatType.MAGIC, 12, [Skill.MAGIC.getIndex()]));
    assert.equal(xpFor("Magic"), 6, "a standard cast pays half the melee unit");
    assert.equal(xpFor("Hitpoints"), 4, "hitpoints is unaffected by combat style");

    awarded.length = 0;
    CombatFactory.rewardExp(
        xpPlayer,
        xpHit(CombatType.MAGIC, 12, [Skill.MAGIC.getIndex(), Skill.DEFENCE.getIndex()])
    );
    assert.equal(xpFor("Magic"), 4, "a defensive cast pays 1.33/damage to magic");
    assert.equal(xpFor("Defence"), 3, "...and 1.0/damage to defence, not an even split");

    // --- damage is capped to the target's HP at roll time --------------------
    (AccuracyFormulasDpsCalc as any).rollAccuracy = () => true;
    (CombatFactory as any).getHitDamage = () => new HitDamage(999, HitMask.RED);
    (CombatFactory as any).applyExtraHitRolls = () => undefined;

    const meleeMethod: any = { type: () => CombatType.MELEE };
    const attacker: any = { isNpc: () => false, isPlayer: () => true };
    const lowHpTarget: any = { getHitpoints: () => 7 };

    const single = new PendingHit(attacker, lowHpTarget, meleeMethod);
    assert.equal(single.getTotalDamage(), 7, "an overkill roll is capped to the target's HP");

    const multi = new PendingHit(attacker, lowHpTarget, meleeMethod, { hitAmount: 2 });
    assert.equal(multi.getTotalDamage(), 7, "a multi-hit shares one HP budget, it does not double it");
    assert.deepEqual(
        multi.getHits().map((h) => h.getDamage()),
        [7, 0],
        "the budget is consumed in order"
    );

    // --- HitQueue drains once per cycle --------------------------------------
    let executed = 0;
    (CombatFactory as any).executeHit = () => { executed++; };

    const owner: any = {
        isRegistered: () => true,
        getHitpoints: () => 10,
        isUntargetable: () => false,
        // Pretend both hitsplats are already used so pendingDamage is left alone.
        getUpdateFlag: () => ({ flagged: () => true, flag: () => undefined }),
    };
    const queue = new HitQueue(owner);
    const queuedHit: any = {
        getTarget: () => owner,
        getAttacker: () => ({ isRegistered: () => true, getHitpoints: () => 10 }),
        getTotalDamage: () => 3,
        getHits: () => [],
    };
    queue.addPendingHit(queuedHit, 100);

    queue.process(99);
    assert.equal(executed, 0, "a hit does not land before its reveal cycle");
    queue.process(100);
    assert.equal(executed, 1, "the hit lands on its reveal cycle");
    queue.process(100);
    HitQueue.processAll(100);
    assert.equal(executed, 1, "the end-of-tick sweep must not re-apply what the turn already drained");

    console.log("combat parity smoke passed");
} finally {
    (CombatFactory as any).getHitDamage = originalGetHitDamage;
    (CombatFactory as any).applyExtraHitRolls = originalApplyExtraHitRolls;
    (AccuracyFormulasDpsCalc as any).rollAccuracy = originalRollAccuracy;
    (CombatFactory as any).executeHit = originalExecuteHit;
}
