import * as assert from "node:assert/strict";
import "../src/main/typescript/elvarg/game/content/combat/FightType";
import "../src/main/typescript/elvarg/game/content/combat/WeaponProfile";

const { BOT_PRESET_GROUPS, selectBotPreset } = require("../plugins/bots/behaviours/policies/PvpLoadoutPolicy");
const { PredefinedPresets } = require("../src/main/typescript/elvarg/game/content/presets/PredefinedPresets");

assert.deepEqual(BOT_PRESET_GROUPS.map((group: any) => [group.id, group.weight]), [
  ["main_126", 30], ["pure_1_def", 30], ["tank_45_def", 15], ["tank_70_def", 15], ["random", 10],
]);
assert.deepEqual(
  BOT_PRESET_GROUPS.flatMap((group: any) => group.presetKeys).sort(),
  Object.keys(PredefinedPresets).sort(),
  "every global preset must be represented by a bot preset group",
);

for (const [roll, groupId, defence] of [
  [0.01, "main_126", 99], [0.31, "pure_1_def", 1], [0.61, "tank_45_def", 45], [0.76, "tank_70_def", 70],
] as const) {
  const state: any = { pvp: { presetPoolEnabled: true } };
  const selected = selectBotPreset(state, () => roll);
  assert.equal(state.pvp.presetPoolGroup, groupId);
  assert.equal(selected?.preset.getStats()[1], defence);
}

const randomState: any = { pvp: { presetPoolEnabled: true } };
assert.equal(selectBotPreset(randomState, () => 0.91), null, "the random group must use the generated loadout path");
assert.equal(randomState.pvp.presetPoolGroup, "random");
console.log("bot preset pool ok: 30/30/15/15/10 distribution and defence groups");
