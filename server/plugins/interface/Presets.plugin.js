const { GameConstants } = require("../../src/main/typescript/elvarg/game/GameConstants");
const { CacheDefinitions } = require("../../src/main/typescript/elvarg/game/cache/CacheDefinitions");
const { PrayerData } = require("../../src/main/typescript/elvarg/game/content/PrayerHandler");
const { CombatSpecial } = require("../../src/main/typescript/elvarg/game/content/combat/CombatSpecial");
const { CombatSpells } = require("../../src/main/typescript/elvarg/game/content/combat/magic/CombatSpells");
const { Autocasting } = require("../../src/main/typescript/elvarg/game/content/combat/magic/Autocasting");
const { Presetable } = require("../../src/main/typescript/elvarg/game/content/presets/Presetable");
const { PredefinedPresets } = require("../../src/main/typescript/elvarg/game/content/presets/PredefinedPresets");
const { PlayerSave } = require("../../src/main/typescript/elvarg/game/entity/impl/player/persistence/PlayerSave");
const { Wilderness } = require("../../src/main/typescript/elvarg/game/content/wilderness/Wilderness");
const { Item } = require("../../src/main/typescript/elvarg/game/model/Item");
const { Skill } = require("../../src/main/typescript/elvarg/game/model/Skill");
const { Flag } = require("../../src/main/typescript/elvarg/game/model/Flag");
const { Bank } = require("../../src/main/typescript/elvarg/game/model/container/impl/Bank");
const { Task } = require("../../src/main/typescript/elvarg/game/task/Task");
const { Misc } = require("../../src/main/typescript/elvarg/util/Misc");
const {
  GROUP_ID,
  COMPONENT,
  PRESET_ROW_START,
  PRESET_ROW_COUNT,
  GLOBAL_ROW_COUNT,
  CUSTOM_ROW_COUNT,
  INVENTORY_SLOT_START,
  INVENTORY_SLOT_COUNT,
  EQUIPMENT_SLOT_START,
  EQUIPMENT_PLACEHOLDER_START,
  EQUIPMENT_SLOTS,
  STAT_ROW_START,
  STAT_MAX_ROW_START,
  LIST_CONTENT_HEIGHT,
  uid,
  buildPresetsWidgetGroup,
} = require("./presetsWidget");
const {
  isPresetActive,
  hasPresetSnapshot,
  clearPresetState,
  commitPresetState,
  markPresetActiveWithSnapshot,
  restorePresetSnapshot,
  initPresetsStateCoreAccess,
} = require("./PresetsState");

const MAX_PRESETS = CUSTOM_ROW_COUNT;
const MAIN_MODAL_UID = (161 << 16) | 16;
const OPEN_PRESETS_DELAY_TICKS = 2;

const INTERFACE_DEFINITION = {
  ...buildPresetsWidgetGroup(),
  // The preset column scrolls: there are more presets than fit, and adding one should not
  // mean rearranging the interface.
  scroll: [
    {
      viewComponent: COMPONENT.LIST_VIEW,
      scrollbarComponent: COMPONENT.LIST_SCROLLBAR,
      contentHeight: LIST_CONTENT_HEIGHT,
    },
  ],
};

const STAT_LABELS = ["Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic"];
// One list: the predefined presets, then the player's own slots.
const GLOBAL_ROW_UIDS = Array.from({ length: GLOBAL_ROW_COUNT }, (_, row) =>
  uid(PRESET_ROW_START + row)
);
const CUSTOM_ROW_UIDS = Array.from({ length: CUSTOM_ROW_COUNT }, (_, row) =>
  uid(PRESET_ROW_START + GLOBAL_ROW_COUNT + row)
);
const PRESET_BUTTON_UIDS = [
  uid(COMPONENT.LOAD_BUTTON),
  uid(COMPONENT.SAVE_BUTTON),
  uid(COMPONENT.CLEAR_BUTTON),
  uid(COMPONENT.DEATH_BUTTON),
  ...GLOBAL_ROW_UIDS,
  ...CUSTOM_ROW_UIDS,
];

