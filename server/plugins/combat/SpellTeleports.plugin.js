const { CacheDefinitions } = require("../../src/main/typescript/elvarg/game/cache/CacheDefinitions");
const { SpellTeleports } = require("../../src/main/typescript/elvarg/game/content/combat/magic/SpellTeleports");

function spellName(event) {
  const itemId = event.itemId ?? -1;
  const packed = Number.isInteger(event.groupId) && Number.isInteger(event.childId)
    ? (event.groupId << 16) | (event.childId & 0xffff)
    : -1;
  return CacheDefinitions.getSpellName(event.buttonId, itemId)
    ?? CacheDefinitions.getSpellName(packed, itemId)
    ?? CacheDefinitions.getSpellName(event.childId ?? -1, itemId);
}

module.exports = {
  name: "SpellTeleports",
  register(api) {
    api.onInterfaceActionClick((event) => {
      if (SpellTeleports.handleSelf(event.player, spellName(event))) {
        event.handled = true;
      }
    });
  },
};
