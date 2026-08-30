import * as assert from "node:assert/strict";
import { SpellTeleports } from "../src/main/typescript/elvarg/game/content/combat/magic/SpellTeleports";
import { MagicSpellbook } from "../src/main/typescript/elvarg/game/model/MagicSpellbook";
import { TeleportHandler } from "../src/main/typescript/elvarg/game/model/teleportation/TeleportHandler";
import { TeleportType } from "../src/main/typescript/elvarg/game/model/teleportation/TeleportType";

let teleported: any;
const deleted: Array<{ id: number; amount: number }> = [];
const originalCheckReqs = TeleportHandler.checkReqs;
const originalTeleport = TeleportHandler.teleport;
(TeleportHandler as any).checkReqs = () => true;
(TeleportHandler as any).teleport = (_player: any, destination: any, type: any) => { teleported = { destination, type }; };

const player: any = {
    getSpellbook: () => MagicSpellbook.NORMAL,
    getSkillManager: () => ({ getCurrentLevel: () => 99, addExperiences: () => {} }),
    getInventory: () => ({ containsAllItem: () => true, deletes: (item: any) => deleted.push({ id: item.getId(), amount: item.getAmount() }) }),
    getEquipment: () => ({ containsAllItem: () => true, getItems: () => Array.from({ length: 14 }, () => ({ getId: () => -1 })) }),
    getCombat: () => ({ reset: () => {}, setCastSpell: () => {}, setAutocastSpell: () => {} }),
    getPacketSender: () => ({ sendMessage: () => {} }),
};

assert.equal(SpellTeleports.handleSelf(player, "Kourend Castle Teleport"), true);
assert.equal(teleported.destination.getX(), 1643);
assert.equal(teleported.destination.getY(), 3672);
assert.equal(teleported.type, TeleportType.NORMAL);
assert.equal(SpellTeleports.handleSelf(player, "Civitas illa Fortis Teleport"), true);
assert.equal(teleported.destination.getX(), 1680);
assert.equal(teleported.destination.getY(), 3130);
assert.equal(SpellTeleports.handleSelf(player, "Ape Atoll Teleport"), true);
assert.equal(teleported.destination.getX(), 2796);
assert.equal(teleported.destination.getY(), 2798);
assert.deepEqual(deleted.at(-1), { id: 1963, amount: 1 });
assert.equal(SpellTeleports.handleSelf({ ...player, getSpellbook: () => MagicSpellbook.ANCIENT }, "Paddewwa Teleport"), true);
assert.equal(teleported.type, TeleportType.ANCIENT);
assert.equal(SpellTeleports.handleSelf(player, "not a teleport"), false);

(TeleportHandler as any).checkReqs = originalCheckReqs;
(TeleportHandler as any).teleport = originalTeleport;
console.log("spell teleports smoke ok");
