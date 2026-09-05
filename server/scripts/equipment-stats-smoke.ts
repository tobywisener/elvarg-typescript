import assert = require("assert");
import { Equipment } from "../src/main/typescript/elvarg/game/model/container/impl/Equipment";
import { EquipPacketListener } from "../src/main/typescript/elvarg/net/packet/impl/EquipPacketListener";
import { ItemActionPacketListener } from "../src/main/typescript/elvarg/net/packet/impl/ItemActionPacketListener";

const EquipmentStats = require("../plugins/interface/EquipmentStats.plugin");

const OPEN_BUTTON = (387 << 16) | 1;
const MAIN_MODAL_TARGET_UID = (161 << 16) | 16;
const SIDE_MODAL_TARGET_UID = (161 << 16) | 74;
const component = (childId: number) => (84 << 16) | childId;

function item(id: number, weight: number, name = "Item", amount = 1, equipmentSlot = -1) {
  const definition = {
    getName: () => name,
    getWeight: () => weight,
    getEquipmentType: () => ({ getSlot: () => equipmentSlot }),
  };
  return {
    getId: () => id,
    getAmount: () => amount,
    getDefinition: () => definition,
  };
}

type Sent = { call: string; args: any[] };
const sent: Sent[] = [];
const sender: any = {};
for (const call of [
  "sendVarbit",
  "sendSubInterface",
  "sendInterfaceFlagsRange",
  "sendInterfaceScript",
  "sendString",
  "sendMessage",
  "sendInterfaceRemoval",
]) {
  sender[call] = (...args: any[]) => {
    sent.push({ call, args });
    return sender;
  };
}

const empty = item(-1, 0, "null", 0);
const equipmentItems = new Array(14).fill(empty);
equipmentItems[Equipment.HEAD_SLOT] = item(11865, 2, "Slayer helmet (i)");
equipmentItems[Equipment.AMULET_SLOT] = item(12018, 0.5, "Salve amulet(ei)");
equipmentItems[Equipment.WEAPON_SLOT] = item(2000, 1.2, "Test weapon");
const inventoryItems = [item(3000, 3, "Inventory item", 1, Equipment.WEAPON_SLOT)];
const inventory = {
  capacity: () => 28,
  getItems: () => inventoryItems,
};

let interfaceId = -1;
let preserveOnEquip = -1;
let bonusUpdates = 0;
const bonusManager = {
  getAttackBonus: () => [-4, 8, 0, 12, 16],
  getDefenceBonus: () => [1, 2, 3, 4, 5],
  getOtherBonus: () => [6, 7, 10, 9],
};
const player: any = {
  busy: () => false,
  getPacketSender: () => sender,
  setInterfaceId: (id: number) => { interfaceId = id; },
  getInterfaceId: () => interfaceId,
  setAttribute: (name: string, value: number) => {
    if (name === EquipPacketListener.PRESERVE_INTERFACE_ON_EQUIP_ATTRIBUTE) preserveOnEquip = value;
  },
  getAttribute: (name: string) =>
    name === EquipPacketListener.PRESERVE_INTERFACE_ON_EQUIP_ATTRIBUTE ? preserveOnEquip : null,
  getInventory: () => inventory,
  getEquipment: () => ({ getItems: () => equipmentItems }),
  getBonusManager: () => bonusManager,
  getWeapon: () => ({ getSpeed: () => 5 }),
  getBaseAttackSpeed: () => 4,
  isTeleportingReturn: () => false,
  getHitpoints: () => 99,
};

const handlers = new Map<number, (event: any) => boolean>();
let processHandler: ((event: any) => void) | undefined;
EquipmentStats.register({
  getBonusManager: () => ({
    update: (target: any) => {
      assert.equal(target, player);
      bonusUpdates++;
    },
  }),
  onInterfaceActionButton: (buttonIds: number | number[], handler: (event: any) => boolean) => {
    for (const buttonId of Array.isArray(buttonIds) ? buttonIds : [buttonIds]) {
      handlers.set(buttonId, handler);
    }
  },
  onPlayerProcess: (handler: (event: any) => void) => {
    processHandler = handler;
  },
});

