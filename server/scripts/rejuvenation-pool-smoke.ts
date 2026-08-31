import { strict as assert } from "assert";

const Pool = require("../plugins/objects/RejuvinationPool.plugin");
const originalDateNow = Date.now;
let now = 1_000;
Date.now = () => now;

let click: ((event: any) => void) | undefined;
let poolIds: number[] = [];
let cancelledBleed: unknown;
Pool.register({
  getTaskManager: () => ({ cancelTasks: (key: unknown) => (cancelledBleed = key) }),
  onObjectFirstClick: (ids: number[], handler: (event: any) => void) => {
    poolIds = ids;
    click = handler;
  },
});

assert.ok(poolIds.includes(29241), "the spawned ornate pool id must be handled");
assert.ok(click, "the pool must handle first-click");

const messages: string[] = [];
const currentLevels = new Map<number, number>([[0, 50], [3, 20], [5, 10]]);
const maxLevels = new Map<number, number>([[0, 99], [3, 99], [5, 77]]);
const bleedKey = {};
let runEnergy = 12;
let special = 25;
let venomed = true;
let poison = 18;
const player: any = {
  getCombat: () => ({ getTarget: () => null, getAttacker: () => null }),
  getSkillManager: () => ({
    getCurrentLevel: (skill: any) => currentLevels.get(skill.getIndex()),
    getMaxLevel: (skill: any) => maxLevels.get(skill.getIndex()),
    setCurrentLevels: (skill: any, level: number) => currentLevels.set(skill.getIndex(), level),
  }),
  setHitpoints: (level: number) => currentLevels.set(3, level),
  setSpecialActivated: () => undefined,
  isSpecialActivated: () => false,
  setRecoveringSpecialAttack: () => undefined,
  setSpecialPercentage: (value: number) => (special = value),
  getSpecialAttackRestore: () => ({ stop: () => undefined }),
  getWeapon: () => null,
  setRunEnergy: (value: number) => (runEnergy = value),
  getAttribute: (key: string) => key === "combat:bleed:taskKey" ? bleedKey : null,
  setAttribute: () => undefined,
  setPoisonDamage: (value: number) => (poison = value),
  setVenomed: (value: boolean) => (venomed = value),
  getPacketSender: () => ({
    sendRunEnergy: () => undefined,
    sendPoisonType: () => undefined,
    updateSpecialAttackOrb: () => undefined,
    sendSpecialAttackState: () => undefined,
    sendMessage: (message: string) => messages.push(message),
  }),
};

const event: any = { player, handled: false };
click!(event);
assert.equal(event.handled, true);
assert.equal(runEnergy, 100);
assert.equal(special, 100);
assert.equal(poison, 0);
assert.equal(venomed, false);
assert.equal(cancelledBleed, bleedKey);
assert.equal(currentLevels.get(0), 99);
assert.equal(currentLevels.get(3), 99);
assert.equal(currentLevels.get(5), 77);
assert.match(messages.pop() ?? "", /fully rejuvenated/);

messages.length = 0;
event.handled = false;
click!(event);
assert.equal(event.handled, true);
assert.equal(messages.length, 0, "the one-second delay suppresses repeat clicks");

now += 1_000;
player.getCombat = () => ({ getTarget: () => ({ isPlayer: () => true, isRegistered: () => true, getHitpoints: () => 99 }), getAttacker: () => null });
click!(event);
assert.equal(event.handled, true);
assert.equal(messages.pop(), "You can't drink from the pool during combat.");
Date.now = originalDateNow;
console.log("rejuvenation pool ok: object 29241 restores and respects PvP combat");
