const { Skill } = require("../../src/main/typescript/elvarg/game/model/Skill");
const { Item } = require("../../src/main/typescript/elvarg/game/model/Item");
const { Graphic } = require("../../src/main/typescript/elvarg/game/model/Graphic");
const { Animation } = require("../../src/main/typescript/elvarg/game/model/Animation");
const { Location } = require("../../src/main/typescript/elvarg/game/model/Location");
const { TeleportHandler } = require("../../src/main/typescript/elvarg/game/model/teleportation/TeleportHandler");
const { Sound } = require("../../src/main/typescript/elvarg/game/Sound");
const { Sounds } = require("../../src/main/typescript/elvarg/game/Sounds");
const { ItemIds, ObjectIds } = require("../../src/main/typescript/elvarg/util/IdEnums");

const CRAFT_RUNES_GRAPHIC = new Graphic(186);
const CRAFT_RUNES_ANIMATION = new Animation(791);
let pluginApi;

// Rune altars share the same name and action; IDs distinguish their rune types.
const RUNES_BY_ALTAR_ID = new Map([
  [ObjectIds.ALTAR_33, { runeId: ItemIds.AIR_RUNE, level: 1, xp: 5, pureOnly: false, multiplier: [[11, 2], [22, 3], [33, 4], [44, 5], [55, 6], [66, 7], [77, 8], [88, 9], [99, 10]] }],
  [ObjectIds.ALTAR_34, { runeId: ItemIds.MIND_RUNE, level: 2, xp: 6, pureOnly: false, multiplier: [[14, 2], [28, 3], [42, 4], [56, 5], [70, 6], [84, 7], [98, 8]] }],
  [ObjectIds.ALTAR_35, { runeId: ItemIds.WATER_RUNE, level: 5, xp: 7, pureOnly: false, multiplier: [[19, 2], [38, 3], [57, 4], [76, 5], [95, 6]] }],
  [ObjectIds.ALTAR_36, { runeId: ItemIds.EARTH_RUNE, level: 9, xp: 8, pureOnly: false, multiplier: [[26, 2], [52, 3], [78, 4]] }],
  [ObjectIds.ALTAR_37, { runeId: ItemIds.FIRE_RUNE, level: 14, xp: 9, pureOnly: false, multiplier: [[35, 2], [70, 3]] }],
  [ObjectIds.ALTAR_38, { runeId: ItemIds.BODY_RUNE, level: 20, xp: 10, pureOnly: false, multiplier: [[46, 2], [92, 3]] }],
  [ObjectIds.ALTAR_39, { runeId: ItemIds.COSMIC_RUNE, level: 27, xp: 11, pureOnly: true, multiplier: [[59, 2]] }],
  [ObjectIds.ALTAR_55, { runeId: ItemIds.CHAOS_RUNE, level: 35, xp: 12, pureOnly: true, multiplier: [[74, 2]] }],
  [ObjectIds.ALTAR_57, { runeId: ItemIds.ASTRAL_RUNE, level: 40, xp: 13, pureOnly: true, multiplier: [[82, 2]] }],
  [ObjectIds.ALTAR_46, { runeId: ItemIds.NATURE_RUNE, level: 44, xp: 14, pureOnly: true, multiplier: [[91, 2]] }],
  [ObjectIds.ALTAR_40, { runeId: ItemIds.LAW_RUNE, level: 54, xp: 15, pureOnly: true, multiplier: [] }],
  [ObjectIds.ALTAR_56, { runeId: ItemIds.DEATH_RUNE, level: 65, xp: 16, pureOnly: true, multiplier: [] }],
  [ObjectIds.BLOOD_ALTAR, { runeId: ItemIds.BLOOD_RUNE, level: 75, xp: 27, pureOnly: true, multiplier: [] }],
]);

RUNES_BY_ALTAR_ID.set(ObjectIds.ALTAR_83, RUNES_BY_ALTAR_ID.get(ObjectIds.BLOOD_ALTAR));

