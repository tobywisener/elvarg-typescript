import { strict as assert } from "assert";

const LootKeys = require("../plugins/items/LootKeys.plugin");
const NpcDialogues = require("../plugins/npcs/NpcDialogues.plugin");
const Service = LootKeys;
const { Item } = require("../src/main/typescript/elvarg/game/model/Item");
const { ItemDefinition } = require("../src/main/typescript/elvarg/game/definition/ItemDefinition");
const { ItemIdentifiers } = require("../src/main/typescript/elvarg/util/ItemIdentifiers");

// This is a plugin-unit test, so supply the two cache fields Loot Keys reads without
// initializing the full cache pipeline.
ItemDefinition.forId = (id: number) => ({
  getValue: () => 1,
  getNoteId: () => id === 4151 ? 4152 : -1,
  getName: () => id === 4152 ? "Abyssal whip" : "Abyssal whip",
  isNoted: () => id === 4152,
  isStackable: () => false,
});

let dropHandler: any;
let defeatedHandler: any;
let itemAction: any;
let skullyHandler: any;
let canBankItem: any;
LootKeys.register({
  persistAttribute: () => undefined,
  onPlayerDeathItemDrop: (handler: any) => (dropHandler = handler),
  onPlayerDefeated: (handler: any) => (defeatedHandler = handler),
  onItemAction: (handler: any) => (itemAction = handler),
  onNpcInteraction: (_name: string, actions: any) => (skullyHandler = actions["Talk-to"]),
  onCanBankItem: (handler: any) => (canBankItem = handler),
  onRegionLoaded: () => undefined,
  onObjectInteraction: () => undefined,
  onItemOnObject: () => undefined,
  onInterfaceActionClick: () => undefined,
  onObjectFirstClick: () => undefined,
  onCanAttack: () => undefined,
  sendMultiChatboxPrompt: () => true,
});
assert.ok(dropHandler && defeatedHandler && itemAction && skullyHandler && canBankItem, "Loot Keys must register all interactions");

const attributes = new Map<string, unknown>();
const messages: string[] = [];
const openedSubinterfaces: any[][] = [];
const sender: any = {
  sendMessage: (message: string) => messages.push(message),
  sendSubInterface: (...args: any[]) => (openedSubinterfaces.push(args), sender),
  sendInterfaceFlagsRange: () => sender,
  sendInterfaceScript: (...args: any[]) => (openedSubinterfaces.push(["script", ...args]), sender),
  sendInterfaceRemoval: () => sender,
  sendEnterAmountPrompt: () => sender,
};
const inventoryItems: any[] = [];
const inventory: any = {
  getItems: () => inventoryItems,
  getValidItems: () => inventoryItems.filter(Boolean),
  getFreeSlots: () => 28 - inventoryItems.filter(Boolean).length,
  addItem: (item: any) => inventoryItems.push(item),
  add: (item: any) => inventoryItems.push(item),
  refreshItems: () => undefined,
  getAmount: (id: number) => inventoryItems.filter((item) => item?.getId() === id).reduce((sum, item) => sum + item.getAmount(), 0),
  delete: () => undefined,
  deleteAtSlot: (slot: number) => inventoryItems.splice(slot, 1),
};
const bankItems: any[] = [];
const banks = Array.from({ length: 11 }, () => ({
  getFreeSlots: () => 352,
  getValidItems: () => bankItems,
  contains: (id: number) => bankItems.some((item) => item.getId() === id),
  add: (item: any) => bankItems.push(item),
  open: () => undefined,
}));
const location = { clone: () => location, getX: () => 3200, getY: () => 3700, getZ: () => 0 };
let interfaceId = -1;
const killer: any = {
  isPlayer: () => true,
  isPlayerBot: () => false,
  getLocation: () => location,
  getInventory: () => inventory,
  getBank: (tab: number) => banks[tab],
  getCurrentBankTab: () => 0,
  getAttribute: (key: string) => attributes.get(key),
  setAttribute: (key: string, value: unknown) => attributes.set(key, value),
  getPacketSender: () => sender,
  getInterfaceId: () => interfaceId,
  setInterfaceId: (id: number) => (interfaceId = id),
};
const victim: any = { isPlayer: () => true, isPlayerBot: () => true, getLocation: () => location };
Service.setLootKeysEnabled(killer, true);
assert.equal(Service.isEligibleKill(killer, victim), true, "Wilderness player bots must be eligible Loot Key victims");

