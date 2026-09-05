
const { Equipment } = require("../../src/main/typescript/elvarg/game/model/container/impl/Equipment");
const { Inventory } = require("../../src/main/typescript/elvarg/game/model/container/impl/Inventory");
const { EquipPacketListener } = require("../../src/main/typescript/elvarg/net/packet/impl/EquipPacketListener");
const { WeaponProfiles } = require("../../src/main/typescript/elvarg/game/content/combat/WeaponProfile");

// OpenRune cache names: component.wornitems:equipment and interface.equipment.
const OPEN_EQUIPMENT_STATS_BUTTON = (387 << 16) | 1;
const EQUIPMENT_STATS_INTERFACE_ID = 84;
const EQUIPMENT_SIDE_INTERFACE_ID = 85;
const MAIN_MODAL_TARGET_UID = (161 << 16) | 16;
const SIDE_MODAL_TARGET_UID = (161 << 16) | 74;
const INVENTORY_ID = 93;
const EQUIPMENT_SIDE_ITEMS_COMPONENT = EQUIPMENT_SIDE_INTERFACE_ID << 16;
const EQUIPMENT_SLOT_COMPONENTS = [
  Equipment.HEAD_SLOT,
  Equipment.CAPE_SLOT,
  Equipment.AMULET_SLOT,
  Equipment.WEAPON_SLOT,
  Equipment.BODY_SLOT,
  Equipment.SHIELD_SLOT,
  Equipment.LEG_SLOT,
  Equipment.HANDS_SLOT,
  Equipment.FEET_SLOT,
  Equipment.RING_SLOT,
  Equipment.AMMUNITION_SLOT,
].map((slot, index) => ({ component: (EQUIPMENT_STATS_INTERFACE_ID << 16) | (10 + index), slot }));
const EQUIPMENT_SLOT_BY_COMPONENT = new Map(
  EQUIPMENT_SLOT_COMPONENTS.map(({ component: buttonId, slot }) => [buttonId, slot]),
);

const ATTACK_CHILDREN = [24, 25, 26, 27, 28];
const DEFENCE_CHILDREN = [30, 31, 32, 33, 34];
const OTHER_CHILDREN = [36, 37, 38, 39];
const ATTACK_LABELS = ["Stab", "Slash", "Crush", "Magic", "Range"];
const DEFENCE_LABELS = ["Stab", "Slash", "Crush", "Magic", "Range"];
const OTHER_LABELS = ["Melee STR", "Ranged STR", "Magic DMG", "Prayer"];

const SALVE_AMULETS = new Map([
  [4081, { percent: 100 / 6, meleeOnly: true }],
  [10588, { percent: 20, meleeOnly: true }],
  [12017, { percent: 100 / 6, meleeOnly: false }],
  [12018, { percent: 20, meleeOnly: false }],
]);

let BonusManager;

function component(childId) {
  return (EQUIPMENT_STATS_INTERFACE_ID << 16) | childId;
}

function formatSigned(value) {
  const number = Math.trunc(Number(value) || 0);
  return number < 0 ? `${number}` : `+${number}`;
}

function formatMagicDamage(value) {
  const number = Number(value) || 0;
  return `${number < 0 ? "" : "+"}${number.toFixed(1)}%`;
}

function formatTargetBonus(bonus) {
  const percent = Math.trunc(bonus?.percent || 0);
  if (percent === 0) return "+0%";
  return `+${percent}% (${bonus.meleeOnly ? "melee" : "all styles"})`;
}

function getTargetBonuses(player) {
  const equipment = player.getEquipment().getItems();
  const amuletId = equipment[Equipment.AMULET_SLOT]?.getId?.() ?? -1;
  const head = equipment[Equipment.HEAD_SLOT];
  const headName = head?.getId?.() > 0
    ? head.getDefinition().getName().toLowerCase()
    : "";
  const slayerItem = headName.includes("slayer helmet") || headName.includes("black mask");

  return {
    undead: SALVE_AMULETS.get(amuletId),
    slayer: slayerItem
      ? { percent: 100 / 6, meleeOnly: !headName.includes("(i)") }
      : undefined,
  };
}

function getWeight(player) {
  let weight = 0;
  for (const item of [
    ...player.getInventory().getItems(),
    ...player.getEquipment().getItems(),
  ]) {
    if (item?.getId?.() > 0 && item.getAmount?.() > 0) {
      weight += Number(item.getDefinition().getWeight()) || 0;
    }
  }
  return weight;
}

