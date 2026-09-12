const fs = require("fs");
const path = require("path");

module.exports = {
  name: "ItemPricesOSRS",
  register(api) {
    api.onServerStartup(() => {
      const startedAt = Date.now();
      const file = path.resolve(process.cwd(), "data", "item-prices.json");
      if (!fs.existsSync(file)) {
        api.log("No item prices found; run yarn fetch:prices");
        return;
      }
      const { data } = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Invalid item-prices.json: expected a data object");
      }
      let ItemDefinition;
      try {
        ({ ItemDefinition } = require("../../src/main/typescript/elvarg/game/definition/ItemDefinition"));
      } catch {
        ({ ItemDefinition } = require("../../dist/game/definition/ItemDefinition"));
      }
      let loaded = 0;
      for (const [key, quote] of Object.entries(data)) {
        const id = Number(key);
        if (!Number.isInteger(id) || id < 0) continue;
        const price = [quote?.high, quote?.low].find(value => Number.isSafeInteger(value) && value > 0);
        if (price === undefined) continue;
        const definition = ItemDefinition.forId(id);
        if (definition === ItemDefinition.DEFAULT) continue;
        definition.value = price;
        const noteId = definition.getNoteId();
        if (!definition.isNoted() && noteId >= 0) {
          const note = ItemDefinition.forId(noteId);
          if (note.isNoted() && note.getNoteId() === id) note.value = price;
        }
        loaded++;
      }
      api.log("loaded", { loaded, elapsedMs: Date.now() - startedAt });
    });
  },
};
