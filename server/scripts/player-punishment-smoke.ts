import { strict as assert } from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PlayerPunishment } from "../src/main/typescript/elvarg/util/PlayerPunishment";

const originalDirectory = process.cwd();
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "player-punishment-smoke-"));

try {
  process.chdir(directory);
  PlayerPunishment.init();

  assert.equal(PlayerPunishment.toggleBan("zezima"), true);
  assert.equal(PlayerPunishment.banned("Zezima"), true);
  assert.equal(PlayerPunishment.toggleBan("zezima"), false);
  assert.equal(PlayerPunishment.banned("Zezima"), false);

  assert.equal(PlayerPunishment.toggleMute("zezima"), true);
  assert.equal(PlayerPunishment.muted("Zezima"), true);
  assert.equal(PlayerPunishment.toggleMute("zezima"), false);
  assert.equal(PlayerPunishment.muted("Zezima"), false);
} finally {
  process.chdir(originalDirectory);
  fs.rmSync(directory, { recursive: true, force: true });
}

console.log("player punishment smoke test passed");
