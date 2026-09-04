import { strict as assert } from "assert";
import { TeleportHandler } from "../src/main/typescript/elvarg/game/model/teleportation/TeleportHandler";

const RingOfWealth = require("../plugins/items/RingOfWealth.plugin");
const { CHARGED_RINGS, TELEPORTS, consumeCharge, imbue, recharge } = RingOfWealth._test;

let itemAction: any;
let itemOnItem: any;
let itemOnObject: any;
let deathItemDrop: any;
let multiChatboxPrompt: any;
RingOfWealth.register({
  onItemAction: (handler: any) => (itemAction = handler),
  onItemOnItem: (handler: any) => (itemOnItem = handler),
  onItemOnObject: (handler: any) => (itemOnObject = handler),
  onPlayerDeathItemDrop: (handler: any) => (deathItemDrop = handler),
  sendMultiChatboxPrompt: (...args: any[]) => (multiChatboxPrompt = args),
  getItemOnGroundManager: () => ({ registerLocation: () => undefined }),
});
assert.ok(itemAction && itemOnItem && itemOnObject && deathItemDrop, "ring interactions must be registered");
assert.equal(CHARGED_RINGS.get(11980).charges, 5);
assert.equal(CHARGED_RINGS.get(11988).nextId, 2572);
assert.equal(TELEPORTS.length, 4, "all four ring of wealth destinations must be available");

const messages: string[] = [];
const sender: any = {
  sendMessage: (message: string) => messages.push(message),
  sendString: () => sender,
  sendChatboxInterface: () => sender,
  sendInterfaceRemoval: () => sender,
};
let coins = 50000;
const item = { id: 11980, getId() { return this.id; }, setId(id: number) { this.id = id; } };
const inventory = {
  getItems: () => [item],
  getAmount: (id: number) => id === 995 ? coins : 0,
  refreshItems: () => undefined,
  deleteNumber: (id: number, amount: number) => { if (id === 995) coins -= amount; },
};
const equipmentItems: any[] = [];
const equipment = { getItems: () => equipmentItems, get: () => null, refreshItems: () => undefined };
const attributes = new Map<string, unknown>();
const player: any = {
  getInventory: () => inventory,
  getEquipment: () => equipment,
  getPacketSender: () => sender,
  getAttribute: (key: string) => attributes.get(key),
  setAttribute: (key: string, value: unknown) => attributes.set(key, value),
};

assert.equal(consumeCharge(player, item), true);
assert.equal(item.id, 11982, "a charge must advance to the next cache variant");
item.id = 11988;
consumeCharge(player, item);
assert.equal(item.id, 2572, "the final charge must leave an uncharged ring");
recharge(player, item);
assert.equal(item.id, 11980, "the Fountain of Rune restores five charges");
assert.equal(imbue(player, item), true);
assert.equal(item.id, 20786, "the scroll preserves a fully charged ring when imbuing it");
assert.equal(coins, 0, "imbuing consumes the required 50,000 coins");

item.id = 11980;
const originalCheck = TeleportHandler.checkReqs;
const originalTeleport = TeleportHandler.teleport;
let checkedLimit = -1;
let teleportedTo: any;
TeleportHandler.checkReqs = (_player: any, _destination: any, limit: number) => (checkedLimit = limit, true);
TeleportHandler.teleport = (_player: any, destination: any) => (teleportedTo = destination);
itemAction({ player, item, itemId: 11980, interfaceId: 3214, slot: 0, clickType: 1, option: "Rub", handled: false });
assert.equal(multiChatboxPrompt[1], "Where would you like to teleport to?");
multiChatboxPrompt[3]();
assert.equal(checkedLimit, 30, "ring teleports use the level-30 Wilderness limit");
assert.equal(teleportedTo, TELEPORTS[0].destination);
assert.equal(item.id, 11982, "teleporting consumes exactly one charge");

item.id = 11980;
itemAction({ player, item, itemId: 11980, interfaceId: 3214, slot: 0, clickType: 1, option: "Grand Exchange", handled: false });
assert.equal(teleportedTo, TELEPORTS[0].destination, "inventory teleport options must use their displayed labels");

item.id = 11980;
itemAction({ player, item, itemId: 11980, interfaceId: 3214, slot: 0, clickType: 4, subOpId: 1, handled: false });
assert.equal(teleportedTo, TELEPORTS[0].destination, "Rub submenu choices must use their displayed order");

const bossLogEvent: any = { player, item, itemId: 11980, interfaceId: 3214, slot: 0, clickType: 1, subOpId: 5, handled: false };
itemAction(bossLogEvent);
assert.equal(bossLogEvent.handled, true, "Boss Log must not fall through to an item action");
assert.equal(item.id, 11980, "Boss Log must not consume a teleport charge");

const coinCollectionEvent: any = { player, item, itemId: 11980, interfaceId: 3214, slot: 0, clickType: 1, subOpId: 6, handled: false };
itemAction(coinCollectionEvent);
assert.equal(coinCollectionEvent.handled, true, "Coin Collection must not fall through to an item action");
assert.equal(attributes.get("ringOfWealthAutoCollect"), false, "Coin Collection must toggle currency collection");

item.id = 11980;
equipmentItems[12] = item;
itemAction({ player, item, itemId: 11980, interfaceId: 1688, slot: 12, clickType: 1, option: "Rub", handled: false });
assert.equal(multiChatboxPrompt[1], "Where would you like to teleport to?");
const removeEvent: any = { player, item, itemId: 11980, interfaceId: 1688, slot: 12, clickType: 1, handled: false };
itemAction(removeEvent);
assert.equal(removeEvent.handled, false, "Remove must remain available for an equipped ring");
itemAction({ player, item, itemId: 11980, interfaceId: 1688, slot: 12, clickType: 2, handled: false });
assert.equal(teleportedTo, TELEPORTS[1].destination, "equipped teleport options must not unequip the ring");
assert.equal(item.id, 11982, "an equipped teleport consumes one charge");
item.id = 11980;
const equippedBossLogEvent: any = { player, item, itemId: 11980, interfaceId: 1688, slot: 12, clickType: 6, handled: false };
itemAction(equippedBossLogEvent);
assert.equal(equippedBossLogEvent.handled, true, "equipped Boss Log must not unequip the ring");
const equippedCoinCollectionEvent: any = { player, item, itemId: 11980, interfaceId: 1688, slot: 12, clickType: 7, handled: false };
itemAction(equippedCoinCollectionEvent);
assert.equal(equippedCoinCollectionEvent.handled, true, "equipped Coin Collection must not unequip the ring");
TeleportHandler.checkReqs = originalCheck;
TeleportHandler.teleport = originalTeleport;

const deathRing = { id: 20786, getId() { return this.id; }, setId(id: number) { this.id = id; } };
let returnedCoins = 0;
deathItemDrop({
  item: deathRing,
  killer: { getInventory: () => ({ forceAdd: (_player: any, coins: any) => (returnedCoins = coins.getAmount()) }) },
});
assert.equal(deathRing.id, 11980, "death removes the imbue but preserves ring charges");
assert.equal(returnedCoins, 50000, "PvP deaths return the imbue value to the killer");
console.info("ring of wealth plugin ok: charges, recharge, imbue, and level-30 teleport checked");
