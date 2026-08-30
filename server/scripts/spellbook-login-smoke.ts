// The gameframe bootstrap mounts the magic tab (161:82 -> 218) directly, and that mount
// carries no spellbook varbit - the cache scripts then draw the standard book for
// everyone. sendTabInterface(6, ...) is the only sender of varbit 4070, so login has to
// go through it or an Ancient/Lunar/Arceuus player logs in looking like a normal mage.
// Usage: TS_NODE_COMPILER_OPTIONS='{"target":"es2020"}' yarn ts-node ./scripts/spellbook-login-smoke.ts
import { strict as assert } from "assert";
import { PacketSender } from "../src/main/typescript/elvarg/net/packet/PacketSender";
import { MagicSpellbook } from "../src/main/typescript/elvarg/game/model/MagicSpellbook";
import { encodeGameframeBootstrap } from "../src/main/typescript/elvarg/net/protocol/ClientProtocol";

const VARBIT_PACKET_ID = 42;
const VARBIT_SPELLBOOK = 4070;
const VARBIT_APE_ATOLL_TELEPORT = 1914;
const VARBIT_FREMENNIK_HARD_DIARY = 4533;
const VARBIT_BONES_TO_PEACHES_UNLOCK = 1505;
const VARBIT_BONES_TO_PEACHES = 4554;
const VARBIT_KOUREND_CASTLE_TELEPORT = 5619;
const VARBIT_CIVITAS_ILLA_FORTIS_TELEPORT = 9649;
const VARBIT_BOAT_TELEPORTS = 18314;
const MAGIC_TAB_UID = (161 << 16) | 82;
const MAGIC_TAB_GROUP = 218;

/** Every varbit id/value pair in a captured packet stream. */
function varbits(packets: Buffer[]): Array<{ id: number; value: number }> {
    const found: Array<{ id: number; value: number }> = [];
    for (const packet of packets) {
        if (packet.length >= 7 && packet[0] === VARBIT_PACKET_ID) {
            found.push({ id: packet.readUInt16BE(1), value: packet.readInt32BE(3) });
        }
    }
    return found;
}

function sendTab(book: MagicSpellbook): Buffer[] {
    const packets: Buffer[] = [];
    const sender = new PacketSender({
        getSession: () => ({
            sendClientPacket: (packet: Buffer) => {
                packets.push(packet);
                return true;
            },
            write: () => undefined,
        }),
    });
    sender.sendTabInterface(6, book.getInterfaceId());
    return packets;
}

function spellbookVarbit(book: MagicSpellbook): number | undefined {
    return varbits(sendTab(book)).find((v) => v.id === VARBIT_SPELLBOOK)?.value;
}

// Each book must publish its own varbit value; OSRS: 0 normal, 1 ancient, 2 lunar, 3 arceuus.
assert.equal(spellbookVarbit(MagicSpellbook.NORMAL), 0, "normal spellbook");
assert.equal(spellbookVarbit(MagicSpellbook.ANCIENT), 1, "ancient spellbook");
assert.equal(spellbookVarbit(MagicSpellbook.LUNAR), 2, "lunar spellbook");
assert.equal(spellbookVarbit(MagicSpellbook.ARCEUUS), 3, "arceuus spellbook");
console.log("  spellbook: every book publishes varbit 4070");

assert.equal(
    varbits(sendTab(MagicSpellbook.LUNAR)).find((v) => v.id === VARBIT_FREMENNIK_HARD_DIARY)?.value,
    1,
    "Lunar spellbook must unlock Tan Leather and Recharge Dragonstone without the Fremennik hard diary",
);
console.log("  spellbook: Fremennik hard-diary spells are unlocked");

assert.equal(
    varbits(sendTab(MagicSpellbook.NORMAL)).find((v) => v.id === VARBIT_APE_ATOLL_TELEPORT)?.value,
    50,
    "normal spellbook must unlock Ape Atoll Teleport without Recipe for Disaster",
);
console.log("  spellbook: quest-gated teleports are unlocked");

const normalVarbits = varbits(sendTab(MagicSpellbook.NORMAL));
for (const [id, value, label] of [
    [VARBIT_BONES_TO_PEACHES, 30, "Bones to Peaches"],
    [VARBIT_BONES_TO_PEACHES_UNLOCK, 1, "Bones to Peaches cache unlock"],
    [VARBIT_KOUREND_CASTLE_TELEPORT, 9, "Kourend Castle Teleport"],
    [VARBIT_CIVITAS_ILLA_FORTIS_TELEPORT, 127, "Civitas illa Fortis Teleport"],
    [VARBIT_BOAT_TELEPORTS, 6, "boat teleports"],
] as const) {
    assert.equal(normalVarbits.find((v) => v.id === id)?.value, value, `${label} unlock state`);
}
console.log("  spellbook: newer quest and activity-gated spells are unlocked");

// The tab call also has to mount the magic tab, otherwise login would need both calls.
const ancient = sendTab(MagicSpellbook.ANCIENT);
assert.ok(
    ancient.some((p) => p.includes(Buffer.from([
        (MAGIC_TAB_UID >>> 24) & 0xff, (MAGIC_TAB_UID >>> 16) & 0xff,
        (MAGIC_TAB_UID >>> 8) & 0xff, MAGIC_TAB_UID & 0xff,
        (MAGIC_TAB_GROUP >>> 8) & 0xff, MAGIC_TAB_GROUP & 0xff,
    ]))),
    "sendTabInterface(6) must mount 218 into 161:82",
);
console.log("  spellbook: the tab call mounts the magic tab itself");

// The reason login cannot rely on the bootstrap alone.
assert.ok(
    !varbits(encodeGameframeBootstrap("smoketest")).some((v) => v.id === VARBIT_SPELLBOOK),
    "bootstrap is not expected to carry the spellbook varbit - login must send the tab",
);
console.log("  spellbook: bootstrap alone carries no spellbook varbit");

console.log("spellbook login smoke ok");
