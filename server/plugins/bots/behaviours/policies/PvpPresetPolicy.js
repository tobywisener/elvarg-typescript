"use strict";

const { getPvpLoadout } = require("../pvp/PvpAssignment");

function applyPvpPreset(player, state, options = {}) {
  if (!player || player.isPlayerBot?.() !== true) {
    return false;
  }
  const combat = player.getCombat?.();
  if (combat?.getTarget?.() || combat?.getAttacker?.() || player.getCombatFollowing?.()) {
    return false;
  }
  const applyRandomGlobalPreset = options.applyRandomGlobalPreset;
  if (typeof applyRandomGlobalPreset !== "function") {
    return false;
  }
  const loadout = getPvpLoadout(state?.pvp?.loadoutId);
  const preset = applyRandomGlobalPreset(player, {
    presetNames: loadout?.presetNames ?? [],
  });
  if (!preset) {
    options.api?.log?.("bot_pvp_preset_failed", {
      username: player.getUsername?.(),
      loadoutId: state?.pvp?.loadoutId ?? "edge_main_melee",
    });
    return false;
  }
  options.api?.log?.("bot_pvp_preset_loaded", {
    username: player.getUsername?.(),
    preset: preset.getName?.() ?? "unknown",
    loadoutId: state?.pvp?.loadoutId ?? "edge_main_melee",
  });
  return true;
}

module.exports = {
  applyPvpPreset,
};
