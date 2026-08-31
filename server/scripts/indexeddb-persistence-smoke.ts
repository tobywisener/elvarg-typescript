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

const jsonPluginPath = require.resolve("../plugins/persistence/JsonPlayerPersistence.plugin");
const indexedDbPluginPath = require.resolve("../plugins/persistence/IndexedDbPlayerPersistence.plugin");
const cachedJsonPlugin = require.cache[jsonPluginPath];
delete require.cache[indexedDbPluginPath];
require.cache[jsonPluginPath] = { exports: { JsonPlayerPersistence: class {} } } as any;
try {
  const { IndexedDbPlayerPersistence } = require(indexedDbPluginPath);
  assert.equal(IndexedDbPlayerPersistence.HANDOFF_DIRECTORY, HANDOFF_DIRECTORY);
  assert.equal(
    IndexedDbPlayerPersistence.SAVE_DIRECTORY,
    path.join(process.cwd(), "data", "saves", "indexeddb", "characters")
  );
} finally {
  delete require.cache[indexedDbPluginPath];
  if (cachedJsonPlugin) require.cache[jsonPluginPath] = cachedJsonPlugin;
  else delete require.cache[jsonPluginPath];
}

console.log("IndexedDB persistence handoff smoke test passed");