const TALISMANS = new Map([
  [ItemIds.AIR_TALISMAN, { level: 1, x: 2841, y: 4828 }],
  [ItemIds.MIND_TALISMAN, { level: 2, x: 2793, y: 4827 }],
  [ItemIds.WATER_TALISMAN, { level: 5, x: 2720, y: 4831 }],
  [ItemIds.EARTH_TALISMAN, { level: 9, x: 2655, y: 4829 }],
  [ItemIds.FIRE_TALISMAN, { level: 14, x: 2576, y: 4846 }],
  [ItemIds.BODY_TALISMAN, { level: 20, x: 2522, y: 4833 }],
  [ItemIds.COSMIC_TALISMAN, { level: 27, x: 2163, y: 4833 }],
  [ItemIds.CHAOS_TALISMAN, { level: 35, x: 2282, y: 4837 }],
  [ItemIds.NATURE_TALISMAN, { level: 44, x: 2400, y: 4834 }],
  [ItemIds.LAW_TALISMAN, { level: 54, x: 2464, y: 4817 }],
  [ItemIds.DEATH_TALISMAN, { level: 65, x: 2208, y: 4829 }],
  [1450, { level: 77, x: 1722, y: 3826 }],
]);

const POUCH_ACTIONS = new Map([
  [ItemIds.SMALL_POUCH, { level: 1, capacity: 3, decayChance: -1 }],
  [ItemIds.MEDIUM_POUCH, { level: 25, capacity: 6, decayChance: 45 }],
  [ItemIds.LARGE_POUCH, { level: 50, capacity: 9, decayChance: 29 }],
  [ItemIds.GIANT_POUCH, { level: 75, capacity: 12, decayChance: 10 }],
]);

function runeMultiplier(level, runeData) {
  let amount = 1;
  for (const [requiredLevel, multiplier] of runeData.multiplier) {
    if (level >= requiredLevel) {
      amount = multiplier;
    }
  }
  return amount;
}

function ensurePouchArray(player) {
  const existing = player.getPouches?.();
  const containers = Array.isArray(existing) ? existing : [];

  const byItemId = new Map();
  for (const container of containers) {
    const pouchId = container?.pouch?.itemId ?? container?.pouch?.id ?? -1;
    if (Number.isInteger(pouchId)) {
      byItemId.set(pouchId, container);
    }
  }

  const normalized = [];
  for (const [itemId, def] of POUCH_ACTIONS) {
    const raw = byItemId.get(itemId);
    normalized.push({
      pouch: {
        itemId,
        requiredLevel: def.level,
        capacity: def.capacity,
        decayChance: def.decayChance,
      },
      runeEssenceAmt: Math.max(0, Number(raw?.runeEssenceAmt || 0)),
      pureEssenceAmt: Math.max(0, Number(raw?.pureEssenceAmt || 0)),
    });
  }

  player.setPouches?.(normalized);
  return normalized;
}

function storePouch(player, container) {
  if (container.runeEssenceAmt + container.pureEssenceAmt >= container.pouch.capacity) {
    player.getPacketSender().sendMessage("Your pouch is already full.");
    return true;
  }

  if (
    player.getSkillManager().getMaxLevel(Skill.RUNECRAFTING) <
    container.pouch.requiredLevel
  ) {
    player
      .getPacketSender()
      .sendMessage(
        `You need a Runecrafting level of at least ${container.pouch.requiredLevel} to use this.`
      );
    return true;
  }

  for (
    let i = container.runeEssenceAmt + container.pureEssenceAmt;
    i < container.pouch.capacity;
    i++
  ) {
    if (player.getInventory().contains(ItemIds.PURE_ESSENCE)) {
      player.getInventory().deleteNumber(ItemIds.PURE_ESSENCE, 1);
      container.pureEssenceAmt++;
    } else if (player.getInventory().contains(ItemIds.RUNE_ESSENCE)) {
      player.getInventory().deleteNumber(ItemIds.RUNE_ESSENCE, 1);
      container.runeEssenceAmt++;
    } else {
      player
        .getPacketSender()
        .sendMessage("You don't have any more essence to store.");
      break;
    }
  }
  return true;
}

function checkPouch(player, container) {
  const label =
    container.pouch.itemId === ItemIds.SMALL_POUCH
      ? "small pouch"
      : container.pouch.itemId === ItemIds.MEDIUM_POUCH
        ? "medium pouch"
        : container.pouch.itemId === ItemIds.LARGE_POUCH
          ? "large pouch"
          : "giant pouch";
  player
    .getPacketSender()
    .sendMessage(
      `Your ${label} contains ${container.runeEssenceAmt} Rune essence and ${container.pureEssenceAmt} Pure essence.`
    );
  return true;
}

