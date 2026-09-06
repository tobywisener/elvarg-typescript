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

// Prayer management is gated on confidenceTier in PvpCombatExecutionNode. Any tier
// allowed to pray must also declare a style-reaction window, otherwise it reads the
// opponent's combat style instantly and out-prays the tiers above it.
const PRAYER_MIN_TIER = 2;
for (const profile of profiles) {
  const tier = Number(profile.confidenceTier ?? 0);
  if (tier < PRAYER_MIN_TIER) {
    continue;
  }
  const reaction = profile.targetStyleReactionTicks;
  assert.ok(
    reaction && Number(reaction.max) > 0,
    `profile ${profile.id} prays (tier ${tier}) but has no targetStyleReactionTicks window`
  );
  assert.ok(
    Number(reaction.min) > 0 && Number(reaction.min) <= Number(reaction.max),
    `profile ${profile.id} has an invalid targetStyleReactionTicks range`
  );
}

// Lower tiers must not react faster than higher ones.
const praying = profiles
  .filter((profile: any) => Number(profile.confidenceTier ?? 0) >= PRAYER_MIN_TIER)
  .sort((a: any, b: any) => Number(a.confidenceTier) - Number(b.confidenceTier));
for (let i = 1; i < praying.length; i++) {
  const slower = praying[i - 1];
  const faster = praying[i];
  assert.ok(
    Number(slower.targetStyleReactionTicks.min) >= Number(faster.targetStyleReactionTicks.min),
    `profile ${slower.id} reacts faster than the higher tier ${faster.id}`
  );
}

// Virtual food charges are what decide how long a bot survives a fight, so every
// profile needs one and it must not shrink as the tier climbs.
const byTier = [...profiles].sort(
  (a: any, b: any) => Number(a.confidenceTier) - Number(b.confidenceTier)
);
for (const profile of byTier) {
  assert.ok(
    Number.isFinite(Number(profile.foodCharges)) && Number(profile.foodCharges) >= 1,
    `profile ${profile.id} is missing a usable foodCharges value`
  );
}
for (let i = 1; i < byTier.length; i++) {
  assert.ok(
    Number(byTier[i].foodCharges) >= Number(byTier[i - 1].foodCharges),
    `profile ${byTier[i].id} has fewer foodCharges than the lower tier ${byTier[i - 1].id}`
  );
}

console.log(
  `bot-pvp-loadout-smoke: OK (${checked} loadout/profile pairs, ${profiles.length} profiles)`
);
