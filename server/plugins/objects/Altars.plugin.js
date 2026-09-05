const { Animation } = require("../../src/main/typescript/elvarg/game/model/Animation");
const { Skill } = require("../../src/main/typescript/elvarg/game/model/Skill");
const { MagicSpellbook } = require("../../src/main/typescript/elvarg/game/model/MagicSpellbook");
const { Sound } = require("../../src/main/typescript/elvarg/game/Sound");
const { Sounds } = require("../../src/main/typescript/elvarg/game/Sounds");
const { ObjectIds } = require("../../src/main/typescript/elvarg/util/IdEnums");

const PRAY_AT_ALTAR_ANIMATION = new Animation(645);
const ANCIENT_ALTAR_SOUND =
  Sounds.resolveKnownSound("PRAYERON") ?? Sound.TELEPORT;

// The client transforms the occult altar to match the active spellbook. Its
// first "Venerate" option therefore selects the spellbook omitted by the
// named options on that variant.
const OCCULT_ALTAR_SPELLBOOKS = new Map([
  [ObjectIds.ALTAR_OF_THE_OCCULT, [MagicSpellbook.NORMAL, MagicSpellbook.ANCIENT, MagicSpellbook.LUNAR, MagicSpellbook.ARCEUUS]],
  [ObjectIds.ALTAR_OF_THE_OCCULT_2, [MagicSpellbook.ANCIENT, MagicSpellbook.NORMAL, MagicSpellbook.LUNAR, MagicSpellbook.ARCEUUS]],
  [ObjectIds.ALTAR_OF_THE_OCCULT_3, [MagicSpellbook.LUNAR, MagicSpellbook.NORMAL, MagicSpellbook.ANCIENT, MagicSpellbook.ARCEUUS]],
  [ObjectIds.ALTAR_OF_THE_OCCULT_4, [MagicSpellbook.ARCEUUS, MagicSpellbook.NORMAL, MagicSpellbook.ANCIENT, MagicSpellbook.LUNAR]],
]);

function handleAncientAltar(player) {
  player.performAnimation(PRAY_AT_ALTAR_ANIMATION);
  Sounds.sendSound(player, ANCIENT_ALTAR_SOUND);
  MagicSpellbook.changeSpellbook(
    player,
    player.getSpellbook() === MagicSpellbook.ANCIENT
      ? MagicSpellbook.NORMAL
      : MagicSpellbook.ANCIENT
  );
  return true;
}

function handlePrayerAltar(player) {
  const skillManager = player.getSkillManager();
  const currentPrayer = skillManager.getCurrentLevel(Skill.PRAYER);
  const maxPrayer = skillManager.getMaxLevel(Skill.PRAYER);
  if (currentPrayer >= maxPrayer) {
    player.getPacketSender().sendMessage("You already have full Prayer points.");
    return true;
  }

  player.performAnimation(PRAY_AT_ALTAR_ANIMATION);
  Sounds.sendSound(player, Sound.PRAYER_RECHARGE);
  skillManager.setCurrentLevels(Skill.PRAYER, maxPrayer);
  skillManager.updateSkill(Skill.PRAYER);
  player.getPacketSender().sendMessage("You recharge your Prayer points.");
  return true;
}

function handleOccultAltar(player, spellbook) {
  player.performAnimation(PRAY_AT_ALTAR_ANIMATION);
  Sounds.sendSound(player, ANCIENT_ALTAR_SOUND);
  MagicSpellbook.changeSpellbook(player, spellbook);
  return true;
}

module.exports = {
  name: "Altars",
  register: (api) => {
    api.onObjectFirstClick(ObjectIds.ANCIENT_ALTAR, ({ player }) =>
      handleAncientAltar(player)
    );

    api.onObjectFirstClick(ObjectIds.ALTAR, ({ player }) =>
      handlePrayerAltar(player)
    );

    for (let clickType = 1; clickType <= 4; clickType++) {
      api.onObjectClick([...OCCULT_ALTAR_SPELLBOOKS.keys()], clickType, ({ player, objectId }) => {
        const spellbook = OCCULT_ALTAR_SPELLBOOKS.get(objectId)?.[clickType - 1];
        return spellbook ? handleOccultAltar(player, spellbook) : false;
      });
    }
  },
};
