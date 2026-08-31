const path = require("path");
const { JsonPlayerPersistence } = require("./JsonPlayerPersistence.plugin");
const {
  HANDOFF_DIRECTORY,
  isBrowserHost,
} = require("./IndexedDbPersistenceHandoff");

/**
 * WebContainer Node has no IndexedDB. HostPage hydrates and syncs this directory
 * with browser IndexedDB before, during, and after a browser-hosted world runs.
 */
class IndexedDbPlayerPersistence extends JsonPlayerPersistence {
  static HANDOFF_DIRECTORY = HANDOFF_DIRECTORY;
  static SAVE_DIRECTORY = path.join(process.cwd(), HANDOFF_DIRECTORY);

  resolveFilePath(username) {
    return path.join(
      IndexedDbPlayerPersistence.SAVE_DIRECTORY,
      `${this.normalizeUsername(username)}.json`
    );
  }
}

module.exports = {
  name: "IndexedDbPlayerPersistence",
  dependsOn: ["JsonPlayerPersistence"],
  register(api) {
    if (!isBrowserHost()) {
      return;
    }
    api.setPlayerPersistence(new IndexedDbPlayerPersistence());
    api.log("registered", {
      handoffDirectory: IndexedDbPlayerPersistence.HANDOFF_DIRECTORY,
    });
  },
  IndexedDbPlayerPersistence,
};
