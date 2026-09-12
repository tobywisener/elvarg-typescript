// Drives the Wilderness plugin's hooks with stub players: the pvp_icons overlay is
// mounted once and shown/hidden as the player crosses the ditch, and the OSRS wilderness
// level-range rule decides who may attack whom.
// Usage: TS_NODE_COMPILER_OPTIONS='{"target":"es2020"}' yarn ts-node ./scripts/wilderness-plugin-smoke.ts
import { strict as assert } from "assert";
import path = require("path");
import { CachePipeline } from "../src/main/typescript/elvarg/game/cache/CachePipeline";
import { Location } from "../src/main/typescript/elvarg/game/model/Location";
import { PacketSender } from "../src/main/typescript/elvarg/net/packet/PacketSender";

const Wilderness = require("../plugins/areas/Wilderness.plugin");
const { isVisibleRealPlayer } = require("../plugins/bots/behaviours/pvp/PvpTargetFilters");

const PVP_ICONS_TARGET_UID = (161 << 16) | 3;
const PVP_ICONS_UID = (90 << 16) | 43;
const PVPW_SAFE_UID = (90 << 16) | 47;
const PVP_LEVEL_UID = (90 << 16) | 50;
const VARP_MAP_FLAGS_CACHED = 3717;
const VARBIT_IN_WILDERNESS = 5963;
const VARBIT_MULTICOMBAT_AREA = 4605;

const IN_WILDERNESS = new Location(3100, 3600, 0);
const AT_THE_DITCH = new Location(3100, 3525, 0); // level 1 Wilderness
const MULTI_AT_THE_DITCH = new Location(3200, 3525, 0);
const OUTSIDE = new Location(3100, 3500, 0);
const FEROX_ENCLAVE = new Location(3140, 3630, 0);

let processPlayer: ((event: any) => void) | undefined;
let login: ((event: any) => void) | undefined;
let canAttack: ((event: any) => void) | undefined;

function register() {
    const api = new Proxy<any>({
        onPlayerProcess: (handler: any) => { processPlayer = handler; },
        onPlayerLogin: (handler: any) => { login = handler; },
        onCanAttack: (handler: any) => { canAttack = handler; },
    }, {
        get: (target, property) => target[property] ?? (() => undefined),
    });

    Wilderness.register(api);
    assert.ok(processPlayer && login && canAttack, "plugin must register its hooks");
}