const COMBAT_SKILLS = [
  Skill.ATTACK,
  Skill.DEFENCE,
  Skill.STRENGTH,
  Skill.HITPOINTS,
  Skill.RANGED,
  Skill.PRAYER,
  Skill.MAGIC,
];

const GLOBAL_PRESETS = [
  PredefinedPresets.G_MAULER_70,
  PredefinedPresets.OBBY_MAULER_57,
  PredefinedPresets.DDS_PURE_M_73,
  PredefinedPresets.DDS_PURE_R_73,
  PredefinedPresets.NH_PURE_83,
  PredefinedPresets.ATT_60_ZERKER_94,
  PredefinedPresets.ATT_70_ZERKER_97,
  PredefinedPresets.MAIN_RUNE_126,
  PredefinedPresets.MAIN_MELEE_126,
  PredefinedPresets.MAIN_RCB_TANK_126,
  PredefinedPresets.MAIN_RCB_TANK_70,
  PredefinedPresets.DHAROK_126,
  PredefinedPresets.MAIN_BARRAGE_126,
  PredefinedPresets.VOID_RANGER_126,
  PredefinedPresets.VOID_MELEE_126,
  PredefinedPresets.KARILS_TANK_126,
  PredefinedPresets.MAIN_HYBRID_126,
  PredefinedPresets.MAIN_TRIBRID_126,
];

function getGlobalPresetPool() {
  return GLOBAL_PRESETS.filter((preset) => preset != null);
}

function getGlobalPresetByName(name) {
  if (typeof name !== "string" || name.length === 0) {
    return null;
  }
  const target = name.trim().toLowerCase();
  for (const preset of getGlobalPresetPool()) {
    const presetName = preset?.getName?.();
    if (typeof presetName === "string" && presetName.trim().toLowerCase() === target) {
      return preset;
    }
  }
  return null;
}

function resolvePresetPool(options = {}) {
  const presetNames = Array.isArray(options?.presetNames)
    ? options.presetNames.filter((value) => typeof value === "string" && value.length > 0)
    : [];
  if (presetNames.length === 0) {
    return getGlobalPresetPool();
  }
  const resolved = presetNames
    .map((presetName) => getGlobalPresetByName(presetName))
    .filter((preset) => preset != null);
  return resolved.length > 0 ? resolved : getGlobalPresetPool();
}

