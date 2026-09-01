import assert = require("assert");

import {
  decodeClientPacket,
  encodeChatMessage,
  encodeFriendsChatSnapshot,
} from "../src/main/typescript/elvarg/net/protocol/ClientProtocol";
import { FriendsChatManager } from "../src/main/typescript/elvarg/game/content/FriendsChatManager";
import { PlayerSave } from "../src/main/typescript/elvarg/game/entity/impl/player/persistence/PlayerSave";
import { PlayerRelations } from "../src/main/typescript/elvarg/game/model/PlayerRelations";
import { World } from "../src/main/typescript/elvarg/game/World";
import { Misc } from "../src/main/typescript/elvarg/util/Misc";

const friendsListPlugin = require("../plugins/interface/FriendsList.plugin.js");
const socialHooks: Record<string, (event: any) => void> = {};
friendsListPlugin.register({
  onPlayerLogin: (handler: (event: any) => void) => { socialHooks.login = handler; },
  onPlayerLogout: (handler: (event: any) => void) => { socialHooks.logout = handler; },
  onSocialPacket: (handler: (event: any) => void) => { socialHooks.packet = handler; },
  onInterfaceActionClick: (handler: (event: any) => void) => { socialHooks.interface = handler; },
});

const originalSocialHandlers = {
  onLogin: FriendsChatManager.onLogin,
  onLogout: FriendsChatManager.onLogout,
  handleAction: FriendsChatManager.handleAction,
  handlePrivateMessage: FriendsChatManager.handlePrivateMessage,
  setChatFilters: FriendsChatManager.setChatFilters,
  handleChat: FriendsChatManager.handleChat,
  handleWidgetAction: FriendsChatManager.handleWidgetAction,
};
const socialCalls: string[] = [];
try {
  (FriendsChatManager as any).onLogin = () => socialCalls.push("login");
  (FriendsChatManager as any).onLogout = () => socialCalls.push("logout");
  (FriendsChatManager as any).handleAction = () => socialCalls.push("action");
  (FriendsChatManager as any).handlePrivateMessage = () => socialCalls.push("private");
  (FriendsChatManager as any).setChatFilters = () => socialCalls.push("filter");
  (FriendsChatManager as any).handleChat = () => socialCalls.push("chat");
  (FriendsChatManager as any).handleWidgetAction = () => true;
  const player = {};
  socialHooks.login({ player });
  socialHooks.logout({ player });
  for (const packet of [
    { type: "friends_chat_action", action: { action: "add_friend", name: "Alice" } },
    { type: "private_message", recipient: "Alice", text: "Hello" },
    { type: "chat_filter", publicMode: 0, privateMode: 1, tradeMode: 2 },
    { type: "chat", messageType: "friends_chat", text: "Hello channel" },
  ] as const) {
    const event: any = { player, packet, handled: false };
    socialHooks.packet(event);
    assert.strictEqual(event.handled, true);
  }
  const interfaceEvent: any = { player, groupId: 7, childId: 20, action: 1, handled: false };
  socialHooks.interface(interfaceEvent);
  assert.strictEqual(interfaceEvent.handled, true);
  assert.deepStrictEqual(socialCalls, ["login", "logout", "action", "private", "filter", "chat"]);
} finally {
  Object.assign(FriendsChatManager, originalSocialHandlers);
}

function variableBytePacket(opcode: number, body: Buffer): Buffer {
  return Buffer.concat([Buffer.from([opcode, body.length]), body]);
}

function readString(buffer: Buffer, offset: number): [string, number] {
  const end = buffer.indexOf(0, offset);
  assert.notStrictEqual(end, -1);
  return [buffer.toString("latin1", offset, end), end + 1];
}

const persistedRelations = new PlayerRelations({} as any);
persistedRelations.friendList.push(123n);
persistedRelations.loadFriendRanks({ "123": 6, "456": 5 });
assert.strictEqual(persistedRelations.getFriendRank(123n), 6);
assert.strictEqual(persistedRelations.getFriendRank(456n), 0);

const persistedProfile = new PlayerSave() as any;
persistedProfile.friendRanks = { "123": 6 };
persistedProfile.friendsChatChannelName = "Owner Chat";
persistedProfile.friendsChatEntryRank = 1;
persistedProfile.friendsChatTalkRank = 2;
persistedProfile.friendsChatKickRank = 3;
assert.deepStrictEqual(persistedProfile.getFriendRanks(), { "123": 6 });
assert.strictEqual(persistedProfile.getFriendsChatChannelName(), "Owner Chat");
assert.deepStrictEqual([
  persistedProfile.getFriendsChatEntryRank(),
  persistedProfile.getFriendsChatTalkRank(),
  persistedProfile.getFriendsChatKickRank(),
], [1, 2, 3]);

