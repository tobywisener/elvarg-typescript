import { PrayerHandler } from "../../../content/PrayerHandler";
import { CombatFactory } from "../CombatFactory";
import { CombatType } from "../CombatType";
import { FightStyle } from '../FightStyle';
import { Misc } from "../../../../util/Misc";
import { Mobile } from "../../../entity/impl/Mobile";
import { BonusManager } from "../../../model/equipment/BonusManager";
import { Skill } from "../../../model/Skill";
import { applyMeleeAttackAccuracyModifiers, applyRangedAttackAccuracyModifiers, applyMagicAttackAccuracyModifiers, applyMeleeDefenseModifiers, applyRangedDefenseModifiers, applyMagicDefenseModifiers } from "../EquipmentEffects";
import type { Player } from '../../../entity/impl/player/Player';
import { World } from "../../../World";
import { CombatEquipment } from "../CombatEquipment";
import { PluginManager } from "../../../../plugins/PluginManager";

type RollCacheEntry = {
    cycle: number;
    effectiveAttackLevel?: number;
    effectiveDefenseLevel?: number;
    effectiveRangedAttack?: number;
    effectiveMagicLevel?: number;
    attackMeleeRoll?: number;
    attackRangedRoll?: number;
    attackMagicRoll?: number;
    defenseRangedRoll?: number;
    defenseMagicRoll?: number;
    defenseMeleeRolls?: Map<number, number>;
};

const getPlayerCombatSpecial = (player: Player): any | null => {
    const accessor = (player as any)?.getCombatSpecial;
    if (typeof accessor === "function") {
        const resolved = accessor.call(player);
        if (resolved) {
            return resolved;
        }
    }
    return (player as any)?.combatSpecial ?? null;
};

export class AccuracyFormulasDpsCalc {
    private static readonly rollCache = new WeakMap<Mobile, RollCacheEntry>();

    private static scaleRatio(value: number, numerator: number, denominator: number): number {
        return Math.floor((value * numerator) / denominator);
    }

    private static scalePercent(value: number, percent: number): number {
        return AccuracyFormulasDpsCalc.scaleRatio(value, percent, 100);
    }

    private static scaleSpecial(value: number, multiplier: number): number {
        return AccuracyFormulasDpsCalc.scaleRatio(value, Math.round(multiplier * 1000), 1000);
    }

    private static getRollCache(entity: Mobile): RollCacheEntry {
        const cycle = World.getProcessCycle();
        const cached = this.rollCache.get(entity);
        if (cached && cached.cycle === cycle) {
            return cached;
        }
        const next: RollCacheEntry = { cycle, defenseMeleeRolls: new Map<number, number>() };
        this.rollCache.set(entity, next);
        return next;
    }

    static randomFloat() {
        return Math.random();
    }

    private static randomInclusive(max: number): number {
        return Misc.randomInclusive(0, Math.max(0, Math.floor(max)));
    }

    /**
     * NPC defence bonuses live at stats[10..14], in the same order as the
     * BonusManager.DEFENCE_* indices. NpcDefinitionLoader has always loaded them,
     * but every defence roll used to hard-code 0 for NPCs - so armoured monsters
     * defended as if naked. LostCity applies npc_combat_defencebonus the same way.
     */
    private static defenceBonus(entity: Mobile, bonusIndex: number): number {
        if (entity.isNpc()) {
            return entity.getAsNpc().getCurrentDefinition().getStats()[10 + bonusIndex] ?? 0;
        }
        return entity.getAsPlayer().getBonusManager().getDefenceBonus()[bonusIndex] ?? 0;
    }

    /**
     * NPC accuracy bonuses: stats[5] melee, [7] magic, [9] ranged. See
     * NpcDefinition.DEFAULT_STATS for the full slot layout. These were hard-coded
     * to 0 until monsters-complete.json carried attack bonuses, which made every
     * NPC attack roll a bare `effective x 64`.
     */
    private static npcAttackBonus(entity: Mobile, slot: number): number {
        return entity.getAsNpc().getCurrentDefinition().getStats()[slot] ?? 0;
    }