function pickRandomGlobalPresetFromPool(options = {}) {
  const pool = resolvePresetPool(options);
  if (pool.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
}

function isPlayerBot(player) {
  return Boolean(player?.isPlayerBot?.());
}

function isPresetInterfaceOpen(player) {
  return player?.getInterfaceId?.() === GROUP_ID;
}

/**
 * Equipment slot for an item, straight from the cache. ItemDefinition.equipmentType is
 * never populated in this port - getEquipmentType().getSlot() returns -1 for every item -
 * so the cache's wearPos is the only working source.
 */
function equipmentSlotOf(itemId) {
  const wearPos = CacheDefinitions.getItem(itemId)?.wearPos;
  return EQUIPMENT_SLOTS.includes(wearPos) ? wearPos : -1;
}

function isValidItem(item) {
  return (
    item &&
    typeof item.getId === "function" &&
    typeof item.getAmount === "function" &&
    item.getId() > 0 &&
    item.getAmount() > 0
  );
}

function cloneItem(item) {
  if (!isValidItem(item)) {
    return null;
  }
  return typeof item.clone === "function"
    ? item.clone()
    : new Item(item.getId(), item.getAmount());
}

function isSpawnable(itemId) {
  const allowed = GameConstants.ALLOWED_SPAWNS;
  if (allowed?.has) {
    return allowed.has(itemId);
  }
  if (Array.isArray(allowed)) {
    return allowed.includes(itemId);
  }
  return false;
}

function ensurePlayerPresets(player) {
  const existing = player?.getPresets?.();
  if (Array.isArray(existing) && existing.length >= MAX_PRESETS) {
    return existing;
  }

  const next = new Array(MAX_PRESETS).fill(null);
  if (Array.isArray(existing)) {
    for (let i = 0; i < Math.min(existing.length, MAX_PRESETS); i++) {
      next[i] = existing[i] ?? null;
    }
  }
  player?.setPresets?.(next);
  return next;
}

function captureCombatStats(player) {
  const skills = player.getSkillManager();
  return COMBAT_SKILLS.map((skill) => skills.getMaxLevel(skill));
}

function resolvePresetAutocastSpellId(preset) {
  const value =
    preset?.getAutocastSpellId?.() ??
    (Number.isInteger(preset?.autocastSpellId) ? preset.autocastSpellId : -1);
  return Number.isInteger(value) && value > 0 ? value : -1;
}

function applyPresetAutocastIfDefined(player, preset) {
  const autocastSpellId = resolvePresetAutocastSpellId(preset);
  if (autocastSpellId <= 0) {
    return;
  }

  try {
    const spell = CombatSpells.getCombatSpell(autocastSpellId);
    if (spell && spell.getSpellbook?.() === player.getSpellbook?.()) {
      Autocasting.setAutocast(player, spell);
    } else {
      Autocasting.setAutocast(player, null);
    }
  } catch (_error) {
    // Ignore invalid/missing spell ids for backwards compatibility with older saves.
    Autocasting.setAutocast(player, null);
  }
}

function getSpellbookDisplayName(spellbook) {
  const MagicSpellbook =
    require("../../src/main/typescript/elvarg/game/model/MagicSpellbook").MagicSpellbook;
  if (spellbook === MagicSpellbook.ANCIENT) {
    return "Ancient";
  }
  if (spellbook === MagicSpellbook.LUNAR) {
    return "Lunar";
  }
  if (spellbook === MagicSpellbook.ARCEUUS) {
    return "Arceuus";
  }
  if (spellbook === MagicSpellbook.NORMAL) {
    return "Normal";
  }
  return "Normal";
}

function shouldKeepPresetReversible(player) {
  if (!player) {
    return false;
  }
  if (isPlayerBot(player)) {
    return true;
  }
  return !Wilderness.isIn(player) && !player.getDueling().inDuel();
}

function isPresetBlockedInWilderness(player) {
  return Wilderness.isIn(player) && !isPlayerBot(player);
}

function commitPresetIfNeeded(player) {
  if (!player || isPlayerBot(player) || !isPresetActive(player)) {
    return false;
  }
  return commitPresetState(player);
}

function customPresets(player) {
  return ensurePlayerPresets(player);
}

function renderPresetLists(player) {
  const sender = player.getPacketSender();
  const pool = getGlobalPresetPool();
  const presets = customPresets(player);
  const selected = player.getCurrentPreset?.() ?? null;
  for (let row = 0; row < PRESET_ROW_COUNT; row++) {
    const custom = row >= GLOBAL_ROW_COUNT;
    const preset = custom ? presets[row - GLOBAL_ROW_COUNT] : pool[row];
    const name = preset?.getName?.();
    sender.sendString(
      name
        ? `<col=${preset === selected ? "ffffff" : "c5b79b"}>${name}</col>`
        : custom
          ? "<col=6f6355>Empty slot</col>"
          : "",
      uid(PRESET_ROW_START + row)
    );
  }
}

function renderButtons(player) {
  const sender = player.getPacketSender();
  const selected = player.getCurrentPreset?.() ?? null;
  const isCustom = selected != null && !selected.getIsGlobal?.();
  sender
    .sendString("Clear preset", uid(COMPONENT.CLEAR_BUTTON + 50))
    .sendString(
      player.isOpenPresetsOnDeath?.() ? "On death: <col=40ff40>on</col>" : "On death: <col=ff981f>off</col>",
      uid(COMPONENT.DEATH_BUTTON + 50)
    )
    .sendString("Load preset", uid(COMPONENT.LOAD_BUTTON + 50))
    .sendString(isCustom ? "Overwrite slot" : "Save current", uid(COMPONENT.SAVE_BUTTON + 50));
}

function renderSelectedPreset(player, preset) {
  const sender = player.getPacketSender();
  sender.sendString(preset?.getName?.() ?? "No preset selected", uid(COMPONENT.SELECTED_NAME));

  const stats = Array.isArray(preset?.getStats?.()) ? preset.getStats() : [];
  for (let index = 0; index < STAT_LABELS.length; index++) {
    const level = Number(stats[index]);
    const text = preset && Number.isFinite(level) ? String(Math.max(1, Math.floor(level))) : "";
    sender
      .sendString(text, uid(STAT_ROW_START + index))
      .sendString(text, uid(STAT_MAX_ROW_START + index));
  }
  sender.sendString(
    preset ? `Spellbook: <col=ffffff>${getSpellbookDisplayName(preset.getSpellbook())}</col>` : "",
    uid(COMPONENT.SPELLBOOK)
  );

  const inventory = Array.isArray(preset?.getInventory?.()) ? preset.getInventory() : [];
  for (let slot = 0; slot < INVENTORY_SLOT_COUNT; slot++) {
    const item = inventory[slot];
    sender.sendItemOnInterfaces(
      uid(INVENTORY_SLOT_START + slot),
      isValidItem(item) ? item.getId() : -1,
      isValidItem(item) ? item.getAmount() : 1
    );
  }

  for (const slot of EQUIPMENT_SLOTS) {
    sender.sendItemOnInterfaces(uid(EQUIPMENT_SLOT_START + slot), -1, 1);
    // An empty slot shows the cache's silhouette for that slot.
    sender.sendInterfaceDisplayState(uid(EQUIPMENT_PLACEHOLDER_START + slot), false);
  }
  const equipment = Array.isArray(preset?.getEquipment?.()) ? preset.getEquipment() : [];
  for (const item of equipment) {
    if (!isValidItem(item)) {
      continue;
    }
    const slot = equipmentSlotOf(item.getId());
    if (slot < 0) {
      continue;
    }
    sender.sendItemOnInterfaces(uid(EQUIPMENT_SLOT_START + slot), item.getId(), item.getAmount());
    sender.sendInterfaceDisplayState(uid(EQUIPMENT_PLACEHOLDER_START + slot), true);
  }
}

function selectPreset(player, preset) {
  player.setCurrentPreset(preset ?? null);
  renderPresetLists(player);
  renderSelectedPreset(player, preset ?? null);
  renderButtons(player);
}

function openPresetInterface(player, preset = null) {
  if (!player) {
    return false;
  }

  if (isPresetBlockedInWilderness(player)) {
    player.getPacketSender().sendMessage("You can't open presets in the wilderness!");
    return false;
  }

  const sender = player.getPacketSender();
  player.setInterfaceId(GROUP_ID);
  sender.sendSubInterface(MAIN_MODAL_UID, GROUP_ID, 0, {
    // Script 227 is the frame script with the standard close button - the same widget
    // every other interface uses, hover and pressed states included. Its op closes the
    // interface client-side and the client tells us via IF_CLOSE.
    postScripts: [{ scriptId: 227, args: [uid(COMPONENT.FRAME), "Presets"] }],
  });

  selectPreset(player, preset ?? null);
  return true;
}

function applyPreset(player, preset) {
  if (!player || !preset) {
    return false;
  }

  const sender = player.getPacketSender();

  if (isPresetInterfaceOpen(player)) {
    player.setInterfaceId(-1);
    sender.closeSubInterface(MAIN_MODAL_UID);
  }
  if (isPresetBlockedInWilderness(player)) {
    sender.sendMessage("You can't load a preset in the wilderness!");
    return false;
  }
  const alreadyPresetActive = isPresetActive(player) && hasPresetSnapshot(player);
  const prePresetSnapshot = alreadyPresetActive
    ? null
    : PlayerSave.fromPlayer(player);

  let movedToBank = false;
  const carriedItems = [
    ...player.getInventory().getCopiedItems(),
    ...player.getEquipment().getCopiedItems(),
  ];
  for (const item of carriedItems) {
    if (!isValidItem(item) || isSpawnable(item.getId())) {
      continue;
    }
    player.getBank(Bank.getTabForItem(player, item.getId())).add(item, false);
    movedToBank = true;
  }
  if (movedToBank) {
    sender.sendMessage(
      "The non-spawnable items you had on you have been sent to your bank."
    );
  }

  player.getInventory().resetItems().refreshItems();
  player.getEquipment().resetItems().refreshItems();

  if (!preset.getIsGlobal()) {
    const nonSpawnableRequirements = [];
    for (const item of [...(preset.getInventory() ?? []), ...(preset.getEquipment() ?? [])]) {
      if (!isValidItem(item) || isSpawnable(item.getId())) {
        continue;
      }
      nonSpawnableRequirements.push(item);

      const inventoryAmt = player.getInventory().getAmount(item.getId());
      const equipmentAmt = player.getEquipment().getAmount(item.getId());
      const bankAmt = player
        .getBank(Bank.getTabForItem(player, item.getId()))
        .getAmount(item.getId());
      const totalAmt = inventoryAmt + equipmentAmt + bankAmt;
      const presetAmt = preset.getAmount(item.getId());

      if (totalAmt < presetAmt) {
        sender.sendMessage(
          `You don't have the non-spawnable item ${item.getDefinition().getName()} in your inventory, equipment or bank.`
        );
        return false;
      }
    }

    for (const item of nonSpawnableRequirements) {
      if (player.getInventory().containsItem(item)) {
        player.getInventory().deletes(item);
      } else if (player.getEquipment().containsItem(item)) {
        player.getEquipment().deletes(item);
      } else {
        player
          .getBank(Bank.getTabForItem(player, item.getId()))
          .deletes(item);
      }
    }
  }

  for (const item of preset.getInventory() ?? []) {
    const next = cloneItem(item);
    if (!next) {
      continue;
    }
    player.getInventory().addItem(next);
  }

  for (const item of preset.getEquipment() ?? []) {
    const next = cloneItem(item);
    if (!next) {
      continue;
    }
    const slot = equipmentSlotOf(next.getId());
    if (slot < 0) {
      continue;
    }
    player.getEquipment().setItem(slot, next);
  }

  player.setSpellbook(preset.getSpellbook());
  applyPresetAutocastIfDefined(player, preset);

  let totalExp = 0;
  const presetStats = Array.isArray(preset.getStats()) ? preset.getStats() : [];
  for (let i = 0; i < COMBAT_SKILLS.length; i++) {
    const skill = COMBAT_SKILLS[i];
    const rawLevel = Number(presetStats[i]);
    const level = Number.isFinite(rawLevel) ? Math.max(1, Math.floor(rawLevel)) : 1;
    const exp = SkillManager.getExperienceForLevel(level);
    player
      .getSkillManager()
      .setCurrentLevels(skill, level)
      .setMaxLevel(skill, level)
      .setExperience(skill, exp);
    totalExp += exp;
  }

  sender.sendTabInterface(6, player.getSpellbook().getInterfaceId());
  sender.sendConfig(709, PrayerHandler.canUse(player, PrayerData.PRESERVE, false) ? 1 : 0);
  sender.sendConfig(711, PrayerHandler.canUse(player, PrayerData.RIGOUR, false) ? 1 : 0);
  sender.sendConfig(713, PrayerHandler.canUse(player, PrayerData.AUGURY, false) ? 1 : 0);

  player.resetAttributes();
  sender.sendMessage("Preset loaded!");
  sender.sendTotalExp(totalExp);

  player.setSpecialPercentage(100);
  CombatSpecial.updateBar(player);
  player.getUpdateFlag().flag(Flag.APPEARANCE);
  if (shouldKeepPresetReversible(player)) {
    markPresetActiveWithSnapshot(player, {
      snapshot: alreadyPresetActive ? undefined : prePresetSnapshot,
      setFlag: true,
    });
  } else {
    commitPresetState(player);
  }
  return true;
}

function applyRandomGlobalPreset(player, options = {}) {
  if (!player) {
    return null;
  }
  const preset = pickRandomGlobalPresetFromPool(options);
  if (!preset) {
    return null;
  }
  player.setCurrentPreset?.(preset);
  if (!applyPreset(player, preset)) {
    return null;
  }
  return preset;
}

/** Saves the player's current loadout into `index`, asking for a name first. */
function promptSavePreset(player, index) {
  player.setEnteredSyntaxAction({
    execute: (rawInput) => {
      const input = Misc.formatText(rawInput ?? "");
      if (!Misc.isValidName(input)) {
        player.getPacketSender().sendMessage("Invalid name for preset.");
        player.setCurrentPreset(null);
        openPresetInterface(player, null);
        return;
      }

      const presets = ensurePlayerPresets(player);
      const inventory = player.getInventory().copyValidItemsArray();
      const equipment = player.getEquipment().copyValidItemsArray();
      for (const item of [...inventory, ...equipment]) {
        if (item?.getDefinition?.()?.isNoted?.()) {
          player
            .getPacketSender()
            .sendMessage("You cannot create presets which contain noted items.");
          return;
        }
      }

      presets[index] = new Presetable(
        input,
        inventory,
        equipment,
        captureCombatStats(player),
        player.getSpellbook(),
        false,
        player.getCombat()?.getAutocastSpell?.()?.spellId?.() ?? -1
      );
      renderPresetLists(player);
      selectPreset(player, presets[index]);
    },
  });
  player
    .getPacketSender()
    .sendEnterInputPrompt("Enter a name for your preset below.");
}

function firstFreePresetSlot(player) {
  return customPresets(player).findIndex((preset) => preset == null);
}

function requireOpenInterface(player) {
  if (isPresetInterfaceOpen(player) || isPlayerBot(player)) {
    return true;
  }
  return false;
}

function handlePresetRowClick(player, buttonId) {
  if (!requireOpenInterface(player)) {
    return false;
  }

  const globalRow = GLOBAL_ROW_UIDS.indexOf(buttonId);
  if (globalRow >= 0) {
    const preset = getGlobalPresetPool()[globalRow] ?? null;
    if (!preset) {
      player.getPacketSender().sendMessage("That preset is currently unavailable.");
      return true;
    }
    selectPreset(player, preset);
    return true;
  }

  const customRow = CUSTOM_ROW_UIDS.indexOf(buttonId);
  if (customRow >= 0) {
    const preset = customPresets(player)[customRow] ?? null;
    if (preset) {
      selectPreset(player, preset);
    } else {
      promptSavePreset(player, customRow);
    }
    return true;
  }

  return false;
}

function handlePresetActionButton(player, buttonId) {
  if (!requireOpenInterface(player)) {
    return false;
  }

  switch (buttonId) {
    case uid(COMPONENT.DEATH_BUTTON):
      player.setOpenPresetsOnDeath(!player.isOpenPresetsOnDeath());
      renderButtons(player);
      return true;

    case uid(COMPONENT.LOAD_BUTTON): {
      const preset = player.getCurrentPreset();
      if (!preset) {
        player.getPacketSender().sendMessage("You haven't selected any preset yet.");
        return true;
      }
      applyPreset(player, preset);
      return true;
    }

    case uid(COMPONENT.SAVE_BUTTON): {
      // Saving over a selected custom preset edits it in place; otherwise it fills the
      // first free slot, which is the only way to create one.
      const selected = player.getCurrentPreset();
      const selectedIndex = selected ? customPresets(player).indexOf(selected) : -1;
      const index = selectedIndex >= 0 ? selectedIndex : firstFreePresetSlot(player);
      if (index < 0) {
        player
          .getPacketSender()
          .sendMessage(`You already have ${MAX_PRESETS} presets. Select one to overwrite it.`);
        return true;
      }
      promptSavePreset(player, index);
      return true;
    }

    case uid(COMPONENT.CLEAR_BUTTON): {
      if (!isPresetActive(player)) {
        player.getPacketSender().sendMessage("No active preset to clear.");
        return true;
      }
      if (restorePresetSnapshot(player, { preserveLocation: true })) {
        player
          .getPacketSender()
          .sendMessage("Preset cleared. Your original character state has been restored.");
        selectPreset(player, null);
      } else {
        player
          .getPacketSender()
          .sendMessage("Unable to clear preset: no preset snapshot was found.");
      }
      return true;
    }

    default:
      return handlePresetRowClick(player, buttonId);
  }
}

function isAtDefaultRespawn(player) {
  const location = player?.getLocation?.();
  const respawn = GameConstants.DEFAULT_LOCATION;
  if (!location || !respawn) {
    return false;
  }
  return (
    location.getX?.() === respawn.getX?.() &&
    location.getY?.() === respawn.getY?.() &&
    location.getZ?.() === respawn.getZ?.()
  );
}

function handlePresetTradeRestriction(player, target) {
  commitPresetIfNeeded(player);
  commitPresetIfNeeded(target);
  return false;
}

function handlePresetBankRestriction(player) {
  commitPresetIfNeeded(player);
  return false;
}

function handlePresetShopRestriction(player) {
  commitPresetIfNeeded(player);
  return false;
}

function applyPresetItemDropPolicy(event) {
  commitPresetIfNeeded(event.player);
}

let PrayerHandler;
let CombatFactory;
let SkillManager;
let TaskManager;

module.exports = {
  name: "Presets",
  applyPreset,
  applyRandomGlobalPreset,
  getGlobalPresetByName,
  getGlobalPresetPool,
  register(api) {
    PrayerHandler = api.getPrayerHandler();
    CombatFactory = api.getCombatFactory();
    SkillManager = api.getSkillManager();
    TaskManager = api.getTaskManager();
    initPresetsStateCoreAccess(api);
    api.onPlayerLogin(({ player }) => {
      if (isPresetActive(player) && !hasPresetSnapshot(player)) {
        clearPresetState(player);
      }
    });

    api.registerCustomInterface(INTERFACE_DEFINITION);

    // Presets are for everyone, not just staff.
    api.registerCommand("presets", ({ player }) => {
      if (player.busy?.()) {
        player.getPacketSender().sendInterfaceRemoval();
      }
      openPresetInterface(player, player.getCurrentPreset?.() ?? null);
      return true;
    });

    api.onInterfaceActionButton(PRESET_BUTTON_UIDS, ({ player, buttonId }) =>
      handlePresetActionButton(player, buttonId)
    );

    api.onCanTrade((event) => {
      if (handlePresetTradeRestriction(event.player, event.target)) {
        event.allow = false;
      }
    });

    api.onCanBank((event) => {
      if (handlePresetBankRestriction(event.player)) {
        event.allow = false;
      }
    });

    api.onCanShop((event) => {
      if (handlePresetShopRestriction(event.player)) {
        event.allow = false;
      }
    });

    api.onItemDropPolicy((event) => {
      applyPresetItemDropPolicy(event);
    });

    api.onShouldDropItemsOnDeath((event) => {
      commitPresetIfNeeded(event.player);
    });

    api.onPlayerDefeated(({ victim }) => {
      commitPresetIfNeeded(victim);
      const shouldOpenPresetInterface = victim.isOpenPresetsOnDeath?.() === true;
      if (!shouldOpenPresetInterface) {
        return;
      }

      TaskManager.submit(
        new (class extends Task {
          constructor() {
            super(OPEN_PRESETS_DELAY_TICKS, false);
          }

          execute() {
            this.stop();
            if (!victim || !victim.isRegistered?.() || victim.getHitpoints?.() <= 0) {
              return;
            }

            if (shouldOpenPresetInterface && isAtDefaultRespawn(victim)) {
              openPresetInterface(victim, victim.getCurrentPreset?.() ?? null);
            }
          }
        })()
      );
    });
  },
};
