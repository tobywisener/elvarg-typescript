import assert = require("assert");
import { SkillManager } from "../src/main/typescript/elvarg/game/content/skill/SkillManager";
import { Skill } from "../src/main/typescript/elvarg/game/model/Skill";

const varbits = new Map<number, number>();
const sender = {
    sendString: () => sender,
    sendSkill: () => sender,
    sendVarbit: (id: number, value: number) => {
        varbits.set(id, value);
        return sender;
    },
};
const manager = new SkillManager({ getPacketSender: () => sender } as any);

function refresh(prayer: number, defence: number): void {
    manager.setMaxLevels(Skill.PRAYER, prayer, false);
    manager.setMaxLevels(Skill.DEFENCE, defence, false);
    manager.updateSkill(Skill.DEFENCE);
}

refresh(54, 99);
assert.deepStrictEqual([...varbits.entries()], [[5453, 0], [3909, 0], [5451, 0], [5452, 0]]);

refresh(55, 59);
assert.deepStrictEqual([...varbits.entries()], [[5453, 1], [3909, 0], [5451, 0], [5452, 0]]);

refresh(74, 70);
assert.deepStrictEqual([...varbits.entries()], [[5453, 1], [3909, 8], [5451, 1], [5452, 0]]);

refresh(77, 70);
assert.deepStrictEqual([...varbits.entries()], [[5453, 1], [3909, 8], [5451, 1], [5452, 1]]);

console.log("prayer tab unlock smoke test passed");
