const path = require("path");

const HANDOFF_DIRECTORY = path.join("data", "saves", "indexeddb", "characters");

function isBrowserHost(environment = process.env) {
  return environment.BROWSER_HOST === "1";
}

module.exports = { HANDOFF_DIRECTORY, isBrowserHost };
