import { BonusManager } from "../../../model/equipment/BonusManager";
import { Skill } from "../../../model/Skill";
import { PrayerHandler } from "../../PrayerHandler";
import { CombatType } from "../CombatType";
import { FightStyle } from "../FightStyle";
import { Mobile } from "../../../entity/impl/Mobile";
import type { Player } from "../../../entity/impl/player/Player";
import type { NPC } from "../../../entity/impl/npc/NPC";
import { applyMagicHitModifiers, applyMeleeHitModifiers } from "../EquipmentEffects";
import { CombatEquipment } from "../CombatEquipment";

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

export class DamageFormulas {
    private static floorPrayerLevel(level: number, prayerBonus: number): number {
        return Math.floor(level * prayerBonus);
    }

    private static applyEffectiveLevelBonus(baseLevel: number, bonus: number): number {
        return baseLevel + bonus + 8;
    }

    private static applyVoidMultiplier(baseLevel: number, multiplier: number): number {
        return Math.floor(baseLevel * multiplier);
    }

    private static meleeStrengthPrayerBonus(player: Player): number {
        if (PrayerHandler.isActivated(player, PrayerHandler.BURST_OF_STRENGTH)) {
            return 1.05;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.SUPERHUMAN_STRENGTH)) {
            return 1.10;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.ULTIMATE_STRENGTH)) {
            return 1.15;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.CHIVALRY)) {
            return 1.18;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.PIETY)) {
            return 1.23;
        }
        return 1;
    }

    private static rangedStrengthPrayerBonus(player: Player): number {
        if (PrayerHandler.isActivated(player, PrayerHandler.SHARP_EYE)) {
            return 1.05;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.HAWK_EYE)) {
            return 1.10;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.EAGLE_EYE)) {
            return 1.15;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.RIGOUR)) {
            return 1.23;
        }
        return 1;
    }

    private static effectiveStrengthLevel(player: Player): number {
        const prayerAdjusted = DamageFormulas.floorPrayerLevel(
            player.getSkillManager().getCurrentLevel(Skill.STRENGTH),
            DamageFormulas.meleeStrengthPrayerBonus(player)
        );

        let styleBonus = 0;
        let fightStyle = player.getFightType().getStyle();
        if (fightStyle == FightStyle.AGGRESSIVE)
            styleBonus = 3;
        else if (fightStyle == FightStyle.CONTROLLED)
            styleBonus = 1;

        let effectiveLevel = DamageFormulas.applyEffectiveLevelBonus(prayerAdjusted, styleBonus);

        if (CombatEquipment.wearingVoid(player, CombatType.MELEE)) {
            effectiveLevel = DamageFormulas.applyVoidMultiplier(effectiveLevel, 1.1);
        }

        return effectiveLevel;
    }

    public static calculateMaxMeleeHit(entity: Mobile): number {
        let maxHit: number;
        if (entity.isPlayer()) {
            let player = entity.getAsPlayer();
            let strengthBonus = player.getBonusManager().getOtherBonus()[BonusManager.STRENGTH];
            maxHit = DamageFormulas.effectiveStrengthLevel(player) * (strengthBonus + 64);
            maxHit += 320;
            maxHit /= 640;

            const special = getPlayerCombatSpecial(player);
            if (player.isSpecialActivated() && special != null) {
                maxHit *= special.getStrengthMultiplier();
            }

        } else {
            maxHit = entity.getAsNpc().getCurrentDefinition().getMaxHit();
        }
        const adjusted = applyMeleeHitModifiers(entity, maxHit);
        return Math.floor(adjusted);
    }

    public static getMagicMaxhit(c: Mobile): number {
        let maxHit = 0;
        const spell = c.getCombat().getSelectedSpell();

        if (spell && spell.maximumHit() > 0) {
            maxHit = spell.maximumHit();
        } else if (c.isNpc()) {
            maxHit = c.getAsNpc().getDefinition().getMaxHit();
        } else {
            maxHit = 1;
        }

        const { CombatSpells } = require("../magic/CombatSpells") as typeof import("../magic/CombatSpells");
        maxHit = CombatSpells.applyChargeMaxHit(c, maxHit);

        if (c.isPlayer()) {
            const player = c.getAsPlayer();
            const magicStrength = player.getBonusManager().getOtherBonus()[BonusManager.MAGIC_STRENGTH];
            maxHit *= 1 + (magicStrength / 100);
        }

        const demonbaneMultiplier = (spell as any)?.demonbaneDamageMultiplier?.(c);
        if (typeof demonbaneMultiplier === "number") {
            maxHit *= demonbaneMultiplier;
        }

        return Math.floor(applyMagicHitModifiers(c, maxHit));
    }

    private static effectiveRangedStrength(player: Player): number {
        const prayerAdjusted = DamageFormulas.floorPrayerLevel(
            player.getSkillManager().getCurrentLevel(Skill.RANGED),
            DamageFormulas.rangedStrengthPrayerBonus(player)
        );

        let styleBonus = 0;
        let fightStyle = player.getFightType().getStyle();
        if (fightStyle == FightStyle.ACCURATE)
            styleBonus = 3;

        let effectiveLevel = DamageFormulas.applyEffectiveLevelBonus(prayerAdjusted, styleBonus);

        if (CombatEquipment.wearingEliteVoid(player, CombatType.RANGED)) {
            effectiveLevel = DamageFormulas.applyVoidMultiplier(effectiveLevel, 1.125);
        } else if (CombatEquipment.wearingVoid(player, CombatType.RANGED)) {
            effectiveLevel = DamageFormulas.applyVoidMultiplier(effectiveLevel, 1.1);
        }

        // if (dragonHunter(input))
        // rngStrength = (int) (rngStrength * 1.3f);
        return effectiveLevel;
    }

    private static maximumRangeHitDpsCalc(player: Player) {
        let strengthBonus = player.getBonusManager().getOtherBonus()[BonusManager.RANGED_STRENGTH];
        let maxHit = DamageFormulas.effectiveRangedStrength(player);
        maxHit *= (strengthBonus + 64);
        maxHit += 320;
        maxHit /= 640;

        const special = getPlayerCombatSpecial(player);
        if (
            player.isSpecialActivated() &&
            special != null &&
            special.getCombatMethod().type() == CombatType.RANGED
        ) {
            maxHit *= special.getStrengthMultiplier();
        }

        return Math.floor(maxHit);
    }

    /**
    Calculates the maximum ranged hit for the argued entity without
    taking the victim into consideration.
    @param entity the entity to calculate the maximum hit for.
    @return the maximum ranged hit that this entity can deal.
    */
    public static calculateMaxRangedHit(entity: Mobile) {
        if (entity.isNpc()) {
            let npc = entity as unknown as NPC;
            return npc.getCurrentDefinition().getMaxHit();
        }

        let player = entity as Player;

        return DamageFormulas.maximumRangeHitDpsCalc(player);
    }

}