function overlayFollowsTheDitch() {

    const sent: Array<{ call: string; args: any[] }> = [];
    let location = OUTSIDE;
    let wildernessLevel = 0;
    let multiIcon = 0;
    const sender = new Proxy<any>({
        sendSubInterface: (...args: any[]) => sent.push({ call: "sendSubInterface", args }),
        sendInterfaceDisplayState: (...args: any[]) => sent.push({ call: "sendInterfaceDisplayState", args }),
        sendConfig: (...args: any[]) => sent.push({ call: "sendConfig", args }),
        sendClientScript: (...args: any[]) => sent.push({ call: "sendClientScript", args }),
        sendVarbit: (...args: any[]) => sent.push({ call: "sendVarbit", args }),
    }, {
        get: (target, property) => target[property] ?? (() => sender),
    });
    const player = {
        getLocation: () => location,
        getPacketSender: () => sender,
        getWildernessLevel: () => wildernessLevel,
        setWildernessLevel: (level: number) => { wildernessLevel = level; },
        getMultiIcon: () => multiIcon,
        setMultiIcon: (icon: number) => { multiIcon = icon; },
        getSkillManager: () => ({ getCombatLevel: () => 73 }),
    };

    // Only the resulting state matters; the entry re-mount re-sends the same value.
    const hidden = () => {
        const events = sent.filter((s) => s.call === "sendInterfaceDisplayState"
            && s.args[0] === PVP_ICONS_UID);
        assert.ok(events.length > 0, "expected the icon block visibility to be sent");
        return events[events.length - 1].args[1];
    };
    const mounts = () => sent.filter((s) => s.call === "sendSubInterface"
        && s.args[0] === PVP_ICONS_TARGET_UID).length;

    // Login outside the wilderness: mounted, block hidden.
    login!({ player });
    assert.equal(mounts(), 1, "login must mount the pvp_icons overlay");
    assert.equal(hidden(), true, "login outside the wilderness must hide the icon block");
    assert.ok(sent.some((s) => s.call === "sendConfig"
        && s.args[0] === VARP_MAP_FLAGS_CACHED && s.args[1] === 0),
    "the cache must use normal Wilderness combat ranges");
    assert.ok(sent.some((s) => s.call === "sendVarbit"
        && s.args[0] === VARBIT_IN_WILDERNESS && s.args[1] === 0));

    // The login mount is retried a few ticks later; keep ticking until it lands.
    sent.length = 0;
    for (let i = 0; i < 6; i++) processPlayer!({ player });
    assert.equal(mounts(), 1, "the queued re-mount must fire exactly once");
    assert.equal(hidden(), true, "the re-mount must keep the block hidden outside the wilderness");

    // Step into the wilderness. Visibility reconverges from the wilderness level, so the
    // tick that sets the level is followed by the tick that sends the state.
    sent.length = 0;
    location = AT_THE_DITCH;
    processPlayer!({ player });
    processPlayer!({ player });
    assert.equal(hidden(), false, "entering the wilderness must show the icon block");
    assert.equal(wildernessLevel, 1, "the ditch must be level 1 Wilderness");
    assert.ok(sent.some((s) => s.call === "sendClientScript" && s.args[0] === 386),
        "OSRS script 386 must position and colour the Wilderness HUD");
    assert.ok(sent.some((s) => s.call === "sendClientScript"
        && s.args[0] === 388 && s.args[1] === PVP_LEVEL_UID),
    "OSRS script 388 must populate the level and combat range");
    assert.ok(sent.some((s) => s.call === "sendVarbit"
        && s.args[0] === VARBIT_IN_WILDERNESS && s.args[1] === 1));

    location = MULTI_AT_THE_DITCH;
    processPlayer!({ player });
    assert.equal(multiIcon, 1, "entering a multi-combat tile must enable the icon");

    // Step back out.
    sent.length = 0;
    location = OUTSIDE;
    processPlayer!({ player });
    processPlayer!({ player });
    assert.equal(hidden(), true, "leaving the wilderness must hide the icon block");
    assert.equal(wildernessLevel, 0, "leaving the wilderness must clear the wilderness level");
    assert.equal(multiIcon, 0, "leaving the wilderness must clear the multi-combat icon");

    // OpenRune models Ferox as an area excluded from its normal wilderness area. The
    // same tile must clear the wilderness state here while retaining the OSRS safe badge.
    sent.length = 0;
    location = FEROX_ENCLAVE;
    processPlayer!({ player });
    processPlayer!({ player });
    assert.equal(hidden(), false, "Ferox must retain the PvP HUD for its safe-zone label");
    const safeBadge = sent.filter((s) => s.call === "sendInterfaceDisplayState"
        && s.args[0] === PVPW_SAFE_UID).at(-1);
    assert.equal(safeBadge?.args[1], false, "Ferox must show the safe-zone label");
    assert.equal(wildernessLevel, 0, "Ferox must not retain a wilderness level");

    console.log("  overlay: mounted once, hidden outside the wilderness");
}

function multiIconUsesTheWebclientVarbit() {
    const packets: Buffer[] = [];
    const sender = new PacketSender({
        getSession: () => ({
            sendClientPacket: (packet: Buffer) => {
                packets.push(packet);
                return true;
            },
        }),
    });

    sender.sendMultiIcon(1);
    assert.equal(packets.length, 1);
    assert.equal(packets[0][0], 42, "multi icon must use the webclient VARBIT packet");
    assert.equal(packets[0].readUInt16BE(1), VARBIT_MULTICOMBAT_AREA);
    assert.equal(packets[0].readInt32BE(3), 1);

    console.log("  multi: OSRS multi-combat varbit sent");
}

/**
 * Stub player. `wilderness` is the level the server has stored for it; `at` overrides the
 * tile it stands on, which is how a bot looks - in the Wilderness with no stored level.
 */
