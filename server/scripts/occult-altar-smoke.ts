import * as assert from "node:assert/strict";

const { MagicSpellbook } = require("../src/main/typescript/elvarg/game/model/MagicSpellbook");
const { Sounds } = require("../src/main/typescript/elvarg/game/Sounds");
const Altars = require("../plugins/objects/Altars.plugin.js");

const handlers = new Map<number, (event: any) => boolean>();
let registeredObjectIds: number[] = [];
Altars.register({
  onObjectFirstClick: () => undefined,
  onObjectClick: (_ids: number[], clickType: number, handler: (event: any) => boolean) => {
    registeredObjectIds = _ids;
    handlers.set(clickType, handler);
  },
});

assert.deepEqual([...handlers.keys()], [1, 2, 3, 4], "the occult altar must support its four spellbook actions");
assert.deepEqual(registeredObjectIds, [31858, 31859, 31860, 31861], "all interactive occult altar variants must be registered");

const originalChangeSpellbook = MagicSpellbook.changeSpellbook;
const originalSendSound = Sounds.sendSound;
const selected: any[] = [];
try {
  MagicSpellbook.changeSpellbook = (_player: any, spellbook: any) => selected.push(spellbook);
  Sounds.sendSound = () => undefined;
  const player = { performAnimation: () => undefined };
  const variants: Array<[number, any[]]> = [
    [31858, [MagicSpellbook.NORMAL, MagicSpellbook.ANCIENT, MagicSpellbook.LUNAR, MagicSpellbook.ARCEUUS]],
    [31859, [MagicSpellbook.ANCIENT, MagicSpellbook.NORMAL, MagicSpellbook.LUNAR, MagicSpellbook.ARCEUUS]],
    [31860, [MagicSpellbook.LUNAR, MagicSpellbook.NORMAL, MagicSpellbook.ANCIENT, MagicSpellbook.ARCEUUS]],
    [31861, [MagicSpellbook.ARCEUUS, MagicSpellbook.NORMAL, MagicSpellbook.ANCIENT, MagicSpellbook.LUNAR]],
  ];

  for (const [objectId, spellbooks] of variants) {
    for (const [index, spellbook] of spellbooks.entries()) {
      assert.equal(handlers.get(index + 1)!({ player, objectId }), true);
      assert.equal(selected.pop(), spellbook, `object ${objectId} option ${index + 1} must select its spellbook`);
    }
  }
} finally {
  MagicSpellbook.changeSpellbook = originalChangeSpellbook;
  Sounds.sendSound = originalSendSound;
}

console.log("occult altar ok: all four spellbooks map to every client altar variant");
