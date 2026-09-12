const { Skill } = require("../../../src/main/typescript/elvarg/game/model/Skill");

let CombatFactory;

function applyDharokModifiers(entity, baseHit) {
  if (!entity || !CombatFactory.fullDharoks(entity)) return baseHit;
  const maximum = entity.isPlayer()
    ? entity.getAsPlayer().getSkillManager().getMaxLevel(Skill.HITPOINTS)
    : entity.getAsNpc().getDefinition().getHitpoints();
  const missing = Math.max(0, maximum - entity.getHitpoints());
  return baseHit * (1 + missing * maximum / 10000);
}

module.exports = function registerDharoksArmourEffects(api) {
  CombatFactory = api.getCombatFactory();
  api.registerMeleeHitModifier(applyDharokModifiers);
};
