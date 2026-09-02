import { strict as assert } from "assert";
import { TeleportHandler } from "../src/main/typescript/elvarg/game/model/teleportation/TeleportHandler";

const Teleports = require("../plugins/interface/TeleportInterface.plugin");
const { GROUP_ID, COMPONENT, DESTINATIONS, LIST_CONTENT_HEIGHT, ROW_COUNT, TAB, TAB_UIDS, ROW_UIDS, uid } = Teleports._test;

let definition: any;
let command: ((event: any) => boolean) | undefined;
let tabs: ((event: any) => boolean) | undefined;
let rows: ((event: any) => boolean) | undefined;
Teleports.register({
  registerCustomInterface: (value: any) => (definition = value),
  registerCommand: (name: string, handler: any) => { if (name === "teleports") command = handler; },
  onInterfaceActionButton: (ids: number[], handler: any) => {
    if (ids === TAB_UIDS) tabs = handler;
    if (ids === ROW_UIDS) rows = handler;
  },
});

assert.equal(definition.groupId, GROUP_ID);
assert.equal(definition.scroll[0].contentHeight, LIST_CONTENT_HEIGHT);
assert.equal(DESTINATIONS[TAB.TELEPORTS].length, 28);
assert.equal(DESTINATIONS[TAB.WILDERNESS].length, 5);
assert.equal(DESTINATIONS[TAB.BOSSES].length, 10);
assert.ok(command && tabs && rows, "teleport command and interface actions must be registered");

const sent: Array<{ call: string; args: any[] }> = [];
let interfaceId = -1;
let tab = "";
const sender: any = new Proxy(
  {
    sendInterfaceRemoval: () => {
      sent.push({ call: "sendInterfaceRemoval", args: [] });
      interfaceId = -1;
      return sender;
    },
  },
  {
    get: (target, call: string) => target[call] ?? ((...args: any[]) => {
      sent.push({ call, args });
      return sender;
    }),
  }
);
const player = {
  getPacketSender: () => sender,
  setInterfaceId: (value: number) => (interfaceId = value),
  getInterfaceId: () => interfaceId,
  setAttribute: (key: string, value: string) => { if (key === "teleports:tab") tab = value; },
  getAttribute: (key: string) => (key === "teleports:tab" ? tab : null),
};

command!({ player });
assert.equal(interfaceId, GROUP_ID);
assert.equal(sent.find((entry) => entry.call === "sendSubInterface")?.args[1], GROUP_ID);
assert.match(sent.filter((entry) => entry.call === "sendString").map((entry) => entry.args[0]).join("\n"), /Standard: Varrock/);

sent.length = 0;
tabs!({ player, buttonId: uid(COMPONENT.TAB_START + 1) });
assert.equal(tab, TAB.WILDERNESS);
assert.match(sent.filter((entry) => entry.call === "sendString").map((entry) => entry.args[0]).join("\n"), /Ancient: Ghorrock/);
assert.equal(sent.filter((entry) => entry.call === "sendInterfaceDisplayState").length, ROW_COUNT * 2);
assert.equal(rows!({ player, buttonId: uid(COMPONENT.ROW_LABEL_START + ROW_COUNT) }), true, "invalid rows are ignored");
assert.equal(interfaceId, GROUP_ID, "invalid rows leave the interface open");

let teleport: any;
const checkReqs = TeleportHandler.checkReqs;
const teleportPlayer = TeleportHandler.teleport;
TeleportHandler.checkReqs = () => true;
TeleportHandler.teleport = (...args: any[]) => (teleport = args);
rows!({ player, buttonId: uid(COMPONENT.ROW_LABEL_START) });
TeleportHandler.checkReqs = checkReqs;
TeleportHandler.teleport = teleportPlayer;
assert.equal(teleport[1], DESTINATIONS[TAB.WILDERNESS][0].destination, "the selected row must use the active category");
assert.equal(interfaceId, -1, "selecting a row closes the interface before checking teleport requirements");
console.info("teleports interface ok: 28 spellbook teleports, 5 wilderness teleports, 10 bosses");