function fighter(combatLevel: number, wilderness: number, at?: any) {
    const messages: string[] = [];
    return {
        messages,
        isPlayer: () => true,
        getWildernessLevel: () => wilderness,
        getSkillManager: () => ({ getCombatLevel: () => combatLevel }),
        getCurrentClanChat: () => null,
        getLocation: () => at ?? (wilderness > 0 ? IN_WILDERNESS : OUTSIDE),
        getPacketSender: () => ({ sendMessage: (text: string) => messages.push(text) }),
    };
}

function decide(attacker: any, target: any): boolean | null {
    const event = { attacker, target, allow: null as boolean | null };
    canAttack!(event);
    return event.allow;
}

function levelRangeIsEnforced() {
    // Level 20 Wilderness: 20 combat levels either way.
    assert.equal(decide(fighter(100, 20), fighter(120, 20)), true, "120 is within 20 of 100");
    assert.equal(decide(fighter(100, 20), fighter(121, 20)), false, "121 is out of range");

    // The shallower side sets the range: level 5 for one, 30 for the other.
    assert.equal(decide(fighter(100, 5), fighter(104, 30)), true, "4 levels apart at wilderness 5");
    assert.equal(decide(fighter(100, 5), fighter(110, 30)), false, "10 levels apart at wilderness 5");

    // A denied attacker is told why.
    const attacker = fighter(100, 5);
    assert.equal(decide(attacker, fighter(126, 5)), false, "126 is out of range at wilderness 5");
    assert.deepEqual(
        attacker.messages,
        ["Your level difference is too great.", "You need to move deeper into the Wilderness."],
        "the attacker must be told the level difference is too great",
    );

    // Bots never run the player-process hook, so their stored level stays 0: the rule has
    // to fall back to the tile or a maxed player could farm low-level bots at the ditch.
    assert.equal(
        decide(fighter(126, 1), fighter(58, 0, AT_THE_DITCH)),
        false,
        "a level 58 bot at the ditch is out of range for a level 126",
    );
    assert.equal(
        decide(fighter(59, 1), fighter(58, 0, AT_THE_DITCH)),
        true,
        "one level apart is still fair game at wilderness level 1",
    );

    // Outside the Wilderness the plugin only vetoes half-in fights.
    assert.equal(decide(fighter(100, 0), fighter(100, 20)), false, "attacking into the Wilderness");
    assert.equal(decide(fighter(100, 20), fighter(100, 0)), false, "attacking out of the Wilderness");
    assert.equal(decide(fighter(100, 0), fighter(100, 0)), null, "outside, someone else decides");

    // Same rule, as bot target selection sees it.
    assert.equal(Wilderness.canAttackByWildernessLevel(fighter(100, 20), fighter(115, 20)), true);
    assert.equal(Wilderness.canAttackByWildernessLevel(fighter(100, 20), fighter(130, 20)), false);
    assert.equal(
        Wilderness.canAttackByWildernessLevel(fighter(100, 0), fighter(130, 0)),
        true,
        "outside the Wilderness the level rule does not apply",
    );

    console.log("  combat: OSRS wilderness level range enforced");
}

function botsSkipUnattackableTargets() {
    const bot = (combatLevel: number, wilderness: number) => ({
        ...fighter(combatLevel, wilderness),
        isPlayerBot: () => false,
        isRegistered: () => true,
        getHitpoints: () => 10,
        getPrivateArea: () => null,
    });
    const source = bot(100, 10);
    assert.equal(isVisibleRealPlayer(source, bot(105, 10)), true, "in range: worth engaging");
    assert.equal(isVisibleRealPlayer(source, bot(130, 10)), false, "out of range: skipped");

    console.log("  bots: out-of-range candidates filtered before pathing");
}

async function main() {
    await CachePipeline.initialize(path.resolve(__dirname, ".."));
    register();
    overlayFollowsTheDitch();
    multiIconUsesTheWebclientVarbit();
    levelRangeIsEnforced();
    botsSkipUnattackableTargets();
    console.log("wilderness plugin ok");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