const setupOpens: Array<{ targetUid: number; groupId: number; type: number }> = [];
const setupSender: any = {
  sendSubInterface: (targetUid: number, groupId: number, type: number) => {
    setupOpens.push({ targetUid, groupId, type });
    return setupSender;
  },
  sendString: () => setupSender,
};
const setupPlayer: any = {
  getPacketSender: () => setupSender,
  getRelations: () => ({
    getFriendsChatChannelName: () => "",
    getFriendsChatEntryRank: () => -1,
    getFriendsChatTalkRank: () => -1,
    getFriendsChatKickRank: () => 2,
  }),
};
assert.strictEqual(FriendsChatManager.handleWidgetAction(setupPlayer, 7, 20, undefined, 1), true);
assert.deepStrictEqual(setupOpens, [
  { targetUid: (161 << 16) | 16, groupId: 94, type: 0 },
]);
assert.strictEqual(FriendsChatManager.handleWidgetAction(setupPlayer, 429, 1, undefined, 1), true);
assert.strictEqual(FriendsChatManager.handleWidgetAction(setupPlayer, 432, 1, undefined, 1), true);
assert.deepStrictEqual(setupOpens.slice(1), [
  { targetUid: (161 << 16) | 85, groupId: 432, type: 1 },
  { targetUid: (161 << 16) | 85, groupId: 429, type: 1 },
]);

function socialPlayer(index: number, username: string): any {
  let channelName = "";
  let lastOwner = "";
  let activeChannel = "";
  let pendingNameAction: any;
  const relations = {
    getFriendList: () => [],
    getIgnoreList: () => [],
    getFriendRank: () => 0,
    getFriendsChatChannelName: () => channelName,
    setFriendsChatChannelName: (value: string) => { channelName = value; },
    getFriendsChatEntryRank: () => -1,
    getFriendsChatTalkRank: () => -1,
    getFriendsChatKickRank: () => 2,
    getFriendsChatLastOwner: () => lastOwner,
    setFriendsChatLastOwner: (value: string) => { lastOwner = value; },
  };
  const sender: any = {
    sendMessage: () => sender,
    sendString: () => sender,
    sendEnterInputPrompt: () => sender,
  };
  return {
    getIndex: () => index,
    getUsername: () => username,
    getLongUsername: () => Misc.stringToLongBigInt(username),
    getRights: () => ({ getId: () => 0 }),
    getRelations: () => relations,
    getPacketSender: () => sender,
    getSession: () => ({ sendClientPacket: () => true }),
    setEnteredSyntaxAction: (action: any) => { pendingNameAction = action; },
    getPendingNameAction: () => pendingNameAction,
    setClanChatName: (value: string) => { activeChannel = value; },
    getClanChatName: () => activeChannel,
  };
}

const manager = FriendsChatManager as any;
manager.channels.clear();
manager.membershipByPlayer.clear();
manager.offlinePlayerIds.clear();
const channelOwner = socialPlayer(101, "Owner_A_B");
const channelGuest = socialPlayer(102, "ChannelGuest");
assert.strictEqual(
  FriendsChatManager.handleWidgetAction(channelOwner, 94, 10, "Set prefix", 1),
  true,
);
channelOwner.getPendingNameAction().execute("Owner Chat");
assert.strictEqual(manager.channels.get("owner a b")?.profile.channelName, "Owner Chat");
FriendsChatManager.handleAction(channelGuest, { action: "join", name: "Owner A B" });
assert.strictEqual(channelGuest.getClanChatName(), "Owner_A_B");

manager.channels.clear();
manager.membershipByPlayer.clear();
const originalGetPlayers = World.getPlayers;
(World as any).getPlayers = () => ({
  search: (predicate: (player: any) => boolean) => predicate(channelOwner) ? channelOwner : null,
});
try {
  const profile = manager.loadOwnerProfile({
    key: "owner a b",
    display: "Owner A B",
    encoded: channelOwner.getLongUsername(),
  });
  assert.strictEqual(profile?.channelName, "Owner Chat");
} finally {
  (World as any).getPlayers = originalGetPlayers;
  manager.channels.clear();
  manager.membershipByPlayer.clear();
}

