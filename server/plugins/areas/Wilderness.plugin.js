const { Wilderness } = require("../../src/main/typescript/elvarg/game/content/wilderness/Wilderness");
const { Obelisks } = require("../../src/main/typescript/elvarg/game/content/Obelisks");
const { PlayerRights } = require("../../src/main/typescript/elvarg/game/model/rights/PlayerRights");
const { Location } = require("../../src/main/typescript/elvarg/game/model/Location");
const { isSafeLocation: isFeroxSafeLocation } = require("../items/LootKeys.plugin");

// ---------------------------------------------------------------------------
// pvp_icons overlay (OSRS interface 90)
// ---------------------------------------------------------------------------

// Mounted permanently like every other gameframe overlay. Cache script 386 lays out and
// colours the skull, level, range and multi-combat icon; script 388 fills the Wilderness
// level and combat range from the player's coordinates and combat-level varbit.
const PVP_ICONS_TARGET_UID = (161 << 16) | 3; // component.toplevel_osrs_stretch:pvp_icons
const PVP_ICONS_INTERFACE = 90;
// pvp_icons:icons_dodger, the block's outermost container. Deliberately not its child
// icons (90:44): cache script 386 re-runs on a timer and unhides 90:44 every time, so a
// hide sent there is undone within a tick. Nothing in the cache touches 90:43, and the
// client skips a subtree whose ancestor is hidden.
const PVP_ICONS_UID = (90 << 16) | 43;
const PVPW_SAFE_UID = (90 << 16) | 47;
const PVP_LEVEL_UID = (90 << 16) | 50;
const VARP_MAP_FLAGS_CACHED = 3717;
const MAP_FLAGS_REGULAR_WILDERNESS = 0;
const VARBIT_IN_WILDERNESS = 5963;
const PVP_LAYOUT_SCRIPT = 386;
const PVP_LEVEL_SCRIPT = 388;
// ponytail: the client has no "gameframe ready" packet, so the login mount is simply
// retried a few ticks later; raise this if it still loses the race on slow clients.
const MOUNT_RETRY_TICKS = 3;

// ---------------------------------------------------------------------------
// Combat rules
// ---------------------------------------------------------------------------

// OSRS: in the Wilderness you may attack anyone whose combat level is within the
// wilderness level of your tile, and theirs. Deeper wilderness on one side alone does
// not widen the range, so the usable range is the lower of the two levels.
const TELEPORT_BLOCK_LEVEL = 20;
// Combat level is derived from seven skills on every call, and target selection asks for
// it once per candidate per tick. Memoising for a tick turns that from O(players^2)
// recomputes into O(players), while staying fresh enough to notice a level up.
const COMBAT_LEVEL_TTL_MS = 600;
const combatLevels = new WeakMap();
// Derived levels only change when the player moves, so they are cached against the tile.
const derivedLevels = new WeakMap();
// The attack loop re-checks permission twice a cycle, and splash targeting checks every
// nearby candidate, so denial messages are throttled per player rather than per check.
const DENY_MESSAGE_INTERVAL_MS = 1200;
const denyMessageBlockedUntil = new WeakMap();
const LEVEL_DIFFERENCE_MESSAGES = [
  "Your level difference is too great.",
  "You need to move deeper into the Wilderness.",
];
const CLAN_CHAT_MESSAGES = ["You cannot attack a player who is in your clan chat."];

function combatLevelOf(player) {
  const cached = combatLevels.get(player);
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return cached.level;
  }
  const level = player?.getSkillManager?.()?.getCombatLevel?.() | 0;
  combatLevels.set(player, { level, expiresAt: now + COMBAT_LEVEL_TTL_MS });
  return level;
}

function wildernessLevelOf(player) {
  const location = player?.getLocation?.();
  if (isFeroxSafeLocation(location)) {
    return 0;
  }
  const stored = player?.getWildernessLevel?.() | 0;
  if (stored > 0) {
    return stored;
  }
  // World only emits the player-process hook for real players, so a bot's stored level is
  // always 0. Deriving it from the tile keeps the rule honest for anyone core forgets to
  // update - otherwise the pair looks unlevelled and the level range is never applied.
  if (!location) {
    return 0;
  }
  const x = location.getX();
  const y = location.getY();
  const cached = derivedLevels.get(player);
  if (cached && cached.x === x && cached.y === y) {
    return cached.level;
  }
  const level = Wilderness.isInLocation(location)
    ? Math.max(0, Wilderness.levelForY(y))
    : 0;
  derivedLevels.set(player, { x, y, level });
  return level;
}

function isWildernessLocation(location) {
  return Wilderness.isInLocation(location) && !isFeroxSafeLocation(location);
}

