// Every PvP bot spawns with an independently drawn (loadout, profile) pair, and the
// generated preset is what gives it stats and gear. If a pair resolves to no archetype
// the bot is released into the wilderness naked at level 3, so assert that every pair
// in the cross product produces a preset.
// Usage: TS_NODE_COMPILER_OPTIONS='{"target":"es2020"}' yarn ts-node ./scripts/bot-pvp-loadout-smoke.ts
import { strict as assert } from "assert";

// PrayerHandler <-> QuickPrayers is a require cycle that only resolves when the server
// boots in its usual order; loadout generation never touches prayers, so stub it out.
const prayerHandlerPath = require.resolve(
  "../src/main/typescript/elvarg/game/content/PrayerHandler"
);
require.cache[prayerHandlerPath] = {
  exports: { PrayerHandler: {}, PrayerData: { values: () => [] } },
} as NodeModule;

const { listPvpLoadouts } = require("../plugins/bots/behaviours/pvp/PvpLoadoutRegistry");
const { listPvpProfiles } = require("../plugins/bots/behaviours/pvp/PvpProfileRegistry");
const { __testing } = require("../plugins/bots/behaviours/policies/PvpLoadoutPolicy");

const loadouts = listPvpLoadouts();
const profiles = listPvpProfiles();
assert.ok(loadouts.length > 0, "expected PvP loadouts to be registered");
assert.ok(profiles.length > 0, "expected PvP profiles to be registered");

const failures: string[] = [];
let checked = 0;

for (const loadout of loadouts) {
  for (const profile of profiles) {
    checked++;
    const state = { pvp: { loadoutId: loadout.id, profileId: profile.id } };
    const generated = __testing.buildGeneratedPreset(null, state);
    if (!generated?.preset) {
      failures.push(`${loadout.id} x ${profile.id}`);
      continue;
    }
    const stats = generated.preset.getStats() ?? [];
    assert.ok(
      stats.length > 0 && stats.every((level: number) => Number(level) >= 1),
      `${loadout.id} x ${profile.id} produced unusable stats: ${JSON.stringify(stats)}`
    );
    const equipment = generated.preset.getEquipment() ?? [];
    assert.ok(
      equipment.length > 0,
      `${loadout.id} x ${profile.id} produced a preset with no equipment`
    );
  }
}

assert.deepEqual(
  failures,
  [],
  `loadout/profile pairs that generate no preset (bots spawn naked at level 3): ${failures.join(", ")}`
);

console.log(`bot-pvp-loadout-smoke: OK (${checked} loadout/profile pairs)`);
