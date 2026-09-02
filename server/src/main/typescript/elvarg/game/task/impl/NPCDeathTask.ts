import { Task } from "../Task";
import { World } from "../../World";
import { NPC } from "../../entity/impl/npc/NPC";
import { Player } from "../../entity/impl/player/Player";
import { Animation } from "../../model/Animation";
import { Priority } from "../../model/Priority";
import { TaskManager } from "../TaskManager";
import { NPCRespawnTask } from '../impl/NPCRespawnTask'
import { PluginManager } from "../../../plugins/PluginManager";
import { Sound } from "../../Sound";
import { Sounds } from "../../Sounds";
import { ArceuusSpells } from "../../content/combat/magic/ArceuusSpells";
import { CombatSpecial } from "../../content/combat/CombatSpecial";


export class NPCDeathTask extends Task {
    private npc: NPC
    private ticks: number;
    private killer: Player | null;
    
    /**
     * The NPCDeathTask constructor.
     *
     * @param npc The npc being killed.
     */
    constructor(npc: NPC) {
        super(1);
        this.npc = npc;
        this.ticks = 1;
    }

    public execute(): void {
        switch (this.ticks) {
            case 1:
                this.npc.getMovementQueue().setBlockMovement(true).reset();
                this.killer = this.npc.getCombat().getKiller(true);
                this.npc.performAnimation(new Animation(this.npc.getCurrentDefinition().getDeathAnim()));
                const deathSound = this.npc.getCurrentDefinition().getDeathSound();
                if (deathSound > 0) Sounds.sendSound(this.npc, new Sound(deathSound, 1, 0, 0));
                this.npc.getCombat().reset();
                this.npc.getCombat().setUnderAttack(null);
                this.npc.setMobileInteraction(null);
                this.setDelay(2);
                break;
            case 0:
                if (this.killer != null) {
                    PluginManager.emitNpcDeath({
                        killer: this.killer,
                        npc: this.npc,
                        npcId: this.npc.getId(),
                        location: {
                            x: this.npc.getLocation().getX(),
                            y: this.npc.getLocation().getY(),
                            z: this.npc.getLocation().getZ(),
                        },
                    });
                    if (ArceuusSpells.hasDeathCharge(this.killer)) {
                        this.killer.setSpecialPercentage(Math.min(100, this.killer.getSpecialPercentage() + 15));
                        CombatSpecial.updateBar(this.killer);
                    }
                }
                this.stop();
                break;
        }
        this.ticks--;
    }
    
    public stop(): void {
        super.stop();
        const skipDefaultRespawn = (this.npc as any).__skipDefaultRespawn === true;
        (this.npc as any).__skipDefaultRespawn = false;

        if (this.npc.getArea() !== null) {
            const area = this.npc.getArea();
            area.leave(this.npc, false);
            if (this.npc.getArea() === area) {
                this.npc.setArea(null);
            }
        }
        this.npc.setDying(false);
        this.npc.setNpcTransformationId(-1);
        if (!skipDefaultRespawn && this.npc.getDefinition().getRespawn() > 0) {
            TaskManager.submit(new NPCRespawnTask(this.npc, this.npc.getDefinition().getRespawn()));
        }
        World.getRemoveNPCQueue().push(this.npc);
    }
}
