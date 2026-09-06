// Combat and skilling share one experience rate; this checks the knob applies
// uniformly and that bad values are rejected rather than silently stored.
import { strict as assert } from "assert";
import { GameConstants } from "../src/main/typescript/elvarg/game/GameConstants";

const original = GameConstants.EXPERIENCE_MULTIPLIER;

try {
  assert.equal(original, 1, "default experience rate should be 1x, matching OSRS");

  GameConstants.setExperienceRate(2.5);
  assert.equal(GameConstants.EXPERIENCE_MULTIPLIER, 2.5);

  for (const invalid of [0, -1, NaN, Infinity]) {
    GameConstants.setExperienceRate(invalid);
    assert.equal(
      GameConstants.EXPERIENCE_MULTIPLIER,
      2.5,
      `setExperienceRate(${invalid}) should have been rejected`
    );
  }
} finally {
  GameConstants.EXPERIENCE_MULTIPLIER = original;
}

console.log("experience rates smoke test passed");
