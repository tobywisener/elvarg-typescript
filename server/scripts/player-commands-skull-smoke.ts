import * as assert from "node:assert/strict";
import { MultiChatboxPrompt } from "../src/main/typescript/elvarg/game/model/menu/MultiChatboxPrompt";
import { SkullType } from "../src/main/typescript/elvarg/game/model/SkullType";

const damageFormulasPath = require.resolve(
  "../src/main/typescript/elvarg/game/content/combat/formula/DamageFormulas"
);
require.cache[damageFormulasPath] = { exports: { DamageFormulas: {} } } as NodeModule;
const plugin = require("../plugins/commands/PlayerCommands.plugin.js");

const commands = new Map<string, (event: any) => boolean>();
let inCombat = false;
const skulls: Array<{ player: any; type: SkullType; duration: number }> = [];
const sent = {
  chatboxes: [] as number[],
  scripts: [] as any[][],
  messages: [] as string[],
  removals: 0,
};
const sender: any = {
  sendInterfaceScript: () => sender,
  sendVarbit: () => sender,
  sendChatboxInterface: (id: number) => {
    sent.chatboxes.push(id);
    return sender;
  },
  sendClientScript: (...args: any[]) => {
    sent.scripts.push(args);
    return sender;
  },
  sendInterfaceFlagsRange: () => sender,
  sendInterfaceRemoval: () => {
    sent.removals++;
    return sender;
  },
  sendMessage: (message: string) => {
    sent.messages.push(message);
    return sender;
  },
};
const player = { getPacketSender: () => sender };
const worldPlayers: any[] = [];
const combatFactory = {
  inCombat: () => inCombat,
  skull: (target: any, type: SkullType, duration: number) => {
    skulls.push({ player: target, type, duration });
  },
};

plugin.register({
  getWorld: () => ({ getPlayers: () => worldPlayers }),
  getItemOnGroundManager: () => ({}),
  getCombatFactory: () => combatFactory,
  getPlayerPunishment: () => ({ muted: () => false, IPMuted: () => false }),
  registerCommand: (name: string, handler: (event: any) => boolean) => {
    commands.set(name, handler);
  },
  sendMultiChatboxPrompt: (target: any, title: string, ...pairs: any[]) =>
    MultiChatboxPrompt.showPrompt("PlayerCommands", target, title, pairs),
});

const choose = (option: number, useWidgetAction = false) => MultiChatboxPrompt.handleInterfaceActionClick({
  player,
  buttonId: (219 << 16) | 1,
  action: useWidgetAction ? 0 : option,
  groupId: 219,
  childId: 1,
  slot: useWidgetAction ? option : undefined,
  handled: false,
});

const skullCommand = commands.get("skull");
const redSkullCommand = commands.get("redskull");
assert.ok(skullCommand);
assert.ok(redSkullCommand);

skullCommand({ player });
assert.strictEqual(skulls.length, 0, "::skull must not apply a skull before confirmation");
assert.strictEqual(sent.chatboxes[sent.chatboxes.length - 1], 219, "::skull must open the native option chatbox");
assert.deepStrictEqual(
  sent.scripts[sent.scripts.length - 1],
  [58, "Skulling yourself can make you lose every carried item. Are you sure?", "Yes|No"]
);
assert.strictEqual(choose(2, true), true);
assert.strictEqual(skulls.length, 0, "choosing No must leave the player unskulled");

skullCommand({ player });
assert.strictEqual(choose(1, true), true);
assert.deepStrictEqual(skulls[skulls.length - 1], {
  player,
  type: SkullType.WHITE_SKULL,
  duration: 300,
});

skullCommand({ player });
inCombat = true;
assert.strictEqual(choose(1), true);
assert.strictEqual(skulls.length, 1, "combat must be checked again when Yes is selected");
assert.strictEqual(sent.messages[sent.messages.length - 1], "You cannot change that during combat!");

const promptsBeforeCombatCommand = sent.chatboxes.length;
skullCommand({ player });
assert.strictEqual(
  sent.chatboxes.length,
  promptsBeforeCombatCommand,
  "a player already in combat must not receive the prompt"
);

inCombat = false;
redSkullCommand({ player });
assert.deepStrictEqual(
  sent.scripts[sent.scripts.length - 1],
  [58, "A red skull makes you lose every carried item and disables Protect Item. Continue?", "Yes|No"]
);
assert.strictEqual(choose(1), true);
assert.deepStrictEqual(skulls[skulls.length - 1], {
  player,
  type: SkullType.RED_SKULL,
  duration: 60 * 30,
});
assert.strictEqual(sent.removals, 4, "every answer must close its option chatbox");

const yellCommand = commands.get("yell");
assert.ok(yellCommand);
const staff = {
  isStaff: () => true,
  isDonator: () => false,
  getUsername: () => "Developer",
  getHostAddress: () => "127.0.0.1",
  getRights: () => ({ getYellTag: () => "[Developer]" }),
  getChatIcons: () => [1],
  getYellDelay: () => ({ finished: () => true, start: () => undefined }),
  getPacketSender: () => sender,
};
worldPlayers.push({ getPacketSender: () => sender });
sent.messages.length = 0;
yellCommand({ player: staff, raw: "yell hello" });
assert.equal(sent.messages[sent.messages.length - 1], "<col=7f0000>[Developer] <img=1> Developer: hello</col>");

const originalNow = Date.now;
let now = originalNow();
Date.now = () => now;
try {
  let selected = 0;
  MultiChatboxPrompt.showPrompt("test", player, "Animation review", ["Continue", () => selected++, "Cancel", () => {}]);
  now += 9 * 60_000;
  assert.strictEqual(choose(1), true, "an animation-review choice must remain active for ten minutes");
  assert.strictEqual(selected, 1);

  MultiChatboxPrompt.showPrompt("test", player, "Animation review", ["Continue", () => {}, "Cancel", () => {}]);
  const removalsBeforeExpiry = sent.removals;
  now += 10 * 60_000 + 1;
  assert.strictEqual(choose(1), false, "expired prompts must not execute their callback");
  assert.strictEqual(sent.removals, removalsBeforeExpiry + 1, "an expired prompt must close instead of leaving Please wait");
} finally {
  Date.now = originalNow;
}

console.log("player command skull confirmation smoke passed");
