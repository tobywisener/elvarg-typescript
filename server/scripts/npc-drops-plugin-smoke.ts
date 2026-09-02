import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";

// The plugin reads data relative to cwd via GameConstants.DEFINITIONS_DIRECTORY.
process.chdir(path.join(__dirname, ".."));

const plugin = require("../plugins/npcs/NpcDrops.plugin.js");
const { loadDrops, rollTable, tablesByNpc, sharedTables } = plugin.__internals;

const stats = loadDrops();
assert.ok(stats.npcs > 1000, `expected a populated dump, got ${stats.npcs} npcs`);
assert.ok(stats.tables >= stats.npcs, "every npc should map to at least one table");
assert.ok(stats.shared >= 4, `expected shared tables to load, got ${stats.shared}`);

// Abyssal demon (415) is a stable, well-known table: 128-slot main pool + guaranteed ashes.
const abyssal = tablesByNpc.get(415);
assert.ok(abyssal && abyssal.length > 0, "npc 415 (Abyssal demon) should have a table");
assert.equal(abyssal[0].main_max_roll, 128);
const always = abyssal[0].entries.filter((e: any) => e.always);
assert.ok(always.length > 0, "Abyssal demon should have a guaranteed drop");

// Guaranteed drops must appear on every roll; the main table must stay inside its pool.
for (let i = 0; i < 200; i++) {
  const drops = rollTable(abyssal[0]);
  for (const guaranteed of always) {
    assert.ok(
      drops.some((d: any) => d.itemId === guaranteed.item_id),
      `guaranteed item ${guaranteed.item_id} missing from roll ${i}`
    );
  }
  // One kill yields the guaranteed drops plus at most one main-table result and any tertiaries.
  assert.ok(drops.length >= always.length, `roll ${i} dropped fewer than the guaranteed items`);
  for (const drop of drops) {
    assert.ok(Number.isInteger(drop.itemId) && drop.itemId > 0, "item id must be a positive int");
    assert.ok(Number.isInteger(drop.amount) && drop.amount > 0, "amount must be a positive int");
  }
}

// A weighted entry should actually be reachable: 4/128 over 20k rolls is ~625 expected hits.
const weighted = abyssal[0].entries.find(
  (e: any) => Number.isInteger(e.weight) && e.weight >= 3 && Number.isInteger(e.item_id)
);
assert.ok(weighted, "expected at least one weighted main-table entry");
let hits = 0;
for (let i = 0; i < 20000; i++) {
  if (rollTable(abyssal[0]).some((d: any) => d.itemId === weighted.item_id)) {
    hits++;
  }
}
assert.ok(hits > 50, `weighted entry ${weighted.item_id} never rolled (${hits} hits in 20k)`);

// Shared tables must carry resolved ids, since an unresolved one silently drops nothing.
const rdt = sharedTables.get("rareDrop");
assert.ok(rdt && rdt.length > 0, "rare drop table should load");
for (const entry of rdt) {
  assert.ok(entry.weight > 0 && entry.outOf > 0, "shared entry needs a numeric rarity");
  const kind = entry.ref ? "ref" : entry.nothing ? "nothing" : "item";
  if (kind === "item") {
    assert.ok(Number.isInteger(entry.itemId) && entry.itemId > 0, "shared item entry needs an id");
  }
}
assert.equal(stats.unusableSubtableRows, 0, "every shared-table row should be usable");

// Nested table refs: the RDT rolls the gem table (20/128) and mega-rare (15/128). Before these
// were kept as refs those 35/128 rolls silently produced nothing.
const refs = rdt.filter((e: any) => e.ref).map((e: any) => e.ref);
assert.deepEqual(refs.sort(), ["gem", "megaRare"], "RDT should reference gem + mega-rare");
assert.ok(sharedTables.has("gem") && sharedTables.has("megaRare"), "nested targets must exist");
assert.ok(sharedTables.has("talisman"), "gem table references the talisman table");

