import { strict as assert } from "assert";
import * as path from "path";
const {
  HANDOFF_DIRECTORY,
  isBrowserHost,
} = require("../plugins/persistence/IndexedDbPersistenceHandoff");

assert.equal(isBrowserHost({ BROWSER_HOST: "1" }), true);
assert.equal(isBrowserHost({ BROWSER_HOST: "0" }), false);
assert.equal(
  path.join(process.cwd(), HANDOFF_DIRECTORY, "browser_host.json"),
  path.join(process.cwd(), "data", "saves", "indexeddb", "characters", "browser_host.json")
);

console.log("IndexedDB persistence handoff smoke test passed");