function render(player) {
  const sender = player.getPacketSender();
  const bonuses = player.getBonusManager();
  const attack = bonuses.getAttackBonus();
  const defence = bonuses.getDefenceBonus();
  const other = bonuses.getOtherBonus();

  for (let i = 0; i < ATTACK_CHILDREN.length; i++) {
    sender.sendString(`${ATTACK_LABELS[i]}: ${formatSigned(attack[i])}`, component(ATTACK_CHILDREN[i]));
    sender.sendString(`${DEFENCE_LABELS[i]}: ${formatSigned(defence[i])}`, component(DEFENCE_CHILDREN[i]));
  }
  for (let i = 0; i < OTHER_CHILDREN.length; i++) {
    const value = i === 2 ? formatMagicDamage(other[i]) : formatSigned(other[i]);
    sender.sendString(`${OTHER_LABELS[i]}: ${value}`, component(OTHER_CHILDREN[i]));
  }

  const target = getTargetBonuses(player);
  sender.sendString(`Undead: ${formatTargetBonus(target.undead)}`, component(41));
  sender.sendString(`Slayer: ${formatTargetBonus(target.slayer)}`, component(42));

  const weapon = player.getWeapon?.();
  const fallbackSpeed = typeof weapon?.getSpeed === "function" ? weapon.getSpeed() : 4;
  const baseSpeed = WeaponProfiles.attackSpeed(player, fallbackSpeed);
  const actualSpeed = player.getBaseAttackSpeed();
  sender.sendString(`Base: ${(baseSpeed * 0.6).toFixed(1)}s`, component(53));
  sender.sendString(`Actual: ${(actualSpeed * 0.6).toFixed(1)}s`, component(54));
  sender.sendString(`${getWeight(player).toFixed(1)} kg`, component(51));
}

function update(player) {
  BonusManager.update(player);
  render(player);
}

function open(player) {
  if (player.busy?.()) {
    player.getPacketSender().sendInterfaceRemoval();
  }

  player.setInterfaceId(EQUIPMENT_STATS_INTERFACE_ID);
  player.setAttribute(EquipPacketListener.PRESERVE_INTERFACE_ON_EQUIP_ATTRIBUTE, EQUIPMENT_STATS_INTERFACE_ID);
  player
    .getPacketSender()
    .sendVarbit(12393, 1)
    .sendSubInterface(MAIN_MODAL_TARGET_UID, EQUIPMENT_STATS_INTERFACE_ID, 0)
    .sendSubInterface(SIDE_MODAL_TARGET_UID, EQUIPMENT_SIDE_INTERFACE_ID, 3)
    .sendInterfaceFlagsRange(EQUIPMENT_SIDE_INTERFACE_ID << 16, 0, 27, 1180674)
    .sendInterfaceScript(149, [EQUIPMENT_SIDE_INTERFACE_ID << 16, INVENTORY_ID, 4, 7, 1, -1, "Equip", "", "", "", ""])
    .sendInterfaceScript(151, [EQUIPMENT_SIDE_INTERFACE_ID << 16, INVENTORY_ID, 4, 7, 1, -1, "Equip", "", "", "", "", "", "", "", ""]);
  update(player);
  return true;
}

function handleItemAction({ player, buttonId, action, itemId, slot }) {
  if (player.getInterfaceId?.() !== EQUIPMENT_STATS_INTERFACE_ID) return false;

  if (buttonId === EQUIPMENT_SIDE_ITEMS_COMPONENT) {
    const item = player.getInventory().getItems()[slot];
    if (!item || item.getId() !== itemId) return true;
    if (action === 1) {
      EquipPacketListener.equip(player, itemId, slot, Inventory.INTERFACE_ID);
    } else if (action === 10) {
      const definition = item.getDefinition();
      player.getPacketSender().sendMessage(definition.getExamine() || definition.getName());
    }
    return true;
  }

  const equipmentSlot = EQUIPMENT_SLOT_BY_COMPONENT.get(buttonId);
  if (equipmentSlot === undefined) return false;
  const item = player.getEquipment().getItems()[equipmentSlot];
  if (!item || item.getId() <= 0) return true;
  if (action === 1) {
    EquipPacketListener.unequip(player, equipmentSlot);
  } else if (action === 10) {
    const definition = item.getDefinition();
    player.getPacketSender().sendMessage(definition.getExamine() || definition.getName());
  }
  return true;
}

module.exports = {
  name: "EquipmentStats",
  register(api) {
    BonusManager = api.getBonusManager();
    api.onInterfaceActionButton(OPEN_EQUIPMENT_STATS_BUTTON, ({ player }) => open(player));
    api.onInterfaceActionButton(
      [EQUIPMENT_SIDE_ITEMS_COMPONENT, ...EQUIPMENT_SLOT_BY_COMPONENT.keys()],
      handleItemAction,
    );
    api.onPlayerProcess(({ player }) => {
      if (player.getInterfaceId?.() === EQUIPMENT_STATS_INTERFACE_ID) {
        update(player);
      }
    });
  },
};
