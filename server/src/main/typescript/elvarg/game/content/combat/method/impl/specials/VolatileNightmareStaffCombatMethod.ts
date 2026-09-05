import { CombatMethod } from "../../CombatMethod";
import { CombatType } from "../../../CombatType";
import { PendingHit } from "../../../hit/PendingHit";
import { Mobile } from "../../../../../entity/impl/Mobile";
import { CombatSpecial } from "../../../CombatSpecial";
import { Animation } from "../../../../../model/Animation";
import { Misc } from "../../../../../../util/Misc";
import { ItemIdentifiers } from "../../../../../../util/ItemIdentifiers";
import { DamageFormulas } from "../../../formula/DamageFormulas";

export class VolatileNightmareStaffCombatMethod extends CombatMethod {
    private static readonly CAST_ANIMATION = new Animation(8532);

    hits(character: Mobile, target: Mobile): PendingHit[] {
        const hit = new PendingHit(character, target, this, 2);
        if (hit.isAccurate() && character.isPlayer()) {
            const player = character.getAsPlayer();
            const maxHit = DamageFormulas.getVolatileNightmareStaffBaseMaxHit(player);
            const hitRoll = Misc.randomInclusive(1, maxHit);
            hit.setTotalDamage(DamageFormulas.applyMagicDamageBonus(character, hitRoll));
        }
        return [hit];
    }

    canAttack(character: Mobile, target: Mobile): boolean {
        if (!character.isPlayer()) {
            return false;
        }
        return character.getAsPlayer().getEquipment().getWeapon().getId() === ItemIdentifiers.VOLATILE_NIGHTMARE_STAFF;
    }

    type(): CombatType {
        return CombatType.MAGIC;
    }

    start(character: Mobile, target: Mobile): void {
        CombatSpecial.drain(character, CombatSpecial.VOLATILE_NIGHTMARE_STAFF.getDrainAmount());
        character.performAnimation(VolatileNightmareStaffCombatMethod.CAST_ANIMATION);
    }

    attackSpeed(character: Mobile): number {
        return 5;
    }

    attackDistance(character: Mobile): number {
        return 10;
    }

    finished(character: Mobile, target: Mobile): void {
        character.getCombat().reset();
        // reset() clears the interaction; a resolved cast still faces its target.
        character.setMobileInteraction(target);
        character.getMovementQueue().reset();
    }
}
