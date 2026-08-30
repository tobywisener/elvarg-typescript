import { strict as assert } from "assert";
import { GameConstants } from "../src/main/typescript/elvarg/game/GameConstants";
const combat = GameConstants.COMBAT_SKILLS_EXP_MULTIPLIER;
const regular = GameConstants.REGULAR_SKILLS_EXP_MULTIPLIER;

try {
  GameConstants.setExperienceRates({ combat: 2.5, regular: 4 });
  assert.equal(GameConstants.COMBAT_SKILLS_EXP_MULTIPLIER, 2.5);
  assert.equal(GameConstants.REGULAR_SKILLS_EXP_MULTIPLIER, 4);

  GameConstants.setExperienceRates({ combat: Infinity, regular: 0 });
  assert.equal(GameConstants.COMBAT_SKILLS_EXP_MULTIPLIER, 2.5);
  assert.equal(GameConstants.REGULAR_SKILLS_EXP_MULTIPLIER, 4);
} finally {
  GameConstants.COMBAT_SKILLS_EXP_MULTIPLIER = combat;
  GameConstants.REGULAR_SKILLS_EXP_MULTIPLIER = regular;
}

console.log("experience rates smoke test passed");