assert.equal(Equipment.EQUIPMENT_SCREEN_INTERFACE_ID, 84);
assert.equal(handlers.get(OPEN_BUTTON)?.({ player }), true);
assert.equal(interfaceId, 84);
assert.equal(preserveOnEquip, 84, "equipment stats must stay open when equipping");
assert.equal(EquipPacketListener.preservesInterfaceOnEquip(player), true);
assert.deepEqual(
  sent.filter((entry) => entry.call === "sendSubInterface").map((entry) => entry.args),
  [
    [MAIN_MODAL_TARGET_UID, 84, 0],
    [SIDE_MODAL_TARGET_UID, 85, 3],
  ],
);
assert.deepEqual(sent.find((entry) => entry.call === "sendVarbit")?.args, [12393, 1]);
assert.deepEqual(
  sent.find((entry) => entry.call === "sendInterfaceFlagsRange")?.args,
  [85 << 16, 0, 27, 1180674],
);

const text = new Map(
  sent
    .filter((entry) => entry.call === "sendString")
    .map((entry) => [entry.args[1], entry.args[0]]),
);
assert.equal(text.get(component(24)), "Stab: -4");
assert.equal(text.get(component(28)), "Range: +16");
assert.equal(text.get(component(30)), "Stab: +1");
assert.equal(text.get(component(34)), "Range: +5");
assert.equal(text.get(component(36)), "Melee STR: +6");
assert.equal(text.get(component(38)), "Magic DMG: +10.0%");
assert.equal(text.get(component(39)), "Prayer: +9");
assert.equal(text.get(component(41)), "Undead: +20% (all styles)");
assert.equal(text.get(component(42)), "Slayer: +16% (all styles)");
assert.equal(text.get(component(53)), "Base: 3.0s");
assert.equal(text.get(component(54)), "Actual: 2.4s");
assert.equal(text.get(component(51)), "6.7 kg");
assert.equal(bonusUpdates, 1);

const originalEquip = EquipPacketListener.equip;
const originalUnequip = EquipPacketListener.unequip;
let equipped: any[] | undefined;
let unequipped: any[] | undefined;
EquipPacketListener.equip = ((...args: any[]) => { equipped = args; }) as any;
EquipPacketListener.unequip = ((...args: any[]) => { unequipped = args; return true; }) as any;
try {
  assert.equal(handlers.get(85 << 16)?.({
    player,
    buttonId: 85 << 16,
    action: 1,
    itemId: 3000,
    slot: 0,
  }), true);
  assert.deepEqual(equipped, [player, 3000, 0, 3214]);

  equipped = undefined;
  ItemActionPacketListener.handleFirstAction(player, 3214, 3000, 0);
  assert.deepEqual(equipped, [player, 3000, 0, 3214]);

  assert.equal(handlers.get(component(13))?.({
    player,
    buttonId: component(13),
    action: 1,
    itemId: 2000,
    slot: 0,
  }), true);
  assert.deepEqual(unequipped, [player, Equipment.WEAPON_SLOT]);
  assert.equal(
    sent.filter((entry) => entry.call === "sendInterfaceRemoval").length,
    0,
    "equipping and removing items must not close equipment stats",
  );
} finally {
  EquipPacketListener.equip = originalEquip;
  EquipPacketListener.unequip = originalUnequip;
}

assert.ok(processHandler);
processHandler!({ player });
assert.equal(bonusUpdates, 2, "the open interface should refresh live");
interfaceId = 387;
processHandler!({ player });
assert.equal(bonusUpdates, 2, "closed equipment stats should not be refreshed");

console.log("equipment stats interface smoke test passed");
