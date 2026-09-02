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
  assert.ok(Number.isInteger(entry.itemId) && entry.itemId > 0, "shared entry needs an item id");
  assert.ok(entry.weight > 0 && entry.outOf > 0, "shared entry needs a numeric rarity");
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
    `${stats.shared} shared tables, weighted hits ${hits}/20000`
);