// Rolling the RDT must reach items reachable ONLY through the nested gem table. Items the two
// tables share (the key halves) would pass this check without any recursion, so exclude them.
const rdtItemIds = new Set(rdt.filter((e: any) => e.itemId).map((e: any) => e.itemId));
const gemOnlyIds = new Set(
  (sharedTables.get("gem") || [])
    .filter((e: any) => e.itemId && !rdtItemIds.has(e.itemId))
    .map((e: any) => e.itemId)
);
assert.ok(gemOnlyIds.size > 0, "gem table should hold items the RDT does not");

const rolls = 20000;
let viaNested = 0;
for (let i = 0; i < rolls; i++) {
  for (const drop of plugin.__internals.rollSharedTable("rareDrop")) {
    if (gemOnlyIds.has(drop.itemId)) {
      viaNested++;
    }
  }
}
// P(gem ref) * P(gem-exclusive item) = 20/128 * 59/128 ~= 7.2%, so ~1440 of 20k.
const gemRef = rdt.find((e: any) => e.ref === "gem");
const gemOnlyWeight = (sharedTables.get("gem") || [])
  .filter((e: any) => gemOnlyIds.has(e.itemId))
  .reduce((sum: number, e: any) => sum + e.weight, 0);
const expected = rolls * (gemRef.weight / gemRef.outOf) * (gemOnlyWeight / 128);
assert.ok(
  viaNested > expected * 0.7 && viaNested < expected * 1.3,
  `nested gem rate off: ${viaNested} hits vs ~${Math.round(expected)} expected in ${rolls}`
);

// Assumed rates must stay flagged in the shipped data so they can be found and overridden.
const dump = JSON.parse(fs.readFileSync("data/definitions/npc-drops.json", "utf8"));
let assumed = 0;
for (const npc of Object.values<any>(dump.npcs)) {
  for (const table of npc.tables) {
    for (const entry of [...table.entries, ...(table.tertiary || [])]) {
      if (entry.assumed_rarity) {
        assumed++;
        assert.ok(
          Number.isInteger(entry.out_of) && entry.out_of > 0,
          "an assumed rarity must still be rollable"
        );
      }
    }
  }
}
assert.ok(assumed > 100, `expected assumed_rarity entries to be present, got ${assumed}`);

// Conditional drops (wiki "Always" gated on a clue step / quest) must never drop unconditionally.
const chicken = tablesByNpc.get(1173);
assert.ok(chicken, "npc 1173 (Chicken) should have a table");
const conditional = (chicken[0].tertiary || []).filter((e: any) => Number(e.out_of) <= 1);
assert.ok(conditional.length > 0, "Chicken should carry a 1/1 conditional tertiary to guard against");
const conditionalIds = new Set(conditional.map((e: any) => e.item_id));
for (let i = 0; i < 500; i++) {
  for (const drop of rollTable(chicken[0])) {
    assert.ok(
      !conditionalIds.has(drop.itemId),
      `conditional drop ${drop.itemId} leaked from a Chicken kill on roll ${i}`
    );
  }
}

// The old core drop path must be gone.
for (const removed of [
  "src/main/typescript/elvarg/game/entity/impl/npc/NPCDropGenerator.ts",
  "src/main/typescript/elvarg/game/definition/NpcDropDefinition.ts",
  "src/main/typescript/elvarg/game/definition/loader/impl/NpcDropDefinitionLoader.ts",
  "data/definitions/npc_drops.json",
]) {
  assert.ok(!fs.existsSync(removed), `${removed} should have been removed from core`);
}

console.log(
  `npc-drops-plugin-smoke ok — ${stats.npcs} npcs, ${stats.tables} tables, ` +
    `${stats.shared} shared tables, weighted hits ${hits}/20000, ` +
    `nested-gem hits ${viaNested}/${rolls} (~${Math.round(expected)} expected), ${assumed} assumed rates`
);
