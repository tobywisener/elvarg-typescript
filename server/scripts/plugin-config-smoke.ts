import { strict as assert } from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PluginManager } from "../src/main/typescript/elvarg/plugins/PluginManager";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-config-smoke-"));
const originalCwd = process.cwd();
try {
  const dataDirectory = path.join(root, "data");
  const pluginDirectory = path.join(root, "plugins");
  fs.mkdirSync(dataDirectory);
  fs.mkdirSync(pluginDirectory);
  fs.writeFileSync(
    path.join(dataDirectory, "plugins.json"),
    JSON.stringify({ disabled: ["Disabled"] })
  );
  fs.writeFileSync(
    path.join(pluginDirectory, "Enabled.plugin.js"),
    'module.exports = { name: "Enabled", register() {} };'
  );
  fs.writeFileSync(
    path.join(pluginDirectory, "Disabled.plugin.js"),
    'module.exports = { name: "Disabled", register() { throw new Error("disabled plugin loaded"); } };'
  );

  process.chdir(root);
  PluginManager.loadFromDirectory(pluginDirectory);
  assert.deepEqual((PluginManager as any).loadedPlugins, ["Enabled"]);
} finally {
  process.chdir(originalCwd);
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("plugin config smoke test passed");