/**
 * Combat level range shared by two players, i.e. the largest level difference that still
 * allows an attack. 0 means the pair isn't subject to the rule - one of them is outside
 * the levelled Wilderness, and whether they may fight at all is decided elsewhere.
 */
function wildernessAttackRange(attacker, target) {
  return Math.min(wildernessLevelOf(attacker), wildernessLevelOf(target));
}

/**
 * The OSRS level-range rule on its own. Exported so bot target selection can skip
 * unattackable candidates before spending a tick pathing towards them.
 */
function canAttackByWildernessLevel(attacker, target) {
  const range = wildernessAttackRange(attacker, target);
  if (range <= 0) {
    return true;
  }
  return Math.abs(combatLevelOf(attacker) - combatLevelOf(target)) <= range;
}

function denyAttack(event, messages) {
  event.allow = false;
  sendThrottled(event.attacker, messages);
}

function sendThrottled(player, messages) {
  if (!player || player?.isPlayerBot?.() === true) {
    return;
  }
  const now = Date.now();
  if (now < (denyMessageBlockedUntil.get(player) ?? 0)) {
    return;
  }
  denyMessageBlockedUntil.set(player, now + DENY_MESSAGE_INTERVAL_MS);
  const sender = player.getPacketSender?.();
  for (const message of messages) {
    sender?.sendMessage?.(message);
  }
}

function shareClanChat(attacker, target) {
  if (!attacker || !target || attacker === target) {
    return false;
  }
  const attackerClan = attacker.getCurrentClanChat?.();
  const targetClan = target.getCurrentClanChat?.();
  return attackerClan != null && attackerClan === targetClan;
}

// ---------------------------------------------------------------------------
// Location tracking
// ---------------------------------------------------------------------------

function createState() {
  return {
    // player -> { x, y, z, inWilderness }, doubles as the tile cache for attack checks
    tiles: new Map(),
    // player -> ticks left before the login mount is re-sent
    pendingMount: new Map(),
  };
}

function readPlayerTile(player) {
  const location = player?.getLocation?.();
  const tile = Location.readTile(location);
  if (!location || !tile) {
    return null;
  }
  return { location, ...tile };
}