// Use a real Wilderness tile so the production eligibility check is exercised.
const dropped = new Item(ItemIdentifiers.COINS, 125_000);
const event: any = { player: victim, killer, item: dropped, dropEligible: true, suppressDefaultDrop: false, handled: false };
dropHandler(event);
assert.equal(event.suppressDefaultDrop, true, "eligible PvP loot must suppress the floor drop");
defeatedHandler({ killer, victim });
assert.equal(inventoryItems.length, 1, "one kill produces one Loot key");
assert.equal(inventoryItems[0].getId(), ItemIdentifiers.LOOT_KEY);
assert.equal(Service.keyItems(inventoryItems[0])[0].amount, 125_000);
assert.equal(Service.createKey([dropped], 1).getId(), ItemIdentifiers.LOOT_KEY_2, "the second key must use the cache's second Loot Key variant");

const keyEvent: any = { player: killer, item: inventoryItems[0], option: "Check", handled: false };
itemAction(keyEvent);
assert.equal(keyEvent.handled, true, "Check must be owned by the Loot Keys plugin");
assert.match(messages.at(-1) ?? "", /125,000 coins/);
const bankEvent: any = { player: killer, item: inventoryItems[0], allow: null };
canBankItem(bankEvent);
assert.equal(bankEvent.allow, false, "Loot keys must not be bankable");
assert.equal(Service.openKey(killer, 0), true, "a Loot Chest must open a valid key");
assert.equal(inventoryItems.length, 0, "opening removes exactly the chosen key");
assert.equal(Service.chestItems(killer)[0].id, ItemIdentifiers.COINS);
assert.equal(Service.takeChestItem(killer, 0, "bank"), true, "the chest must bank an individual item");
assert.equal(bankItems[0].getId(), ItemIdentifiers.COINS);
assert.equal(bankItems[0].getAmount(), 125_000);
inventoryItems.push(new Item(ItemIdentifiers.LOOT_KEY, 1));
assert.equal(Service.openKey(killer, 0), false, "a malformed key must not be consumed");
assert.equal(inventoryItems.length, 1, "an empty key remains in the inventory");
inventoryItems.length = 0;
Service.setChestItems(killer, [{ id: 4151, amount: 2 }]);
for (let slot = 0; slot < 27; slot++) inventoryItems.push(new Item(4151, 1));
assert.equal(Service.takeChestItem(killer, 0, "inventory"), true, "a full transfer attempt is handled");
assert.deepEqual(Service.chestItems(killer), [{ id: 4151, amount: 2 }], "loot stays in the chest when all of it cannot fit");
assert.equal(inventoryItems.length, 27, "a failed transfer must not partially add loot");
inventoryItems.length = 0;
Service.setSettings(killer, { includeSupplies: true, floorValue: 100 });
assert.equal(Service.shouldStoreItem(killer, dropped), false, "items at or above the floor threshold must remain ground loot");

