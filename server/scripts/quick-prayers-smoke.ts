import assert = require("assert");

const prayerHandlerPath = require.resolve(
  "../src/main/typescript/elvarg/game/content/PrayerHandler",
);
const prayers = Array.from({ length: 29 }, (_, prayerId) => ({ requirement: 1, prayerId }));
const activePrayers: boolean[] = [];
const PrayerHandler = Object.assign(
  {
    canUse: () => true,
    isActivated: (_player: unknown, prayerId: number) => activePrayers[prayerId] === true,
    activatePrayerPrayerId: (_player: unknown, prayerId: number) => (activePrayers[prayerId] = true),
    deactivatePrayer: (_player: unknown, prayerId: number) => (activePrayers[prayerId] = false),
    deactivatePrayers: () => activePrayers.fill(false),
    DEFENCE_PRAYERS: [0, 5, 13, 25, 26, 27, 28],
    STRENGTH_PRAYERS: [1, 6, 14, 25, 26],
    ATTACK_PRAYERS: [2, 7, 15, 25, 26],
    RANGED_PRAYERS: [3, 11, 19, 27],
    MAGIC_PRAYERS: [4, 12, 20, 28],
    OVERHEAD_PRAYERS: [16, 17, 18, 21, 22, 23],
  },
  {
    THICK_SKIN: 0, BURST_OF_STRENGTH: 1, CLARITY_OF_THOUGHT: 2, SHARP_EYE: 3,
    MYSTIC_WILL: 4, ROCK_SKIN: 5, SUPERHUMAN_STRENGTH: 6, IMPROVED_REFLEXES: 7,
    HAWK_EYE: 11, MYSTIC_LORE: 12, STEEL_SKIN: 13, ULTIMATE_STRENGTH: 14,
    INCREDIBLE_REFLEXES: 15, PROTECT_FROM_MAGIC: 16, PROTECT_FROM_MISSILES: 17,
    PROTECT_FROM_MELEE: 18, EAGLE_EYE: 19, MYSTIC_MIGHT: 20, RETRIBUTION: 21,
    REDEMPTION: 22, SMITE: 23, CHIVALRY: 25, PIETY: 26, RIGOUR: 27, AUGURY: 28,
  },
);
require.cache[prayerHandlerPath] = {
  exports: { PrayerHandler, PrayerData: { values: () => prayers } },
} as NodeModule;
const { QuickPrayers } = require("../src/main/typescript/elvarg/game/content/QuickPrayers");

const varbits = new Map<number, number>();
let openedInterface = 0;
let enabled = -1;
const sender = {
  sendVarbit: (id: number, value: number) => (varbits.set(id, value), sender),
  sendQuickPrayersState: (value: boolean) => (enabled = value ? 1 : 0, sender),
  sendTabInterface: (_tab: number, id: number) => (openedInterface = id, sender),
  sendTab: () => sender,
  sendInterfaceFlagsRange: () => sender,
  sendMessage: () => sender,
};
const player: any = {
  getPacketSender: () => sender,
  getSkillManager: () => ({ getCurrentLevel: () => 99, getMaxLevel: () => 99 }),
  getCombat: () => ({ getPrayerBlockTimer: () => ({ finished: () => true }) }),
  getDueling: () => ({ inDuel: () => false }),
  getPrayerActive: () => activePrayers,
};
const quickPrayers = new QuickPrayers(player);

assert(quickPrayers.handleWidgetAction(160, 20, 2));
assert.strictEqual(openedInterface, 17200);
assert(quickPrayers.handleWidgetAction(77, 4, 1, 18));
assert.strictEqual(varbits.get(4102), 1 << 18);
assert.strictEqual(enabled, 0);
assert(quickPrayers.handleWidgetAction(77, 4, 1, 19));
assert.strictEqual(varbits.get(4102), 1 << 19);
assert(quickPrayers.handleWidgetAction(541, 4));
assert.strictEqual(activePrayers[4], true);
assert.strictEqual(varbits.get(4101), 1 << 19);
assert.strictEqual(enabled, 1);
activePrayers[4] = false;
quickPrayers.checkActive();
assert.strictEqual(enabled, 0);
assert(quickPrayers.handleWidgetAction(77, 5));
assert.strictEqual(openedInterface, 5608);

console.log("quick prayers smoke test passed");
