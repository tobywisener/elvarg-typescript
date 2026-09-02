/**
 * NPC drop tables, driven by the OSRS Wiki dump.
 *
 * Data files (regenerate from OpenRune-Server, then copy in minified):
 *   ./gradlew :tools:wiki-dumping:dumpNpcDrops --args="--all-monsters --wiki-dump=<dir> --npc-drops-json=<out>"
 *   npc-drops.json          -> data/definitions/npc-drops.json
 *   subtables.json          -> data/definitions/npc-drop-subtables.json
 *
 * Shape: { npcs: { "<npcId>": { name, tables: [ { label, main_max_roll, entries[], tertiary[] } ] } } }
 * Entries carry `weight` out of `out_of`; `shared_table` entries roll one of the shared tables
 * (rare drop table, gem, herb, seed) held in the subtables file.
 */

const fs = require("fs");
const path = require("path");

const { Item } = require("../../src/main/typescript/elvarg/game/model/Item");
const { GameConstants } = require("../../src/main/typescript/elvarg/game/GameConstants");
const { PlayerRights } = require("../../src/main/typescript/elvarg/game/model/rights/PlayerRights");

const DROPS_FILE = "npc-drops.json";
const SUBTABLES_FILE = "npc-drop-subtables.json";

/** npcId -> array of tables */
const tablesByNpc = new Map();
/** shared table name -> [{ itemId, quantity, weight }] */
const sharedTables = new Map();

let itemOnGroundManager = null;
let pluginApi = null;
let unusableSubtableRows = 0;
let conditionalTertiarySkipped = 0;

function definitionPath(fileName) {
  return path.join(GameConstants.DEFINITIONS_DIRECTORY, fileName);
}

function readJson(fileName) {
  const file = definitionPath(fileName);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** `"3/128"` -> weight 3. Text rarities ("Common") have no numeric form and are skipped. */
function parseSharedRarity(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(raw.trim());
  if (!match) {
    return null;
  }
  const weight = Number(match[1]);
  const outOf = Number(match[2]);
  return outOf > 0 && weight > 0 ? { weight, outOf } : null;
}

function parseQuantityRaw(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const single = /^(\d+)$/.exec(raw.trim());
  if (single) {
    const value = Number(single[1]);
    return [value, value];
  }
  const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(raw.trim());
  if (range) {
    return [Number(range[1]), Number(range[2])];
  }
  return null;
}

function loadDrops() {
  tablesByNpc.clear();
  sharedTables.clear();
  unusableSubtableRows = 0;

  const dump = readJson(DROPS_FILE);
  if (!dump || !dump.npcs) {
    return { npcs: 0, tables: 0, shared: 0 };
  }

  let tableCount = 0;
  for (const [npcId, npc] of Object.entries(dump.npcs)) {
    const id = Number(npcId);
    if (!Number.isInteger(id) || !Array.isArray(npc.tables) || npc.tables.length === 0) {
      continue;
    }
    tablesByNpc.set(id, npc.tables);
    tableCount += npc.tables.length;
  }

  const subtables = readJson(SUBTABLES_FILE) || {};
  for (const [name, table] of Object.entries(subtables)) {
    const entries = [];
    for (const entry of table.entries || []) {
      const rarity = parseSharedRarity(entry.rarity_raw);
      if (!rarity) {
        unusableSubtableRows++;
        continue;
      }
      // A row is one of: a nested table (the rare drop table rolls the gem table on 20/128),
      // an empty slot, or an item. Only the last needs an id.
      if (entry.shared_table) {
        entries.push({ ref: entry.shared_table, weight: rarity.weight, outOf: rarity.outOf });
      } else if (entry.nothing) {
        entries.push({ nothing: true, weight: rarity.weight, outOf: rarity.outOf });
      } else if (Number.isInteger(entry.item_id)) {
        entries.push({
          itemId: entry.item_id,
          quantity: parseQuantityRaw(entry.quantity_raw) || [1, 1],
          weight: rarity.weight,
          outOf: rarity.outOf,
        });
      } else {
        unusableSubtableRows++;
      }
    }
    if (entries.length > 0) {
      sharedTables.set(name, entries);
    }
  }

  return {
    npcs: tablesByNpc.size,
    tables: tableCount,
    shared: sharedTables.size,
    unusableSubtableRows,
  };
}

function randomInt(bound) {
  return Math.floor(Math.random() * bound);
}

function rollQuantity(entry) {
  const quantity = Array.isArray(entry.quantity) ? entry.quantity : parseQuantityRaw(entry.quantity_raw);
  if (!quantity || quantity.length === 0) {
    return 1;
  }
  const [min, max] = [quantity[0], quantity[quantity.length - 1]];
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    return 1;
  }
  return min + randomInt(max - min + 1);
}

/** Independent `weight / out_of` chance. */
function hits(entry) {
  const outOf = Number(entry.out_of);
  if (!Number.isInteger(outOf) || outOf <= 0) {
    return false;
  }
  const weight = Number.isInteger(entry.weight) ? entry.weight : 1;
  return randomInt(outOf) < weight;
}