let chestClick: any;
let itemOnObject: any;
let chestInterfaceAction: any;
let chestObjectName: string | undefined;
let keySelection: any[] | undefined;
const persistedChestAttributes: string[] = [];
LootKeys.register({
  persistAttribute: (key: string) => persistedChestAttributes.push(key),
  onPlayerDeathItemDrop: () => undefined,
  onPlayerDefeated: () => undefined,
  onCanBankItem: () => undefined,
  onItemAction: () => undefined,
  onNpcInteraction: () => undefined,
  onRegionLoaded: () => undefined,
  onObjectInteraction: (name: string, actions?: any) => {
    chestObjectName = name;
    chestClick = actions.Loot;
  },
  onItemOnObject: (handler: any) => (itemOnObject = handler),
  onInterfaceActionClick: (handler: any) => (chestInterfaceAction = handler),
  onObjectFirstClick: () => undefined,
  onCanAttack: () => undefined,
  sendMultiChatboxPrompt: (...args: any[]) => {
    keySelection = args;
    return true;
  },
});
assert.ok(chestClick && chestInterfaceAction && itemOnObject, "Loot Chest must register its named Loot action and native UI handler");
assert.equal(chestObjectName, "Loot Chest", "the named object hook must match the cache's exact case");
assert.ok(persistedChestAttributes.includes(Service.CHEST_ATTRIBUTE) && persistedChestAttributes.includes(Service.CHEST_TAB_ATTRIBUTE), "unclaimed chest loot must be persisted");
Service.setChestItems(killer, []);
inventoryItems.push(Service.createKey([new Item(4151, 1)]), Service.createKey([new Item(ItemIdentifiers.COINS, 1)]));
assert.equal(LootKeys._test.openKeySelection({ sendMultiChatboxPrompt: (...args: any[]) => {
  keySelection = args;
  return true;
} }, killer), true, "multiple keys must show a selection prompt");
assert.equal(Service.chestItems(killer).length, 0, "showing the selector must not consume a key");
keySelection?.[3]();
assert.deepEqual(Service.chestItems(killer), [{ id: 4151, amount: 1, meta: null }], "selecting a key must move its payload into the chest before opening it");
const selectedKeyState = openedSubinterfaces.slice().reverse().find((entry) => entry[0] === "script" && entry[1] === 0);
assert.deepEqual(selectedKeyState?.[5]?.[558]?.slots, [{ slot: 0, itemId: 4151, quantity: 1 }], "the opened interface must receive the selected key payload");
inventoryItems.length = 0;
Service.setChestItems(killer, []);
inventoryItems.push(Service.createKey([dropped]));
assert.equal(chestClick({ player: killer }), true, "Loot Chest Loot must claim the named object action");
assert.equal(LootKeys._test.open(killer), true, "a Loot Chest must open its interface");
const latestEntry = (predicate: (entry: any[]) => boolean) => openedSubinterfaces.slice().reverse().find(predicate);
const modalIndex = openedSubinterfaces.findIndex((entry) => entry[0] === ((161 << 16) | 16));
const nativeUpdate = openedSubinterfaces[modalIndex - 1];
assert.deepEqual(openedSubinterfaces[modalIndex], [(161 << 16) | 16, 742, 0], "the Loot Chest must mount cache interface 742 in the game modal container");
assert.equal(nativeUpdate?.[1], 0, "Loot Chest state must arrive before the cache on-load script");
assert.equal(openedSubinterfaces[modalIndex + 1]?.[1], 8006, "Loot Chest must render its payload immediately after mounting");
assert.deepEqual(Object.keys(nativeUpdate?.[5] ?? {}).map(Number), [558, 559, 560, 561, 562], "the native UI must receive every Loot Key container");
Service.setChestItems(killer, [{ id: ItemIdentifiers.COINS, amount: 125_000 }]);
LootKeys._test.handleInterfaceAction(killer, { buttonId: (742 << 16) | 5, action: 1, slot: 0 });
assert.equal(Service.chestItems(killer)[0].amount, 124_999, "native Take removes only one item from the chest");
Service.setChestItems(killer, [{ id: 4151, amount: 1 }]);
LootKeys._test.handleInterfaceAction(killer, { buttonId: (742 << 16) | 21 });
LootKeys._test.handleInterfaceAction(killer, { buttonId: (742 << 16) | 5, action: 7, slot: 0 });
assert.equal(bankItems.at(-1).getId(), 4151, "banking Loot Chest items must never convert them to notes");

let genericTalkTo: any;
NpcDialogues.register({ onAnyNpcInteraction: (actions: any) => (genericTalkTo = actions["Talk-to"]) });
assert.equal(genericTalkTo({ definition: { getName: () => "Skully" } }), false, "the generic dialogue fallback must not claim Skully");
console.log("loot keys plugin smoke test passed");
