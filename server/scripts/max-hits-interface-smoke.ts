import * as assert from "node:assert/strict";

const formulaPath = require.resolve(
  "../src/main/typescript/elvarg/game/content/combat/formula/DamageFormulas"
);
let hits = { melee: 24, meleeSpecial: 36, ranged: 31, magic: 40 };
const specialFlags: boolean[] = [];
require.cache[formulaPath] = {
  exports: {
    DamageFormulas: {
      calculateMaxMeleeHit: (_player: any, includeSpecial = false) => {
        specialFlags.push(includeSpecial);
        return includeSpecial ? hits.meleeSpecial : hits.melee;
      },
      calculateMaxRangedHit: (_player: any, includeSpecial = false) => {
        specialFlags.push(includeSpecial);
        return hits.ranged;
      },
      getMagicMaxhit: () => hits.magic,
    },
  },
} as NodeModule;

const spellsPath = require.resolve(
  "../src/main/typescript/elvarg/game/content/combat/magic/CombatSpells"
);
require.cache[spellsPath] = {
  exports: {
    CombatSpells: {
      WIND_WAVE: { spellId: () => 1, maximumHit: () => 20 },
      FIRE_WAVE: { spellId: () => 2, maximumHit: () => 20 },
    },
  },
} as NodeModule;

const MaxHits = require("../plugins/interface/MaxHitsInterface.plugin.js");
const { GROUP_ID, COMPONENT, getInterfaceDefinition, getSpells, uid } = MaxHits._test;

let definition: any;
let processPlayer: ((event: any) => void) | undefined;
const commands = new Map<string, (event: any) => boolean>();
MaxHits.register({
  registerCustomInterface: (value: any) => (definition = value),
  registerCommand: (name: string, handler: (event: any) => boolean) => commands.set(name, handler),
  onPlayerProcess: (handler: (event: any) => void) => (processPlayer = handler),
});

const INTERFACE_DEFINITION = getInterfaceDefinition();
const SPELLS = getSpells();
assert.equal(definition.groupId, GROUP_ID);
assert.ok(definition.widgets.length > 10, "the max-hit interface needs its own widget group");
const root = definition.widgets.find((widget: any) => widget.fileId === COMPONENT.ROOT);
assert.deepEqual(
  [root.rawWidth, root.rawHeight, root.widthMode, root.heightMode],
  [494, 316, 0, 0],
  "the HUD overlay must retain its compact fixed size",
);
assert.ok(definition.scroll?.length === 1, "the magic spell list must be scrollable");
assert.ok(SPELLS.length > 0, "the magic spell list must include combat spells");
for (const command of ["maxhits", "maxhit", "maxrangehit", "maxmagehit"]) {
  assert.ok(commands.has(command), `::${command} must open the max-hit interface`);
}
assert.ok(processPlayer, "the max-hit interface must refresh while open");

let interfaceId = -1;
let closeOverlayId: number | null = null;
const strings: Array<[string, number]> = [];
const subInterfaces: any[][] = [];
const sender: any = {
  sendSubInterface: (...args: any[]) => {
    subInterfaces.push(args);
    return sender;
  },
  sendString: (text: string, component: number) => {
    strings.push([text, component]);
    return sender;
  },
  sendInterfaceDisplayState: () => sender,
  sendInterfaceFlagsRange: () => sender,
  sendInterfaceScript: () => sender,
  sendMessage: () => sender,
};
const player = {
  getPacketSender: () => sender,
  setInterfaceId: (id: number) => (interfaceId = id),
  getInterfaceId: () => interfaceId,
  setAttribute: (name: string, value: number | null) => {
    if (name === "interface:close-on-interface-close") closeOverlayId = value;
  },
  getAttribute: (name: string) => name === "interface:close-on-interface-close" ? closeOverlayId : null,
  getCombat: () => ({ getSelectedSpell: () => null }),
  getCombatSpecial: () => ({ getCombatMethod: () => ({ type: () => 0 }) }),
};

commands.get("maxrangehit")!({ player });
assert.equal(interfaceId, -1, "max hits must not become a modal interface");
assert.equal(closeOverlayId, GROUP_ID, "the title-bar close control must own the max-hit overlay");
assert.ok(
  subInterfaces.some(([targetUid, groupId, type]) => targetUid === ((161 << 16) | 8) && groupId === GROUP_ID && type === 1),
  "max hits must mount as a non-blocking HUD overlay",
);
assert.deepEqual(
  strings.filter(([, component]) => [
    uid(COMPONENT.MELEE_NORMAL), uid(COMPONENT.RANGED_NORMAL), uid(COMPONENT.MAGIC_ROW_START),
  ].includes(component)).map(([text]) => text),
  ["Max hit: 24", "Max hit: 31", `${SPELLS[0].name}: 40`],
);
assert.equal(
  strings.find(([, component]) => component === uid(COMPONENT.MELEE_SPECIAL))?.[0],
  "Special attack\nmax hit: 36",
  "special previews must force the weapon's special calculation",
);
assert.ok(specialFlags.includes(true), "the interface must request special max hits separately");

hits = { melee: 25, meleeSpecial: 37, ranged: 32, magic: 41 };
processPlayer!({ player });
assert.equal(
  strings.filter(([, component]) => component === uid(COMPONENT.MELEE_NORMAL)).at(-1)?.[0],
  "Max hit: 25",
  "open interfaces refresh live max hits",
);

console.log(`max-hit interface ok: group ${GROUP_ID}`);