function isInWilderness(state, player) {
  if (!player) {
    return false;
  }
  if (wildernessLevelOf(player) > 0) {
    return true;
  }
  const cached = state.tiles.get(player);
  const tile = readPlayerTile(player);
  if (tile && Location.isSameTile(cached, tile) && typeof cached?.inWilderness === "boolean") {
    return cached.inWilderness;
  }
  if (!tile && cached && typeof cached.inWilderness === "boolean") {
    return cached.inWilderness;
  }
  const inWilderness = tile
    ? isWildernessLocation(tile.location)
    : Wilderness.isIn(player) && !isFeroxSafeLocation(player?.getLocation?.());
  state.tiles.set(player, { ...cached, ...(tile ?? {}), inWilderness });
  return inWilderness;
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

const lastIconsVisible = new WeakMap();
const lastWildernessState = new WeakMap();
const lastPvpLayoutState = new WeakMap();
const lastSafeBadgeVisible = new WeakMap();

function mountPvpIcons(player) {
  if (!player || player?.isPlayerBot?.() === true) {
    return;
  }
  const sender = player.getPacketSender();
  // Bit 2 marks a PvP world, where script 387 adds 15 to the attack range. Keep it clear
  // so a normal world uses combat level +/- Wilderness level.
  sender.sendConfig(VARP_MAP_FLAGS_CACHED, MAP_FLAGS_REGULAR_WILDERNESS);
  sender.sendSubInterface(PVP_ICONS_TARGET_UID, PVP_ICONS_INTERFACE, 1);
  // The cache leaves this badge visible by default. It is only valid inside Ferox.
  sender.sendInterfaceDisplayState(PVPW_SAFE_UID, true);
  // A fresh mount resets the group's widgets to their cache defaults.
  lastIconsVisible.delete(player);
  lastSafeBadgeVisible.delete(player);
  syncPvpIcons(player, isFeroxSafeLocation(player.getLocation?.()));
  syncSafeBadge(player, isFeroxSafeLocation(player.getLocation?.()));

  const tile = readPlayerTile(player);
  if (tile && isWildernessLocation(tile.location)) {
    syncPvpLayout(player, tile, true);
  }
}

// Nothing outside the wilderness is wired up yet (skull timer, attack style, PvP worlds),
// so the server keeps the whole block hidden unless the player has a wilderness level.
// Driven off the level itself rather than an entry/exit edge: every tick reconverges, so a
// teleport, a login or a missed transition can't strand the block on screen.
function syncPvpIcons(player, inSafeZone = isFeroxSafeLocation(player?.getLocation?.())) {
  if (!player || player?.isPlayerBot?.() === true) {
    return;
  }
  const visible = inSafeZone || (player.getWildernessLevel?.() | 0) > 0;
  if (lastIconsVisible.get(player) === visible) {
    return;
  }
  lastIconsVisible.set(player, visible);
  player.getPacketSender().sendInterfaceDisplayState(PVP_ICONS_UID, !visible);
}

function syncSafeBadge(player, inSafeZone) {
  if (!player || player?.isPlayerBot?.() === true || lastSafeBadgeVisible.get(player) === inSafeZone) {
    return;
  }
  lastSafeBadgeVisible.set(player, inSafeZone);
  player.getPacketSender().sendInterfaceDisplayState(PVPW_SAFE_UID, !inSafeZone);
}

function syncWildernessState(player, inWilderness) {
  const value = inWilderness ? 1 : 0;
  if (lastWildernessState.get(player) === value) {
    return;
  }
  lastWildernessState.set(player, value);
  player.getPacketSender().sendVarbit(VARBIT_IN_WILDERNESS, value);
}

function syncPvpLayout(player, tile, force = false) {
  const wildernessLevel = Wilderness.levelForY(tile.y);
  const combatLevel = combatLevelOf(player);
  const multiIcon = Wilderness.isMulti(tile.x, tile.y) ? 1 : 0;
  const state = `${wildernessLevel}:${combatLevel}:${multiIcon}`;
  if (!force && lastPvpLayoutState.get(player) === state) {
    return;
  }
  lastPvpLayoutState.set(player, state);

  // The webclient supplies the missing enhanced-client range row after script 386 runs.
  // Script 388 then fills both rows using normal-world Wilderness range rules.
  const sender = player.getPacketSender();
  sender.sendClientScript(PVP_LAYOUT_SCRIPT);
  sender.sendClientScript(PVP_LEVEL_SCRIPT, PVP_LEVEL_UID);
}

function refreshWildernessUi(player, tile, inWilderness) {
  if (!player || player?.isPlayerBot?.() === true || !tile) {
    return;
  }

  const inSafeZone = isFeroxSafeLocation(tile.location);
  syncPvpIcons(player, inSafeZone);
  syncSafeBadge(player, inSafeZone);

  if (inWilderness) {
    syncWildernessState(player, true);
    player.getPacketSender().sendInteractionOption("Attack", 2, true);

    const level = Wilderness.levelForY(tile.y);
    if (player.getWildernessLevel() !== level) {
      player.setWildernessLevel(level);
    }

    const multiIcon = Wilderness.isMulti(tile.x, tile.y) ? 1 : 0;
    if (player.getMultiIcon() !== multiIcon) {
      player.setMultiIcon(multiIcon);
    }
    syncPvpLayout(player, tile);
    return;
  }

  syncWildernessState(player, false);
  lastPvpLayoutState.delete(player);
  player.getPacketSender().sendInteractionOption("null", 2, true);

  if (player.getWildernessLevel() !== 0) {
    player.setWildernessLevel(0);
  }
  if (player.getMultiIcon() !== 0) {
    player.setMultiIcon(0);
  }
}

// ---------------------------------------------------------------------------
// Hook handlers
// ---------------------------------------------------------------------------

// World only emits this for real players - bots never reach any of it, which is why the
// combat rules derive a level from the tile instead of trusting the stored one.
function onPlayerProcess(state, player) {
  retryPendingMount(state, player);

  const tile = readPlayerTile(player);
  if (!tile) {
    return;
  }
  const previous = state.tiles.get(player);
  if (Location.isSameTile(previous, tile) && typeof previous.inWilderness === "boolean") {
    const inSafeZone = isFeroxSafeLocation(tile.location);
    syncPvpIcons(player, inSafeZone);
    syncSafeBadge(player, inSafeZone);
    if (previous.inWilderness) {
      syncPvpLayout(player, tile);
    }
    return;
  }

  const inWilderness = isWildernessLocation(tile.location);
  const wasInWilderness = previous?.inWilderness === true;

  if (inWilderness) {
    enterWilderness(player, tile, wasInWilderness);
  } else {
    leaveWilderness(player, tile, wasInWilderness);
  }

  state.tiles.set(player, {
    ...previous,
    x: tile.x,
    y: tile.y,
    z: tile.z,
    inWilderness,
  });
}

function enterWilderness(player, tile, wasInWilderness) {
  // Reassert wilderness UI while moving in wild; other interface/setup packets can clear
  // the attack option after entry. This also stores the level and multi icon.
  refreshWildernessUi(player, tile, true);
  if (!wasInWilderness) {
    // Covers a login that lost the race with the client's gameframe bootstrap.
    mountPvpIcons(player);
  }
}

function leaveWilderness(player, tile, wasInWilderness) {
  if (wasInWilderness) {
    refreshWildernessUi(player, tile, false);
    return;
  }

  if (player.getWildernessLevel() !== 0) {
    player.setWildernessLevel(0);
  }
  if (player.getMultiIcon() !== 0) {
    player.setMultiIcon(0);
  }
  syncWildernessState(player, false);
  lastPvpLayoutState.delete(player);
}

function retryPendingMount(state, player) {
  const retryIn = state.pendingMount.get(player);
  if (retryIn === undefined) {
    return;
  }
  if (retryIn > 0) {
    state.pendingMount.set(player, retryIn - 1);
    return;
  }
  state.pendingMount.delete(player);
  mountPvpIcons(player);
}

function onPlayerLogin(state, player) {
  if (player?.isPlayerBot?.() === true) {
    return;
  }
  // The mount is sent twice: now, and again once the client has had time to build its
  // gameframe - a login inside the wilderness otherwise shows no overlay at all.
  state.pendingMount.set(player, MOUNT_RETRY_TICKS);

  const tile = readPlayerTile(player);
  if (!tile) {
    return;
  }
  const inWilderness = isWildernessLocation(tile.location);
  state.tiles.set(player, { x: tile.x, y: tile.y, z: tile.z, inWilderness });
  refreshWildernessUi(player, tile, inWilderness);
  mountPvpIcons(player);
}

function onPlayerDisconnect(state, player) {
  state.tiles.delete(player);
  state.pendingMount.delete(player);
  lastIconsVisible.delete(player);
  lastWildernessState.delete(player);
  lastPvpLayoutState.delete(player);
  lastSafeBadgeVisible.delete(player);
}

function onCanAttack(state, event) {
  if (event.allow !== null) {
    return;
  }
  const { attacker, target } = event;
  if (!attacker?.isPlayer?.() || !target?.isPlayer?.()) {
    return;
  }

  if (shareClanChat(attacker, target)) {
    denyAttack(event, CLAN_CHAT_MESSAGES);
    return;
  }

  const attackerInWild = isInWilderness(state, attacker);
  const targetInWild = isInWilderness(state, target);
  if (!attackerInWild || !targetInWild) {
    // One side in the Wilderness and one outside is never a fight; neither side in it is
    // somebody else's rule to make (duel arena, minigames).
    if (attackerInWild || targetInWild) {
      event.allow = false;
    }
    return;
  }

  if (!canAttackByWildernessLevel(attacker, target)) {
    denyAttack(event, LEVEL_DIFFERENCE_MESSAGES);
    return;
  }

  event.allow = true;
}

function onCanTeleport(state, event) {
  if (event.allow !== null) {
    return;
  }
  const { player } = event;
  if (!isInWilderness(state, player)) {
    return;
  }
  if (
    wildernessLevelOf(player) > TELEPORT_BLOCK_LEVEL &&
    player.getRights() !== PlayerRights.DEVELOPER
  ) {
    player
      .getPacketSender()
      .sendMessage("Teleport spells are blocked in this level of Wilderness.");
    player
      .getPacketSender()
      .sendMessage(
        `You must be below level ${TELEPORT_BLOCK_LEVEL} of Wilderness to use teleportation spells.`
      );
    event.allow = false;
  }
}

function onNpcAggressionTolerance(state, event) {
  if (event.override !== null) {
    return;
  }
  if (isInWilderness(state, event.player)) {
    event.override = true;
  }
}

function onObeliskClick(event) {
  if (!isWildernessLocation(event.player?.getLocation?.())) {
    return;
  }
  if (Obelisks.activate(event.objectId)) {
    event.handled = true;
  }
}

module.exports = {
  name: "Wilderness",
  register(api) {
    const state = createState();

    api.onPlayerProcess(({ player }) => onPlayerProcess(state, player));
    api.onPlayerLogin(({ player }) => onPlayerLogin(state, player));
    api.onPlayerDisconnect(({ player }) => onPlayerDisconnect(state, player));
    api.onCanAttack((event) => onCanAttack(state, event));
    api.onCanTeleport((event) => onCanTeleport(state, event));
    api.onNpcAggressionTolerance((event) => onNpcAggressionTolerance(state, event));
    api.onObjectFirstClick(Obelisks.OBELISK_IDS, onObeliskClick);

    api.log("registered");
  },
  // Shared with bot target selection so the rule has one home.
  canAttackByWildernessLevel,
  wildernessAttackRange,
};