function rollSharedTable(name, depth = 0) {
  // Shared tables reference each other (rare -> gem -> mega-rare), so cap the chain.
  if (depth > 4) {
    return [];
  }
  const entries = sharedTables.get(name);
  if (!entries || entries.length === 0) {
    return [];
  }
  // Published as per-item n/outOf slots sharing one pool, so roll the pool once and walk
  // cumulative weights. A roll past the last slot is a miss, which is the empty part of the pool.
  const outOf = entries[0].outOf;
  let roll = randomInt(Math.max(1, outOf));
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) {
      if (entry.nothing) {
        return [];
      }
      if (entry.ref) {
        return rollSharedTable(entry.ref, depth + 1);
      }
      const [min, max] = entry.quantity;
      return [{ itemId: entry.itemId, amount: min + randomInt(Math.max(1, max - min + 1)) }];
    }
  }
  return [];
}

function resolveEntry(entry) {
  if (entry.nothing) {
    return [];
  }
  if (entry.shared_table) {
    return rollSharedTable(entry.shared_table);
  }
  if (!Number.isInteger(entry.item_id)) {
    return [];
  }
  const drops = [{ itemId: entry.item_id, amount: rollQuantity(entry) }];
  for (const bonus of entry.bonus_drops || []) {
    if (Number.isInteger(bonus.item_id)) {
      drops.push({ itemId: bonus.item_id, amount: rollQuantity(bonus) });
    }
  }
  return drops;
}

/**
 * One kill: guaranteed drops, then a pre-roll (which replaces the main roll when it hits),
 * then a single weighted main-table roll, then independent separate/tertiary rolls.
 */
function rollTable(table) {
  const drops = [];
  const entries = Array.isArray(table.entries) ? table.entries : [];

  const main = [];
  let preRollHit = false;

  for (const entry of entries) {
    if (entry.always) {
      drops.push(...resolveEntry(entry));
    } else if (entry.pre_roll) {
      if (!preRollHit && hits(entry)) {
        drops.push(...resolveEntry(entry));
        preRollHit = true;
      }
    } else if (entry.separate_roll) {
      if (hits(entry)) {
        drops.push(...resolveEntry(entry));
      }
    } else if (Number.isInteger(entry.weight)) {
      main.push(entry);
    }
  }

  if (!preRollHit && main.length > 0) {
    const maxRoll = Number.isInteger(table.main_max_roll)
      ? table.main_max_roll
      : main.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = randomInt(Math.max(1, maxRoll));
    for (const entry of main) {
      roll -= entry.weight;
      if (roll < 0) {
        drops.push(...resolveEntry(entry));
        break;
      }
    }
  }

  for (const entry of table.tertiary || []) {
    // A tertiary at 1/1 is a conditional drop, not a guaranteed one: the wiki writes
    // "Always" for things that always drop *given* a condition (an active clue step, a quest,
    // a diary), and the condition only exists as free text in `notes`. Genuine 100% drops are
    // in the guaranteed section with `always`. Dropping these unconditionally hands out clue
    // keys and quest items from every kill, so skip them.
    if (Number(entry.out_of) <= 1) {
      conditionalTertiarySkipped++;
      continue;
    }
    if (hits(entry)) {
      drops.push(...resolveEntry(entry));
    }
  }

  return drops;
}

function tableForNpc(npcId) {
  const tables = tablesByNpc.get(npcId);
  if (!tables || tables.length === 0) {
    return null;
  }
  // An npc id maps to exactly one variant table in the dump; extras would be a data bug.
  return tables[0];
}

function dropFor(player, npc, npcId, location) {
  const table = tableForNpc(npcId);
  if (!table || !itemOnGroundManager) {
    return 0;
  }

  const drops = rollTable(table);
  for (const drop of drops) {
    if (!Number.isInteger(drop.itemId) || drop.amount <= 0) {
      continue;
    }
    const item = new Item(drop.itemId, drop.amount);
    const stackable = item.getDefinition && item.getDefinition()
      ? item.getDefinition().isStackable()
      : false;
    if (stackable) {
      itemOnGroundManager.registerLocation(player, item, location);
    } else {
      for (let i = 0; i < drop.amount; i++) {
        itemOnGroundManager.registerLocation(player, new Item(drop.itemId, 1), location);
      }
    }
  }
  return drops.length;
}

module.exports = {
  name: "NpcDrops",
  register(api) {
    pluginApi = api;
    itemOnGroundManager = api.getItemOnGroundManager();

    const stats = loadDrops();

    api.onNpcDeath(({ killer, npc, npcId }) => {
      if (!killer || !npc) {
        return;
      }
      const id = Number.isInteger(npcId) ? npcId : npc.getId?.();
      if (!Number.isInteger(id)) {
        return;
      }
      try {
        dropFor(killer, npc, id, npc.getLocation());
      } catch (error) {
        console.error("[NpcDrops] failed to roll drops for npc", id, error);
      }
    });

    api.registerCommand("reloaddrops", ({ player }) => {
      // Same guard the command carried in AdminCommands before it moved here.
      const rights = player?.getRights?.();
      if (rights !== PlayerRights.OWNER && rights !== PlayerRights.DEVELOPER) {
        player.getPacketSender().sendMessage("You do not have permission to use this command.");
        return true;
      }
      try {
        const reloaded = loadDrops();
        player.getPacketSender().sendMessage(
          `Reloaded drops: ${reloaded.npcs} npcs, ${reloaded.tables} tables.`
        );
      } catch (error) {
        console.error("[NpcDrops] reload failed", error);
        player.getPacketSender().sendMessage("Error reloading npc drops.");
      }
      return true;
    });

    api.log("registered", stats);
  },

  // Exposed for the smoke test.
  __internals: { loadDrops, rollTable, rollSharedTable, tablesByNpc, sharedTables },
};
