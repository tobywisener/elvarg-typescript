import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");

const plugin = require("../plugins/commands/AdminCommands.plugin.js");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "npcanim-"));

try {
    const possibleFile = path.join(directory, "npc-animations.json");
    const combatFile = path.join(directory, "npc-combat-defs.json");
    fs.writeFileSync(possibleFile, JSON.stringify({
        1705: [3915, -1, 3916, 65535],
        1706: [3915, -1, 3916, 65535],
        1707: [3915, 3916, -1, 65535],
    }));
    fs.writeFileSync(combatFile, JSON.stringify({
        npcs: {
            1705: { anims: { attack: 3915 }, sounds: { death: 512 } },
        },
    }));

    assert.deepEqual(plugin._test.getNpcPossibleAnimations(1705, possibleFile), [3915, 3916]);
    assert.deepEqual(plugin._test.getNpcIdsWithSamePossibleAnimations(1705, possibleFile), [1705, 1706]);
    assert.equal(plugin._test.normalizeNpcAnimationProperty("specialAttack"), "specialAttack");
    assert.equal(plugin._test.normalizeNpcAnimationProperty("__proto__"), null);
    plugin._test.writeNpcCombatAnimations([1705, 1706], { block: 3916, spawn: 6871 }, combatFile, (id: number) => id === 1705 ? "Ravager" : "Ravager (variant)");
    assert.deepEqual(JSON.parse(fs.readFileSync(combatFile, "utf8")).npcs[1705], {
        name: "Ravager",
        anims: { attack: 3915, block: 3916, spawn: 6871 },
        sounds: { death: 512 },
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(combatFile, "utf8")).npcs[1706], {
        name: "Ravager (variant)",
        anims: { block: 3916, spawn: 6871 },
    });
    console.info("npc animation command persistence smoke passed");
} finally {
    fs.rmSync(directory, { recursive: true, force: true });
}
