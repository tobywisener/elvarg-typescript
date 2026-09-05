import { BonusManager } from "../../../model/equipment/BonusManager";
import { Skill } from "../../../model/Skill";
import { PrayerHandler } from "../../PrayerHandler";
import { CombatType } from "../CombatType";
import { FightStyle } from "../FightStyle";
import { Mobile } from "../../../entity/impl/Mobile";
import type { Player } from "../../../entity/impl/player/Player";
import type { NPC } from "../../../entity/impl/npc/NPC";
import type { CombatSpell } from "../magic/CombatSpell";
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
    private static scaleRatio(value: number, numerator: number, denominator: number): number {
        return Math.floor((value * numerator) / denominator);
    }

    private static scalePercent(value: number, percent: number): number {
        return DamageFormulas.scaleRatio(value, percent, 100);
    }

    // CombatSpecial currently stores fixed decimal configuration values. Convert
    // that configuration once, then keep the actual combat calculation integral.
    private static scaleSpecial(value: number, multiplier: number): number {
        return DamageFormulas.scaleRatio(value, Math.round(multiplier * 1000), 1000);
    }

    private static applyEffectiveLevelBonus(baseLevel: number, bonus: number): number {
        return baseLevel + bonus + 8;
    }

    private static applyVoidMultiplier(baseLevel: number, numerator: number, denominator = 100): number {
        return DamageFormulas.scaleRatio(baseLevel, numerator, denominator);
    }

    private static meleeStrengthPrayerPercent(player: Player): number {
        if (PrayerHandler.isActivated(player, PrayerHandler.BURST_OF_STRENGTH)) {
            return 105;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.SUPERHUMAN_STRENGTH)) {
            return 110;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.ULTIMATE_STRENGTH)) {
            return 115;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.CHIVALRY)) {
            return 118;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.PIETY)) {
            return 123;
        }
        return 100;
    }

    private static rangedStrengthPrayerPercent(player: Player): number {
        if (PrayerHandler.isActivated(player, PrayerHandler.SHARP_EYE)) {
            return 105;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.HAWK_EYE)) {
            return 110;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.EAGLE_EYE)) {
            return 115;
        } else if (PrayerHandler.isActivated(player, PrayerHandler.RIGOUR)) {
            return 123;
        }
        return 100;
    }

    private static effectiveStrengthLevel(player: Player): number {
        const prayerAdjusted = DamageFormulas.scalePercent(
            player.getSkillManager().getCurrentLevel(Skill.STRENGTH),
            DamageFormulas.meleeStrengthPrayerPercent(player)
        );

        let styleBonus = 0;
        let fightStyle = player.getFightType().getStyle();
        if (fightStyle == FightStyle.AGGRESSIVE)
            styleBonus = 3;
        else if (fightStyle == FightStyle.CONTROLLED)
            styleBonus = 1;

        let effectiveLevel = DamageFormulas.applyEffectiveLevelBonus(prayerAdjusted, styleBonus);

        if (CombatEquipment.wearingVoid(player, CombatType.MELEE)
            || CombatEquipment.wearingEliteVoid(player, CombatType.MELEE)) {
            effectiveLevel = DamageFormulas.applyVoidMultiplier(effectiveLevel, 110);
        }

        return effectiveLevel;
    }

    public static calculateMaxMeleeHit(entity: Mobile, includeSpecial?: boolean): number {
        let maxHit: number;
        if (entity.isPlayer()) {
            let player = entity.getAsPlayer();
            let strengthBonus = player.getBonusManager().getOtherBonus()[BonusManager.STRENGTH];
            maxHit = DamageFormulas.scaleRatio(
                DamageFormulas.effectiveStrengthLevel(player) * (strengthBonus + 64) + 320,
                1,
                640
            );

            const special = getPlayerCombatSpecial(player);
            if (
                (includeSpecial ?? player.isSpecialActivated()) &&
                special?.getCombatMethod().type() === CombatType.MELEE
            ) {
                maxHit = DamageFormulas.scaleSpecial(maxHit, special.getStrengthMultiplier());
            }

        } else {
            maxHit = entity.getAsNpc().getCurrentDefinition().getMaxHit();
        }
        const adjusted = applyMeleeHitModifiers(entity, maxHit);
        return Math.floor(adjusted);
    }

    public static getMagicMaxhit(c: Mobile, spellOverride?: CombatSpell | null): number {
        let maxHit = 0;
        const spell = spellOverride ?? c.getCombat().getSelectedSpell();

        if (spell && spell.maximumHit() > 0) {
            maxHit = spell.maximumHit();
        } else if (c.isNpc()) {
            maxHit = c.getAsNpc().getDefinition().getMaxHit();
        } else {
            maxHit = 1;
        }

        const { CombatSpells } = require("../magic/CombatSpells") as typeof import("../magic/CombatSpells");
        maxHit = CombatSpells.applyChargeMaxHit(c, maxHit, spell);

        maxHit = DamageFormulas.applyMagicDamageBonus(c, maxHit);

        const demonbaneMultiplier = (spell as any)?.demonbaneDamageMultiplier?.(c);
        if (typeof demonbaneMultiplier === "number") {
            maxHit = DamageFormulas.scaleSpecial(maxHit, demonbaneMultiplier);
        }

        return Math.floor(applyMagicHitModifiers(c, maxHit));
    }

    public static getVolatileNightmareStaffBaseMaxHit(player: Player): number {
        return Math.min(
            Math.floor((player.getSkillManager().getCurrentLevel(Skill.MAGIC) * 263) / 449 + 1),
            58
        );
    }

    public static calculateMaxMagicHit(entity: Mobile, spellOverride?: CombatSpell | null, includeSpecial?: boolean): number {
        if (entity.isPlayer()) {
            const player = entity.getAsPlayer();
            const special = getPlayerCombatSpecial(player);
            const weaponId = player.getEquipment().getWeapon().getId();
            const { ItemIdentifiers } = require("../../../../util/ItemIdentifiers") as typeof import("../../../../util/ItemIdentifiers");
            if (
                (includeSpecial ?? player.isSpecialActivated()) &&
                special?.getCombatMethod().type() === CombatType.MAGIC &&
                weaponId === ItemIdentifiers.VOLATILE_NIGHTMARE_STAFF
            ) {
                return DamageFormulas.applyMagicDamageBonus(
                    player,
                    DamageFormulas.getVolatileNightmareStaffBaseMaxHit(player)
                );
            }
        }

        return DamageFormulas.getMagicMaxhit(entity, spellOverride);
    }

    private static effectiveRangedStrength(player: Player): number {
        const prayerAdjusted = DamageFormulas.scalePercent(
            player.getSkillManager().getCurrentLevel(Skill.RANGED),
            DamageFormulas.rangedStrengthPrayerPercent(player)
        );

        let styleBonus = 0;
        let fightStyle = player.getFightType().getStyle();
        if (fightStyle == FightStyle.ACCURATE)
            styleBonus = 3;

        let effectiveLevel = DamageFormulas.applyEffectiveLevelBonus(prayerAdjusted, styleBonus);

        if (CombatEquipment.wearingEliteVoid(player, CombatType.RANGED)) {
            effectiveLevel = DamageFormulas.applyVoidMultiplier(effectiveLevel, 1125, 1000);
        } else if (CombatEquipment.wearingVoid(player, CombatType.RANGED)) {
            effectiveLevel = DamageFormulas.applyVoidMultiplier(effectiveLevel, 110);
        }

        // if (dragonHunter(input))
        // rngStrength = (int) (rngStrength * 1.3f);
        return effectiveLevel;
    }

    private static maximumRangeHitDpsCalc(player: Player, includeSpecial?: boolean) {
        let strengthBonus = player.getBonusManager().getOtherBonus()[BonusManager.RANGED_STRENGTH];
        let maxHit = DamageFormulas.scaleRatio(
            DamageFormulas.effectiveRangedStrength(player) * (strengthBonus + 64) + 320,
            1,
            640
        );

        const special = getPlayerCombatSpecial(player);
        const useSpecial = includeSpecial ?? player.isSpecialActivated();
        if (
            useSpecial &&
            special != null &&
            special.getCombatMethod().type() == CombatType.RANGED
        ) {
            maxHit = DamageFormulas.scaleSpecial(maxHit, special.getStrengthMultiplier());
        }

        return Math.floor(maxHit);
    }

    /**
    Calculates the maximum ranged hit for the argued entity without
    taking the victim into consideration.
    @param entity the entity to calculate the maximum hit for.
    @return the maximum ranged hit that this entity can deal.
    */
    public static calculateMaxRangedHit(entity: Mobile, includeSpecial?: boolean) {
        if (entity.isNpc()) {
            let npc = entity as unknown as NPC;
            return npc.getCurrentDefinition().getMaxHit();
        }

        let player = entity as Player;

        return DamageFormulas.maximumRangeHitDpsCalc(player, includeSpecial);
    }

    public static applyMagicDamageBonus(entity: Mobile, maxHit: number): number {
        if (!entity.isPlayer()) {
            return maxHit;
        }

        const player = entity.getAsPlayer();
        const equipmentPermille = Math.round(
            (player.getBonusManager().getOtherBonus()[BonusManager.MAGIC_STRENGTH] ?? 0) * 10
        );
        const prayerPermille = DamageFormulas.magicDamagePrayerPermille(player);
        const eliteVoidPermille = CombatEquipment.wearingEliteVoid(player, CombatType.MAGIC) ? 50 : 0;

        return DamageFormulas.scaleRatio(
            maxHit,
            1000 + equipmentPermille + prayerPermille + eliteVoidPermille,
            1000
        );
    }

    private static magicDamagePrayerPermille(player: Player): number {
        if (PrayerHandler.isActivated(player, PrayerHandler.AUGURY)) {
            return 40;
        }
        if (PrayerHandler.isActivated(player, PrayerHandler.MYSTIC_MIGHT)) {
            return 20;
        }
        if (PrayerHandler.isActivated(player, PrayerHandler.MYSTIC_LORE)) {
            return 10;
        }
        return 0;
    }

}