    private static meleeAttackPrayerPercent(player: Player): number {
        if (PrayerHandler.isActivated(player, PrayerHandler.CLARITY_OF_THOUGHT)) {
            return 105;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.IMPROVED_REFLEXES)) {
            return 110;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.INCREDIBLE_REFLEXES)) {
            return 115;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.CHIVALRY)) {
            return 115;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.PIETY)) {
            return 120;
        }
        return 100;
    }

    private static defencePrayerPercent(player: Player): number {
        if (PrayerHandler.isActivated(player, PrayerHandler.THICK_SKIN)) {
            return 105;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.ROCK_SKIN)) {
            return 110;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.STEEL_SKIN)) {
            return 115;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.CHIVALRY)) {
            return 120;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.PIETY)) {
            return 125;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.RIGOUR)) {
            return 125;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.AUGURY)) {
            return 125;
        }
        return 100;
    }

    private static rangedAttackPrayerPercent(player: Player): number {
        if (PrayerHandler.isActivated(player, PrayerHandler.SHARP_EYE)) {
            return 105;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.HAWK_EYE)) {
            return 110;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.EAGLE_EYE)) {
            return 115;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.RIGOUR)) {
            return 120;
        }
        return 100;
    }

    private static magicAttackPrayerPercent(player: Player): number {
        if (PrayerHandler.isActivated(player, PrayerHandler.MYSTIC_WILL)) {
            return 105;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.MYSTIC_LORE)) {
            return 110;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.MYSTIC_MIGHT)) {
            return 115;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.AUGURY)) {
            return 125;
        }
        return 100;
    }

    public static rollAccuracy(entity: any, enemy: any, style: any) {
        if (style === CombatType.MELEE && CombatFactory.fullVeracs(entity) && this.randomInclusive(3) === 0) {
            return true;
        }

        if (style === CombatType.MELEE) {
            let attRoll = AccuracyFormulasDpsCalc.attackMeleeRoll(entity);
            let defRoll = AccuracyFormulasDpsCalc.calcDefenseMeleeRoll(entity, enemy);
            return this.randomInclusive(attRoll) > this.randomInclusive(defRoll);

        } else if (style === CombatType.RANGED) {
            let attRoll = AccuracyFormulasDpsCalc.attackRangedRoll(entity);
            attRoll = PluginManager.modifyRangedAttackRoll(entity, enemy, attRoll);
            let defRoll = AccuracyFormulasDpsCalc.defenseRangedRoll(enemy);
            return this.randomInclusive(attRoll) > this.randomInclusive(defRoll);
        } else if (style === CombatType.MAGIC) {
            let attRoll = AccuracyFormulasDpsCalc.attackMagicRoll(entity);
            let defRoll = AccuracyFormulasDpsCalc.defenseMagicRoll(enemy);
            return this.randomInclusive(attRoll) > this.randomInclusive(defRoll);
        }
        return false;
    }

    public static hitChance(attRoll: number, defRoll: number) {

        if (attRoll > defRoll) {
            return 1 - ((defRoll + 2) / (2 * (attRoll + 1)));
        } else {
            return attRoll / (2 * (defRoll + 1));
        }
    }

    public static effectiveAttackLevel(entity: Mobile) {
        const cache = this.getRollCache(entity);
        if (cache.effectiveAttackLevel != null) {
            return cache.effectiveAttackLevel;
        }
        if (entity.isNpc()) {
            const att = entity.getAsNpc().getCurrentDefinition().getStats()[0] + 9;
            cache.effectiveAttackLevel = att;
            return att;
        }

        let player = entity.getAsPlayer();
        let att = AccuracyFormulasDpsCalc.scalePercent(
            player.getSkillManager().getCurrentLevel(Skill.ATTACK),
            AccuracyFormulasDpsCalc.meleeAttackPrayerPercent(player)
        );

        let fightStyle = player.getFightType().getStyle();
        if (fightStyle == FightStyle.ACCURATE)
            att += 3;
        else if (fightStyle == FightStyle.CONTROLLED)
            att += 1;
        att += 8;

        if (CombatEquipment.wearingVoid(player, CombatType.MELEE)
            || CombatEquipment.wearingEliteVoid(player, CombatType.MELEE)) {
            att = AccuracyFormulasDpsCalc.scalePercent(att, 110);
        }

        att = Math.floor(applyMeleeAttackAccuracyModifiers(player, att));

        cache.effectiveAttackLevel = att;
        return att;
    }

    public static attackMeleeRoll(entity: Mobile) {
        const cache = this.getRollCache(entity);
        if (cache.attackMeleeRoll != null) {
            return cache.attackMeleeRoll;
        }
        let attRoll = AccuracyFormulasDpsCalc.effectiveAttackLevel(entity);

        if (entity.isNpc()) {
            // NPCs have a single melee accuracy bonus, not per-style ones.
            attRoll *= AccuracyFormulasDpsCalc.npcAttackBonus(entity, 5) + 64;
            cache.attackMeleeRoll = Math.floor(attRoll);
            return cache.attackMeleeRoll;
        }

        let player = entity.getAsPlayer();

        let attStab = player.getBonusManager().getAttackBonus()[BonusManager.ATTACK_STAB];
        let attSlash = player.getBonusManager().getAttackBonus()[BonusManager.ATTACK_SLASH];
        let attCrush = player.getBonusManager().getAttackBonus()[BonusManager.ATTACK_CRUSH];

        switch (player.getFightType().getBonusType()) {
            case BonusManager.ATTACK_STAB:
                attRoll *= attStab + 64;
                break;
            case BonusManager.ATTACK_SLASH:
                attRoll *= attSlash + 64;
                break;
            case BonusManager.ATTACK_CRUSH:
                attRoll *= attCrush + 64;
                break;
            default:
                let maxAtt = Math.max(attStab, Math.max(attCrush, attSlash));
                attRoll *= maxAtt + 64;
        }

        const special = getPlayerCombatSpecial(player);
        if (player.isSpecialActivated() && special?.getCombatMethod().type() === CombatType.MELEE) {
            attRoll = AccuracyFormulasDpsCalc.scaleSpecial(attRoll, special.getAccuracyMultiplier());
        }

        cache.attackMeleeRoll = Math.floor(attRoll);
        return cache.attackMeleeRoll;
    }

    public static effectiveDefenseLevel(enemy: Mobile) {
        const cache = this.getRollCache(enemy);
        if (cache.effectiveDefenseLevel != null) {
            return cache.effectiveDefenseLevel;
        }
        if (enemy.isNpc()) {
            cache.effectiveDefenseLevel = enemy.getAsNpc().getCurrentDefinition().getStats()[2] + 9;
            return cache.effectiveDefenseLevel;
        }

        let player = enemy.getAsPlayer();
        let def = AccuracyFormulasDpsCalc.scalePercent(
            player.getSkillManager().getCurrentLevel(Skill.DEFENCE),
            AccuracyFormulasDpsCalc.defencePrayerPercent(player)
        );

        let fightStyle = player.getFightType().getStyle();
        if (fightStyle == FightStyle.DEFENSIVE)
            def += 3;
        else if (fightStyle == FightStyle.CONTROLLED)
            def += 1;
        def += 8;

        def = Math.floor(applyMeleeDefenseModifiers(player, def));

        cache.effectiveDefenseLevel = def;
        return def;
    }

    private static calcDefenseMeleeRoll(entity: Mobile, enemy: Mobile) {
        let bonusType = (entity.isNpc() ? 3 /* Default case */ : entity.getAsPlayer().getFightType().getBonusType());

        return AccuracyFormulasDpsCalc.defenseMeleeRoll(enemy, bonusType);
    }

    public static defenseMeleeRoll(enemy: Mobile, bonusType: number) {
        const cache = this.getRollCache(enemy);
        const cachedRoll = cache.defenseMeleeRolls?.get(bonusType);
        if (cachedRoll != null) {
            return cachedRoll;
        }
        let defLevel = AccuracyFormulasDpsCalc.effectiveDefenseLevel(enemy);

        let defStab = AccuracyFormulasDpsCalc.defenceBonus(enemy, BonusManager.DEFENCE_STAB);
        let defSlash = AccuracyFormulasDpsCalc.defenceBonus(enemy, BonusManager.DEFENCE_SLASH);
        let defCrush = AccuracyFormulasDpsCalc.defenceBonus(enemy, BonusManager.DEFENCE_CRUSH);

        switch (bonusType) {
            case BonusManager.ATTACK_STAB:
                defLevel *= defStab + 64;
                break;
            case BonusManager.ATTACK_SLASH:
                defLevel *= defSlash + 64;
                break;
            case BonusManager.ATTACK_CRUSH:
                defLevel *= defCrush + 64;
                break;
            default:
                let maxDef = Math.max(defStab, Math.max(defCrush, defSlash));
                defLevel *= maxDef + 64;
        }

        const resolved = Math.floor(defLevel);
        cache.defenseMeleeRolls?.set(bonusType, resolved);
        return resolved;
    }

    // Ranged
    public static defenseRangedRoll(enemy: Mobile) {
        const cache = this.getRollCache(enemy);
        if (cache.defenseRangedRoll != null) {
            return cache.defenseRangedRoll;
        }
        let defLevel = AccuracyFormulasDpsCalc.effectiveDefenseLevel(enemy);

        const defRange = AccuracyFormulasDpsCalc.defenceBonus(enemy, BonusManager.DEFENCE_RANGE);

        defLevel = applyRangedDefenseModifiers(enemy, defLevel);
        defLevel *= defRange + 64;

        cache.defenseRangedRoll = Math.floor(defLevel);
        return cache.defenseRangedRoll;
    }

    private static effectiveRangedAttack(entity: Mobile) {
        const cache = this.getRollCache(entity);
        if (cache.effectiveRangedAttack != null) {
            return cache.effectiveRangedAttack;
        }
        if (entity.isNpc()) {
            // Prayer bonuses don't apply to NPCs (yet)
            cache.effectiveRangedAttack = entity.getAsNpc().getCurrentDefinition().getStats()[3] + 9;
            return cache.effectiveRangedAttack;
        }

        let player = entity.getAsPlayer();
        let rngStrength = AccuracyFormulasDpsCalc.scalePercent(
            player.getSkillManager().getCurrentLevel(Skill.RANGED),
            AccuracyFormulasDpsCalc.rangedAttackPrayerPercent(player)
        );

        let fightStyle = player.getFightType().getStyle();
        if (fightStyle == FightStyle.ACCURATE)
            rngStrength += 3;
        rngStrength += 8;

        if (CombatEquipment.wearingEliteVoid(player, CombatType.RANGED)) {
            rngStrength = AccuracyFormulasDpsCalc.scaleRatio(rngStrength, 1125, 1000);
        } else if (CombatEquipment.wearingVoid(player, CombatType.RANGED)) {
            rngStrength = AccuracyFormulasDpsCalc.scalePercent(rngStrength, 110);
        }

        rngStrength = Math.floor(applyRangedAttackAccuracyModifiers(player, rngStrength));

        //    if (dragonHunter(input))
        //        rngStrength =
        cache.effectiveRangedAttack = rngStrength;
        return rngStrength;
    }

    public static attackRangedRoll(entity: Mobile) {
        const cache = this.getRollCache(entity);
        if (cache.attackRangedRoll != null) {
            return cache.attackRangedRoll;
        }
        let accuracyBonus = (entity.isNpc()
            ? AccuracyFormulasDpsCalc.npcAttackBonus(entity, 9)
            : entity.getAsPlayer().getBonusManager().getAttackBonus()[BonusManager.ATTACK_RANGE]);

        let attRoll = AccuracyFormulasDpsCalc.effectiveRangedAttack(entity);

        attRoll *= (accuracyBonus + 64);

        if (entity.isPlayer()) {
            const player = entity.getAsPlayer();
            const special = getPlayerCombatSpecial(player);
            if (player.isSpecialActivated() && special?.getCombatMethod().type() === CombatType.RANGED) {
                attRoll = AccuracyFormulasDpsCalc.scaleSpecial(attRoll, special.getAccuracyMultiplier());
            }
        }

        cache.attackRangedRoll = Math.floor(attRoll);
        return cache.attackRangedRoll;
    }

    private static effectiveMagicLevel(entity: Mobile) {
        const cache = this.getRollCache(entity);
        if (cache.effectiveMagicLevel != null) {
            return cache.effectiveMagicLevel;
        }
        if (entity.isNpc()) {
            // Prayer bonuses don't apply to NPCs (yet)
            const mag = entity.getAsNpc().getCurrentDefinition().getStats()[4] + 9;
            cache.effectiveMagicLevel = mag;
            return mag;
        }

        let player = entity.getAsPlayer();
        let mag = AccuracyFormulasDpsCalc.scalePercent(
            player.getSkillManager().getCurrentLevel(Skill.MAGIC),
            AccuracyFormulasDpsCalc.magicAttackPrayerPercent(player)
        );

        // +8 base, +1 style. Magic's style bonus is always 1 regardless of the
        // weapon's selected melee stance - a caster's FightType is still their
        // staff's bash/pound/focus, so reading it here handed staves left on
        // Accurate a free +3 magic attack.
        mag += 9;

        if (CombatEquipment.wearingVoid(player, CombatType.MAGIC)
            || CombatEquipment.wearingEliteVoid(player, CombatType.MAGIC)) {
            mag = AccuracyFormulasDpsCalc.scalePercent(mag, 145);
        }

        mag = Math.floor(applyMagicAttackAccuracyModifiers(player, mag));

        cache.effectiveMagicLevel = mag;
        return mag;
    }

    public static defenseMagicRoll(enemy: Mobile): number {
        const cache = this.getRollCache(enemy);
        if (cache.defenseMagicRoll != null) {
            return cache.defenseMagicRoll;
        }
        let defLevel: number;

        if (enemy.isNpc()) {
            defLevel = enemy.getAsNpc().getCurrentDefinition().getStats()[4] + 9;
        } else {
            const player = enemy.getAsPlayer();
            const magicLevel = AccuracyFormulasDpsCalc.scalePercent(
                player.getSkillManager().getCurrentLevel(Skill.MAGIC),
                AccuracyFormulasDpsCalc.magicAttackPrayerPercent(player)
            );
            const defenceLevel = AccuracyFormulasDpsCalc.scalePercent(
                player.getSkillManager().getCurrentLevel(Skill.DEFENCE),
                AccuracyFormulasDpsCalc.defencePrayerPercent(player)
            );
            defLevel = AccuracyFormulasDpsCalc.scaleRatio(
                magicLevel * 7 + defenceLevel * 3,
                1,
                10
            ) + 8;
            defLevel = applyMagicDefenseModifiers(player, defLevel);
        }

        let defRange = AccuracyFormulasDpsCalc.defenceBonus(enemy, BonusManager.DEFENCE_MAGIC);

        defLevel *= (defRange + 64);

        cache.defenseMagicRoll = Math.floor(defLevel);
        return cache.defenseMagicRoll;
    }

    public static attackMagicRoll(entity: Mobile): number {
        const cache = this.getRollCache(entity);
        if (cache.attackMagicRoll != null) {
            return cache.attackMagicRoll;
        }
        let accuracyBonus = (entity.isNpc()
            ? AccuracyFormulasDpsCalc.npcAttackBonus(entity, 7)
            : entity.getAsPlayer().getBonusManager().getAttackBonus()[BonusManager.ATTACK_MAGIC]);

        let attRoll = AccuracyFormulasDpsCalc.effectiveMagicLevel(entity);
        attRoll *= (accuracyBonus + 64);

        if (entity.isPlayer()) {
            const player = entity.getAsPlayer();
            const special = getPlayerCombatSpecial(player);
            if (player.isSpecialActivated() && special?.getCombatMethod().type() === CombatType.MAGIC) {
                attRoll = AccuracyFormulasDpsCalc.scaleSpecial(attRoll, special.getAccuracyMultiplier());
            }
        }

        const demonbaneMultiplier = (entity.getCombat().getSelectedSpell() as any)?.demonbaneAccuracyMultiplier?.(entity);
        if (typeof demonbaneMultiplier === "number") {
            attRoll = AccuracyFormulasDpsCalc.scaleSpecial(attRoll, demonbaneMultiplier);
        }

        cache.attackMagicRoll = Math.floor(attRoll);
        return cache.attackMagicRoll;
    }
}