function withdrawPouch(player, container) {
  const total = container.runeEssenceAmt + container.pureEssenceAmt;
  if (total <= 0) {
    player.getPacketSender().sendMessage("Your pouch is already empty.");
    return true;
  }

  for (let i = 0; i < total; i++) {
    if (player.getInventory().isFull()) {
      player.getInventory().full();
      break;
    }
    if (container.pureEssenceAmt > 0) {
      player.getInventory().adds(ItemIds.PURE_ESSENCE, 1);
      container.pureEssenceAmt--;
    } else if (container.runeEssenceAmt > 0) {
      player.getInventory().adds(ItemIds.RUNE_ESSENCE, 1);
      container.runeEssenceAmt--;
    } else {
      break;
    }
  }
  return true;
}

function handlePouchAction(player, itemId, clickType) {
  if (!POUCH_ACTIONS.has(itemId)) {
    return false;
  }

  const pouches = ensurePouchArray(player);
  const container = pouches.find((entry) => entry?.pouch?.itemId === itemId);
  if (!container) {
    return false;
  }

  if (clickType === 1) {
    return storePouch(player, container);
  }
  if (clickType === 2) {
    return checkPouch(player, container);
  }
  if (clickType === 3) {
    return withdrawPouch(player, container);
  }
  return false;
}

function handleCraftRunes(event) {
  const runeData = RUNES_BY_ALTAR_ID.get(event.objectId);
  if (!runeData) {
    return false;
  }

  const player = event.player;
  const level = player.getSkillManager().getCurrentLevel(Skill.RUNECRAFTING);
  if (level < runeData.level) {
    player
      .getPacketSender()
      .sendMessage(
        `You need a Runecrafting level of at least ${runeData.level} to craft this.`
      );
    event.handled = true;
    return;
  }

  const essenceId = runeData.pureOnly
    ? ItemIds.PURE_ESSENCE
    : player.getInventory().contains(ItemIds.RUNE_ESSENCE)
      ? ItemIds.RUNE_ESSENCE
      : player.getInventory().contains(ItemIds.PURE_ESSENCE)
        ? ItemIds.PURE_ESSENCE
        : -1;

  if (essenceId === -1) {
    player
      .getPacketSender()
      .sendMessage(
        runeData.pureOnly
          ? "You need Pure essence to craft runes using this altar."
          : "You don't have any essence in your inventory."
      );
    event.handled = true;
    return;
  }

  const amountPerEssence = runeMultiplier(level, runeData);
  let craftedEssence = 0;
  while (player.getInventory().contains(essenceId)) {
    player.getInventory().deleteNumber(essenceId, 1);
    player.getInventory().addItem(new Item(runeData.runeId, amountPerEssence));
    craftedEssence++;
  }

  if (craftedEssence > 0) {
    player.performGraphic(CRAFT_RUNES_GRAPHIC);
    player.performAnimation(CRAFT_RUNES_ANIMATION);
    Sounds.sendSound(player, Sound.CRAFT_RUNES);
    Sounds.sendSound(player, Sound.RUNECRAFTING);
    player
      .getSkillManager()
      .addExperiences(Skill.RUNECRAFTING, craftedEssence * runeData.xp);
    pluginApi.emitCustomEvent("runecrafting:success", { player, skill: Skill.RUNECRAFTING });
  }

  event.handled = true;
}

module.exports = {
  name: "Runecrafting",
  register(api) {
    pluginApi = api;
    api.onObjectInteraction("Altar", { "Craft-rune": handleCraftRunes });
    api.onObjectInteraction("Blood Altar", { Bind: handleCraftRunes });

    api.onItemAction((event) => {
      const { player, itemId, clickType } = event;

      if (handlePouchAction(player, itemId, clickType)) {
        event.handled = true;
        return;
      }

      if (clickType !== 2) {
        return;
      }

      const talisman = TALISMANS.get(itemId);
      if (!talisman) {
        return;
      }

      const level = player.getSkillManager().getMaxLevel(Skill.RUNECRAFTING);
      if (level < talisman.level) {
        player
          .getPacketSender()
          .sendMessage(
            `You need a Runecrafting level of at least ${talisman.level} to use this Talisman's teleport function.`
          );
        event.handled = true;
        return;
      }

      const destination = new Location(talisman.x, talisman.y);
      if (TeleportHandler.checkReqs(player, destination)) {
        TeleportHandler.teleport(
          player,
          destination,
          player.getSpellbook().getTeleportType(),
          true
        );
      }
      event.handled = true;
    });

    api.log("registered", {
      altars: RUNES_BY_ALTAR_ID.size,
      talismans: TALISMANS.size,
      pouches: POUCH_ACTIONS.size,
    });
  },
};