const packetSender = new Proxy({}, { get: () => () => packetSender });
const alice: any = {
  getUsername: () => "Alice",
  getLongUsername: () => 2494434n,
  getPacketSender: () => packetSender,
};
const bob: any = {
  getUsername: () => "Bob",
  getLongUsername: () => 3295n,
  getPacketSender: () => packetSender,
};
alice.getRelations = () => aliceRelations;
bob.getRelations = () => bobRelations;
const aliceRelations = new PlayerRelations(alice);
const bobRelations = new PlayerRelations(bob);
aliceRelations.addFriend(bob.getLongUsername());
assert.strictEqual(aliceRelations.hasFriend(bob.getLongUsername()), true);
assert.strictEqual(aliceRelations.setFriendRank(bob.getLongUsername(), 5), true);
assert.strictEqual(aliceRelations.getFriendRank(bob.getLongUsername()), 5);
bobRelations.addIgnore(alice.getLongUsername());
assert.strictEqual(bobRelations.canReceivePrivateMessageFrom(alice), false);
assert.strictEqual(bobRelations.canReceivePublicChatFrom(alice), false);

assert.deepStrictEqual(
  decodeClientPacket(variableBytePacket(196, Buffer.concat([
    Buffer.from([3]),
    Buffer.from("Alice\0", "latin1"),
    Buffer.from([0]),
  ]))),
  { type: "friends_chat_action", action: { action: "add_friend", name: "Alice" } },
);

for (const [actionCode, action] of [
  [0, "join"],
  [1, "leave"],
  [2, "kick"],
  [4, "remove_friend"],
  [6, "add_ignore"],
  [7, "remove_ignore"],
] as const) {
  assert.deepStrictEqual(
    decodeClientPacket(variableBytePacket(196, Buffer.concat([
      Buffer.from([actionCode]),
      Buffer.from("Alice\0", "latin1"),
      Buffer.from([0]),
    ]))),
    { type: "friends_chat_action", action: action === "leave" ? { action } : { action, name: "Alice" } },
  );
}

assert.deepStrictEqual(
  decodeClientPacket(variableBytePacket(196, Buffer.concat([
    Buffer.from([5]),
    Buffer.from("Alice\0", "latin1"),
    Buffer.from([6]),
  ]))),
  {
    type: "friends_chat_action",
    action: { action: "set_friend_rank", name: "Alice", rank: 6 },
  },
);

assert.deepStrictEqual(
  decodeClientPacket(variableBytePacket(
    197,
    Buffer.from("Alice\0Meet me in Lumbridge.\0", "latin1"),
  )),
  { type: "private_message", recipient: "Alice", text: "Meet me in Lumbridge." },
);

assert.deepStrictEqual(decodeClientPacket(Buffer.from([198, 1, 2, 0])), {
  type: "chat_filter",
  publicMode: 1,
  privateMode: 2,
  tradeMode: 0,
});

const snapshot = encodeFriendsChatSnapshot({
  channel: {
    name: "Astrul",
    owner: "Astrul",
    minKickRank: 2,
    localRank: 7,
    members: [
      { name: "Alice", world: 1, rank: 1 },
      { name: "Astrul", world: 1, rank: 7 },
    ],
  },
  friends: [
    { name: "Alice", previousName: "", world: 1, rank: 1, isOnline: true },
  ],
  ignores: [{ name: "Bob", previousName: "" }],
});
assert.strictEqual(snapshot[0], 121);
assert.strictEqual(snapshot.readUInt16BE(1), snapshot.length - 3);
let offset = 3;
assert.strictEqual(snapshot[offset++], 1);
let value: string;
[value, offset] = readString(snapshot, offset);
assert.strictEqual(value, "Astrul");
[value, offset] = readString(snapshot, offset);
assert.strictEqual(value, "Astrul");
assert.strictEqual(snapshot[offset++], 2);
assert.strictEqual(snapshot[offset++], 7);
assert.strictEqual(snapshot.readUInt16BE(offset), 2);

const incomingPrivate = encodeChatMessage("private_in", "Hello", "Alice", "", 42);
assert.strictEqual(incomingPrivate[0], 120);
offset = 2;
[value, offset] = readString(incomingPrivate, offset);
assert.strictEqual(value, "Hello");
assert.strictEqual(incomingPrivate[offset], 3);

const channelMessage = encodeChatMessage("channel", "Hello channel", "Alice", "Astrul", 42);
offset = 2;
[, offset] = readString(channelMessage, offset);
assert.strictEqual(channelMessage[offset], 9);

console.log("social-protocol-smoke.ts: all tests passed");
