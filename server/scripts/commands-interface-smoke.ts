import { strict as assert } from "assert";

const Commands = require("../plugins/interface/Commands.plugin");
const { GROUP_ID, COMPONENT, ROW_COUNT, LIST_CONTENT_HEIGHT, uid } = Commands._test;

const sent: Array<{ call: string; args: any[] }> = [];
const sender: any = new Proxy({}, { get: (_target, call: string) => (...args: any[]) => {
  sent.push({ call, args });
  return sender;
} });
let interfaceId = -1;
let command: ((event: any) => boolean) | undefined;
let definition: any;

Commands.register({
  registerCustomInterface: (value: any) => (definition = value),
  registerCommand: (name: string, handler: (event: any) => boolean) => {
    if (name === "commands") command = handler;
  },
});

assert.equal(definition.groupId, GROUP_ID);
assert.equal(definition.scroll[0].contentHeight, LIST_CONTENT_HEIGHT);
assert.equal(definition.widgets.filter((widget: any) => widget.parentUid === uid(COMPONENT.LIST_VIEW)).length, ROW_COUNT);
assert.ok(command, "::commands must be registered");

command!({ player: {
  getRights: () => ({ getId: () => 4 }),
  getPacketSender: () => sender,
  setInterfaceId: (id: number) => (interfaceId = id),
} });

assert.equal(interfaceId, GROUP_ID);
assert.equal(sent.find((entry) => entry.call === "sendSubInterface")?.args[1], GROUP_ID);
const rows = sent.filter((entry) => entry.call === "sendString").map((entry) => entry.args[0]).join("\n");
assert.match(rows, /Player commands/);
assert.match(rows, /Moderator commands/);
assert.match(rows, /Administrator commands/);
assert.match(rows, /Developer commands/);
console.log(`commands interface ok: ${ROW_COUNT} scroll rows`);
