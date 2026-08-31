import assert = require("node:assert/strict");
import { FightType } from "../src/main/typescript/elvarg/game/content/combat/FightType";
import { WeaponProfiles } from "../src/main/typescript/elvarg/game/content/combat/WeaponProfile";
import { WeaponInterfaces } from "../src/main/typescript/elvarg/game/content/combat/WeaponInterfaces";
import { RegionManager } from "../src/main/typescript/elvarg/game/collision/RegionManager";
import { CombatRange } from "../src/main/typescript/elvarg/game/content/combat/CombatRange";
import { CombatType } from "../src/main/typescript/elvarg/game/content/combat/CombatType";
import { World } from "../src/main/typescript/elvarg/game/World";
import { Location } from "../src/main/typescript/elvarg/game/model/Location";
import { MovementQueue } from "../src/main/typescript/elvarg/game/model/movement/MovementQueue";
import { PathFinder } from "../src/main/typescript/elvarg/game/model/movement/path/PathFinder";
import { Combat } from "../src/main/typescript/elvarg/game/content/combat/Combat";
import { Misc } from "../src/main/typescript/elvarg/util/Misc";
import { TaskManager } from "../src/main/typescript/elvarg/game/task/TaskManager";
import { Task } from "../src/main/typescript/elvarg/game/task/Task";
import { MagicCombatMethod } from "../src/main/typescript/elvarg/game/content/combat/method/impl/MagicCombatMethod";
import { CombatFactory, CanAttackResponse } from "../src/main/typescript/elvarg/game/content/combat/CombatFactory";
import { AreaManager } from "../src/main/typescript/elvarg/game/model/areas/AreaManager";
import { DuelState } from "../src/main/typescript/elvarg/game/content/Duelling";
import { RangedCombatMethod } from "../src/main/typescript/elvarg/game/content/combat/method/impl/RangedCombatMethod";
import { Ammunition, RangedWeapon } from "../src/main/typescript/elvarg/game/content/combat/ranged/RangedData";
import { CoordinateState } from "../src/main/typescript/elvarg/game/entity/impl/npc/NPCMovementCoordinator";

void FightType;
void WeaponProfiles;
void WeaponInterfaces;

const originalCanMoveStart = RegionManager.canMovestart;
const originalCanMove = RegionManager.canMove;
const originalGetClipping = RegionManager.getClipping;
const originalProjectile = RegionManager.canProjectileAttackBounds;
const originalNpcOccupancy = World.isNpcOccupyingTile;
const originalPlayerOccupancy = World.isPlayerOccupyingTile;
const originalPlayers = (World as any).players;
const originalNpcs = (World as any).npcs;
const originalPlayerOrder = (World as any).playerProcessOrder;
const originalNextShuffle = (World as any).nextPlayerOrderShuffleCycle;
const originalRandom = Math.random;
const originalGetRandom = Misc.getRandom;
const originalHasActiveTask = TaskManager.hasActiveTask;
const originalWasTaskActiveThisCycle = TaskManager.wasTaskActiveThisCycle;
const originalInMulti = AreaManager.inMulti;
const originalNpcTileOccupants = (World as any).npcTileOccupants;
const originalPlayerTileOccupants = (World as any).playerTileOccupants;
const originalNpcRegionOccupants = (World as any).npcRegionOccupants;
const originalActiveRegionIndex = (World as any).activeRegionIndex;
const originalActiveNpcsForUpdate = (World as any).activeNpcsForUpdate;
const originalCombatActiveNpcs = (World as any).combatActiveNpcs;
const originalRangedWeaponFor = RangedWeapon.getFor;
const originalAmmunitionFor = Ammunition.getFor;

const makeNpcQueue = (x = 0, y = 0, size = 1, movementSteps = 1) => {
    let location = new Location(x, y, 0);
    const character: any = {
        isPlayer: () => false,
        isNpc: () => true,
        getAsNpc: () => character,
        getLocation: () => location,
        setLocation: (next: Location) => location = next,
        getSize: () => size,
        getPrivateArea: () => null,
        getTimers: () => ({ has: () => false }),
        isNeedsPlacement: () => false,
        getFollowing: () => null,
        canWalkThroughNPCs: () => true,
        getMovementSteps: () => movementSteps,
        setWalkingDirection: () => undefined,
        setRunningDirection: () => undefined,
    };
    return { character, queue: new MovementQueue(character), location: () => location };
};

const entity = (x: number, y: number, size: number, player: boolean): any => ({
    getLocation: () => new Location(x, y, 0),
    getSize: () => size,
    getPrivateArea: () => null,
    isPlayer: () => player,
    isNpc: () => !player,
});

try {
    (World as any).isNpcOccupyingTile = () => false;

    const sixTileDestination = CombatRange.rangedDestination(entity(0, 0, 1, false), entity(10, 10, 1, false), 6);
    assert.deepEqual([sixTileDestination.getX(), sixTileDestination.getY()], [4, 4]);
    const largeTargetDestination = CombatRange.rangedDestination(entity(20, 15, 1, false), entity(10, 10, 2, false), 6);
    assert.deepEqual([largeTargetDestination.getX(), largeTargetDestination.getY()], [17, 17]);

    const movementCase = (
        allowed: (from: Location, to: Location) => boolean,
        expected: [number, number],
    ) => {
        const { queue, location } = makeNpcQueue();
        (RegionManager as any).canMovestart = allowed;
        queue.addCheckpoint(new Location(2, 2, 0));
        queue.process();
        assert.deepEqual([location().getX(), location().getY()], expected);
        return queue;
    };

    movementCase(() => true, [1, 1]);
    movementCase((_from, to) => to.getX() === 1 && to.getY() === 0, [1, 0]);
    movementCase((_from, to) => to.getX() === 0 && to.getY() === 1, [0, 1]);
    const blockedQueue = movementCase(() => false, [0, 0]);
    assert.equal(blockedQueue.size(), 1, "a blocked preferred step must retain its checkpoint");
    assert.equal(blockedQueue.wasBlockedByDynamicOccupancy(), false);

    const run = makeNpcQueue(0, 0, 1, 2);
    (RegionManager as any).canMovestart = () => true;
    run.queue.addCheckpoint(new Location(1, 0, 0));
    run.queue.addCheckpoint(new Location(3, 0, 0));
    run.queue.process();
    assert.deepEqual([run.location().getX(), run.location().getY()], [2, 0]);
    assert.equal(run.queue.size(), 1, "run step two must cross checkpoints from the intermediate tile");

    const requested = makeNpcQueue(3200, 3200);
    (requested.queue as any).player = {
        getHitpoints: () => 10,
        getDueling: () => ({
            getButtonDelay: () => ({ finished: () => true }),
            inDuel: () => false,
        }),
        getTrading: () => ({ getButtonDelay: () => ({ finished: () => true }) }),
        isPlayerBot: () => true,
    };
    (requested.queue as any).walkToReset = () => undefined;
    const calculateWalkRoute = PathFinder.calculateWalkRoute;
    try {
        (PathFinder as any).calculateWalkRoute = (_player: unknown, x: number, y: number) => {
            requested.queue.addCheckpoint(new Location(x, y, 0));
            return 1;
        };
        requested.queue.requestWalk(new Location(3202, 3200, 0));
        requested.queue.beginCycle();
        requested.queue.process();
    } finally {
        (PathFinder as any).calculateWalkRoute = calculateWalkRoute;
    }
    assert.deepEqual(
        [requested.location().getX(), requested.location().getY()],
        [3201, 3200],
        "ordinary requestWalk must move on its first movement process",
    );
    assert.equal(requested.queue.didMoveThisCycle(), true);

    const sized = makeNpcQueue(0, 0, 2);
    let validatedSize = 0;
    (RegionManager as any).canMovestart = (_from: Location, _to: Location, width: number) => {
        validatedSize = width;
        return true;
    };
    sized.queue.addCheckpoint(new Location(2, 0, 0));
    sized.queue.process();
    assert.equal(validatedSize, 2);

    const occupiedNpc = makeNpcQueue(0, 0, 2);
    occupiedNpc.character.canWalkThroughNPCs = () => false;
    let occupancySize = 0;
    (RegionManager as any).canMovestart = () => true;
    (World as any).isNpcOccupyingTile = (next: Location, _ignored: unknown, size: number) => {
        occupancySize = size;
        return next.getX() === 1 && next.getY() === 1;
    };
    occupiedNpc.queue.addCheckpoint(new Location(2, 2, 0));
    occupiedNpc.queue.process();
    assert.deepEqual([occupiedNpc.location().getX(), occupiedNpc.location().getY()], [1, 0]);
    assert.equal(occupancySize, 2, "NPC occupancy must validate the mover's full footprint");
    const fullyOccupiedNpc = makeNpcQueue();
    fullyOccupiedNpc.character.canWalkThroughNPCs = () => false;
    (World as any).isNpcOccupyingTile = () => true;
    fullyOccupiedNpc.queue.addCheckpoint(new Location(2, 2, 0));
    fullyOccupiedNpc.queue.process();
    assert.equal(fullyOccupiedNpc.queue.wasBlockedByDynamicOccupancy(), true);
    (World as any).isNpcOccupyingTile = () => false;

    // A player stamps BLOCK_NPCS on its tile but never BLOCK_PLAYERS, so the
    // occupancy index has to stop NPCs while leaving players free to pass.
    const playerBlockedNpc = makeNpcQueue();
    playerBlockedNpc.character.canWalkThroughNPCs = () => false;
    (World as any).isPlayerOccupyingTile = (next: Location) => next.getX() === 1 && next.getY() === 1;
    const npcStep = (playerBlockedNpc.queue as any).validatedStep(new Location(0, 0, 0), new Location(2, 2, 0));
    assert.deepEqual([npcStep.getX(), npcStep.getY()], [1, 0],
        "NPCs must route around a player-occupied tile rather than step onto it");
    assert.equal(playerBlockedNpc.queue.wasBlockedByDynamicOccupancy(), true);
    (World as any).isPlayerOccupyingTile = () => false;

    // Only 1x1 actors take the diagonal; larger ones square the corner.
    (RegionManager as any).canMovestart = () => true;
    const smallNpc = makeNpcQueue(0, 0, 1);
    assert.deepEqual(
        (() => {
            const step = (smallNpc.queue as any).validatedStep(new Location(0, 0, 0), new Location(2, 2, 0));
            return [step.getX(), step.getY()];
        })(),
        [1, 1],
        "a 1x1 actor steps diagonally toward its checkpoint"
    );
    const largeNpc = makeNpcQueue(0, 0, 2);
    assert.deepEqual(
        (() => {
            const step = (largeNpc.queue as any).validatedStep(new Location(0, 0, 0), new Location(2, 2, 0));
            return [step.getX(), step.getY()];
        })(),
        [1, 0],
        "a multi-tile actor never steps diagonally, even on open ground"
    );

    const playerCharacter: any = {
        isPlayer: () => true,
        isNpc: () => false,
        getAsPlayer: () => playerCharacter,
        getLocation: () => new Location(0, 0, 0),
        getSize: () => 1,
        getPrivateArea: () => null,
    };
    const playerQueue = new MovementQueue(playerCharacter);
    (World as any).isPlayerOccupyingTile = (next: Location) => next.getX() === 1 && next.getY() === 1;
    const playerStep = (playerQueue as any).validatedStep(new Location(0, 0, 0), new Location(2, 2, 0));
    assert.deepEqual([playerStep.getX(), playerStep.getY()], [1, 1],
        "players must be able to walk through occupied player tiles");

    const source = entity(0, 0, 2, false);
    const target = entity(5, 0, 3, true);
    const naive = PathFinder.naiveEntityDestination(source, target);
    assert.deepEqual([naive.getX(), naive.getY()], [3, 0]);
    for (const [sourceX, sourceY, expectedX, expectedY] of [
        [0, 5, 3, 5], [12, 5, 8, 5], [5, 0, 5, 3], [5, 12, 5, 8],
    ]) {
        const destination = PathFinder.naiveEntityDestination(
            entity(sourceX, sourceY, 2, false), entity(5, 5, 3, true)
        );
        assert.deepEqual([destination.getX(), destination.getY()], [expectedX, expectedY]);
    }

    const ranged: any = { type: () => CombatType.RANGED, attackDistance: () => 10 };
    const melee: any = { type: () => CombatType.MELEE, attackDistance: () => 1 };
    const projectileCalls: Array<[number, number, number, number]> = [];
    (RegionManager as any).canProjectileAttackBounds = (
        from: Location, to: Location, sourceWidth: number, _sourceLength: number, destinationWidth: number
    ) => {
        projectileCalls.push([from.getX(), to.getX(), sourceWidth, destinationWidth]);
        return true;
    };
    assert.equal(CombatRange.canReach(entity(0, 0, 1, true), ranged, entity(5, 0, 1, true)), true);
    assert.deepEqual(projectileCalls, [[0, 5, 1, 1], [5, 0, 1, 1]], "PvP LOS must be reciprocal");

    projectileCalls.length = 0;
    (RegionManager as any).canProjectileAttackBounds = (
        from: Location, to: Location, sourceWidth: number, _sourceLength: number, destinationWidth: number
    ) => {
        projectileCalls.push([from.getX(), to.getX(), sourceWidth, destinationWidth]);
        return from.getX() === 0;
    };
    assert.equal(CombatRange.canReach(entity(0, 0, 1, true), ranged, entity(5, 0, 1, true)), false);

    projectileCalls.length = 0;
    (RegionManager as any).canProjectileAttackBounds = (
        from: Location, to: Location, sourceWidth: number, _sourceLength: number, destinationWidth: number
    ) => {
        projectileCalls.push([from.getX(), to.getX(), sourceWidth, destinationWidth]);
        return true;
    };
    assert.equal(CombatRange.canReach(entity(0, 0, 2, false), ranged, entity(5, 0, 1, true)), true);
    assert.deepEqual(projectileCalls, [[5, 0, 1, 2]], "NPC LOS must cast from the target footprint in reverse");

    projectileCalls.length = 0;
    assert.equal(CombatRange.canReach(entity(0, 0, 1, true), ranged, entity(5, 0, 3, false)), true);
    assert.deepEqual(projectileCalls, [[0, 5, 1, 3]], "player-to-NPC LOS must include the full target footprint");
    assert.equal(CombatRange.canReach(entity(0, 0, 2, false), ranged, entity(1, 1, 1, true)), false);

    (RegionManager as any).canProjectileAttackBounds = originalProjectile;
    (RegionManager as any).getClipping = (x: number, y: number) =>
        x === 1 && y === 1 ? RegionManager.PROJECTILE_TILE_BLOCKED : 0;
    assert.equal(
        RegionManager.canProjectileAttackBounds(
            new Location(0, 0, 0), new Location(5, 2, 0), 1, 1, 1, 1, null
        ),
        true,
        "projectile LOS must follow the real slope rather than diagonal-first stepping",
    );
    (RegionManager as any).getClipping = (x: number, y: number) =>
        x === 3 && y === 1 ? RegionManager.PROJECTILE_WEST_BLOCKED : 0;
    assert.equal(RegionManager.canProjectileAttackBounds(
        new Location(0, 0, 0), new Location(5, 2, 0), 1, 1, 1, 1, null
    ), false);
    assert.equal(RegionManager.canProjectileAttackBounds(
        new Location(5, 2, 0), new Location(0, 0, 0), 1, 1, 1, 1, null
    ), true, "directional projectile flags must remain asymmetric");
    (RegionManager as any).getClipping = originalGetClipping;

    (RegionManager as any).getClipping = () => 0;
    assert.equal(CombatRange.canReach(entity(0, 0, 1, true), melee, entity(1, 0, 1, false)), true);
    assert.equal(CombatRange.canReach(entity(0, 0, 1, true), melee, entity(1, 1, 1, false)), false);
    assert.equal(CombatRange.canReach(entity(0, 0, 2, false), melee, entity(1, 1, 1, true)), false);
    (RegionManager as any).getClipping = (x: number) => x === 1 ? RegionManager.BLOCKED_TILE : 0;
    assert.equal(CombatRange.canReach(entity(0, 0, 1, true), melee, entity(1, 0, 1, false)), true,
        "an occupied target on a blocked floor tile must remain attackable across an open edge");
    (RegionManager as any).getClipping = (x: number) => x === 1 ? 0x80 : 0;
    assert.equal(CombatRange.canReach(entity(0, 0, 1, true), melee, entity(1, 0, 1, false)), false);
    (RegionManager as any).getClipping = originalGetClipping;

    const first = { id: "first" };
    const second = { id: "second" };
    const third = { id: "third" };
    let players: any[] = [first, second];
    (World as any).players = { forEach: (visit: (player: any) => void) => players.forEach(visit) };
    (World as any).playerProcessOrder = [];
    (World as any).nextPlayerOrderShuffleCycle = 0;
    let randomCalls = 0;
    Math.random = () => {
        randomCalls++;
        return 0;
    };
    const initialOrder = [...(World as any).orderedPlayersForCycle(1)];
    const callsAfterShuffle = randomCalls;
    assert.deepEqual((World as any).orderedPlayersForCycle(99), initialOrder);
    assert.equal(randomCalls, callsAfterShuffle, "the global player order must stay stable within its epoch");
    players = [second, third];
    assert.deepEqual(new Set((World as any).orderedPlayersForCycle(99)), new Set(players));

    const activeBot: any = {
        isPlayerBot: () => true,
        getForceMovement: () => null,
        getCombat: () => ({ hasPendingWork: () => true }),
        getMovementQueue: () => ({ hasPendingWork: () => false }),
    };
    assert.equal((World as any).shouldProcessBotPlayerThisTick(activeBot, 7), true);
    activeBot.getCombat = () => ({ hasPendingWork: () => false });
    activeBot.getMovementQueue = () => ({ hasPendingWork: () => true });
    assert.equal((World as any).shouldProcessBotPlayerThisTick(activeBot, 8), true);
    activeBot.getMovementQueue = () => ({ hasPendingWork: () => false });
    activeBot.getTimers = () => ({ hasActive: () => true });
    assert.equal((World as any).shouldProcessBotPlayerThisTick(activeBot, 9), true);

    const processedNpcs: number[] = [];
    const mechanicsNpc = (id: number, timerActive = false): any => ({
        getIndex: () => id,
        isRegistered: () => true,
        getInteractingMobile: () => null,
        isDyingFunction: () => false,
        getCombat: () => ({ hasPendingWork: () => false }),
        getMovementQueue: () => ({ hasPendingWork: () => false }),
        getTimers: () => ({ hasActive: () => timerActive }),
        getMovementCoordinator: () => ({ getCoordinateState: () => CoordinateState.HOME }),
        getDefinition: () => ({ getHitpoints: () => 10 }),
        getHitpoints: () => 10,
        process: () => processedNpcs.push(id),
    });
    const nearbyNpc = mechanicsNpc(1);
    const timedNpc = mechanicsNpc(2, true);
    const distantIdleNpc = mechanicsNpc(3);
    (World as any).activeRegionIndex = { getActiveRegionKeys: () => ["0:0:0"] };
    (World as any).npcRegionOccupants = new Map([["0:0:0", new Set([nearbyNpc])]]);
    (World as any).activeNpcsForUpdate = [timedNpc, distantIdleNpc];
    (World as any).combatActiveNpcs = new Set();
    const mechanicsNpcs = (World as any).collectActiveNpcsForUpdate();
    (World as any).processNpcMechanics(mechanicsNpcs);
    assert.deepEqual(
        processedNpcs,
        [1, 2],
        "nearby and mechanically active NPCs must run without processing distant idle NPCs",
    );

    const callsBeforeEpoch = randomCalls;
    (World as any).orderedPlayersForCycle(100);
    assert.equal(randomCalls, callsBeforeEpoch);
    (World as any).orderedPlayersForCycle(101);
    assert(randomCalls > callsBeforeEpoch, "the whole player order must reshuffle at one global epoch");

    const otherArea = {};
    const privateNpc = { getPrivateArea: () => otherArea };
    const privatePlayer = { getPrivateArea: () => otherArea };
    (World as any).npcTileOccupants = new Map([["0:20:20", [privateNpc]]]);
    (World as any).playerTileOccupants = new Map([["0:20:20", [privatePlayer]]]);
    assert.equal(originalNpcOccupancy.call(World, new Location(20, 20, 0), null, 1, null), false);
    assert.equal(originalNpcOccupancy.call(World, new Location(20, 20, 0), null, 1, otherArea), true);
    assert.equal(originalPlayerOccupancy.call(World, new Location(20, 20, 0), null, 1, null), false);
    assert.equal(originalPlayerOccupancy.call(World, new Location(20, 20, 0), null, 1, otherArea), true);
    // A size-2 NPC stepping onto (19,19) covers (20,20), so the player there blocks it.
    assert.equal(originalPlayerOccupancy.call(World, new Location(19, 19, 0), null, 2, otherArea), true);

    const indexedArea = {};
    const indexedNpc: any = { getSize: () => 2, getPrivateArea: () => indexedArea };
    (World as any).npcTileOccupants = new Map();
    (World as any).npcRegionOccupants = new Map();
    World.registerNpcPosition(indexedNpc, new Location(30, 30, 0));
    assert.equal(originalNpcOccupancy.call(World, new Location(31, 31, 0), null, 1, indexedArea), true);
    World.onNpcMoved(indexedNpc, new Location(30, 30, 0), new Location(40, 40, 0));
    assert.equal(originalNpcOccupancy.call(World, new Location(31, 31, 0), null, 1, indexedArea), false);
    assert.equal(originalNpcOccupancy.call(World, new Location(41, 41, 0), null, 1, indexedArea), true);
    World.unregisterNpcPosition(indexedNpc, new Location(40, 40, 0));
    assert.equal(originalNpcOccupancy.call(World, new Location(41, 41, 0), null, 1, indexedArea), false);

    const spellDeleteFlags: boolean[] = [];
    const spell: any = { canCast: (_player: unknown, del: boolean) => { spellDeleteFlags.push(del); return true; } };
    let selectedSpell: any = spell;
    const magicCharacter: any = {
        isNpc: () => false,
        isPlayer: () => true,
        getAsPlayer: () => magicCharacter,
        getCombat: () => ({
            getCastSpell: () => selectedSpell,
            getAutocastSpell: () => null,
            setCastSpell: (value: any) => { selectedSpell = value; },
        }),
    };
    const magicMethod = new MagicCombatMethod();
    assert.equal(magicMethod.canPursue(magicCharacter, {} as any), true);
    assert.equal(magicMethod.canAttack(magicCharacter, {} as any), true);
    assert.deepEqual(spellDeleteFlags, [false, true], "pursuit validation must not consume runes");

    let finalRangedWeapon: any = RangedWeapon.DRAGON_DART;
    let finalAmmo: any = Ammunition.DRAGON_DART;
    const finalAmmoCombat: any = {
        setRangedWeapon: (value: any) => { finalRangedWeapon = value; },
        getRangedWeapon: () => finalRangedWeapon,
        setAmmunition: (value: any) => { finalAmmo = value; },
        getAmmunition: () => finalAmmo,
    };
    const finalAmmoPlayer: any = {
        isPlayer: () => true,
        getAsPlayer: () => finalAmmoPlayer,
        getCombat: () => finalAmmoCombat,
    };
    (RangedWeapon as any).getFor = () => null;
    (Ammunition as any).getFor = () => null;
    assert.equal(new RangedCombatMethod().shouldRenew(finalAmmoPlayer), false,
        "removing the final thrown weapon must terminate ranged continuation");

    let duelState = DuelState.STARTING_DUEL;
    let duelOpponent: any;
    const duelCombat = { getAttacker: () => null, getHitQueue: () => ({ isEmpty: () => true }) };
    const duelPlayer = (): any => {
        const player: any = {
            isPlayer: () => true,
            isNpc: () => false,
            getAsPlayer: () => player,
            getCombat: () => duelCombat,
            getDueling: () => ({
                inDuel: () => true,
                getState: () => duelState,
                getInteract: () => duelOpponent,
                getRules: () => [],
            }),
            isSpecialActivated: () => false,
            getTimers: () => ({ has: () => false }),
            getPrivateArea: () => null,
        };
        return player;
    };
    const duelA = duelPlayer();
    const duelB = duelPlayer();
    duelA.getDueling = () => ({ inDuel: () => true, getState: () => duelState, getInteract: () => duelB, getRules: () => [] });
    duelB.getDueling = () => ({ inDuel: () => true, getState: () => duelState, getInteract: () => duelA, getRules: () => [] });
    const duelMethod: any = { canPursue: () => true, type: () => CombatType.MELEE };
    (AreaManager as any).inMulti = () => false;
    assert.equal(
        CombatFactory.canAttackPermission(duelA, duelB, true, duelMethod),
        CanAttackResponse.DUEL_NOT_STARTED_YET,
    );
    duelState = DuelState.IN_DUEL;
    assert.equal(CombatFactory.canAttackPermission(duelA, duelB, true, duelMethod), CanAttackResponse.CAN_ATTACK);
    duelB.getDueling = () => ({ inDuel: () => true, getState: () => duelState, getInteract: () => null, getRules: () => [] });
    assert.equal(
        CombatFactory.canAttackPermission(duelA, duelB, true, duelMethod),
        CanAttackResponse.DUEL_WRONG_OPPONENT,
    );

    let underTargetCheckpoint: Location | null = null;
    const underTargetMovement = {
        reset: () => { underTargetCheckpoint = null; },
        setPursuitCheckpoint: (location: Location) => { underTargetCheckpoint = location; },
    };
    const underTargetNpc: any = {
        getMovementQueue: () => underTargetMovement,
        getLocation: () => new Location(10, 10, 0),
    };
    const underTargetCombat = new Combat(underTargetNpc);
    (Misc as any).getRandom = () => 2;
    const idleState: any = {
        skipPost: false,
        target: {
            isPlayer: () => true,
            getCombat: () => ({ getTarget: () => null }),
            getFollowing: () => null,
            getIndex: () => 7,
            getInteractingMobile: () => ({}),
        },
    };
    (TaskManager as any).hasActiveTask = () => false;
    (underTargetCombat as any).processNpcUnderTarget(idleState);
    assert.equal(idleState.skipPost, true);
    assert.deepEqual(
        [underTargetCheckpoint!.getX(), underTargetCheckpoint!.getY()],
        [10, 9],
        "an idle under-target NPC must try exactly the selected cardinal direction",
    );
    const busyState: any = {
        skipPost: false,
        target: { isPlayer: () => true, getCombat: () => ({ getTarget: () => ({}) }), getFollowing: () => null },
    };
    (underTargetCombat as any).processNpcUnderTarget(busyState);
    assert.equal(underTargetCheckpoint, null, "an NPC under a busy player must wait");
    const objectBusyState: any = {
        skipPost: false,
        target: {
            isPlayer: () => true,
            getCombat: () => ({ getTarget: () => null }),
            getFollowing: () => null,
            getIndex: () => 7,
        },
    };
    (TaskManager as any).hasActiveTask = () => true;
    (underTargetCombat as any).processNpcUnderTarget(objectBusyState);
    assert.equal(underTargetCheckpoint, null, "a pending generic movement interaction must count as busy");

    let stopMovementTask = true;
    class MovementTask extends Task {
        constructor() { super(1, 7, false); }
        execute(): void { if (stopMovementTask) this.stop(); }
    }
    (TaskManager as any).hasActiveTask = originalHasActiveTask;
    TaskManager.submit(new MovementTask());
    TaskManager.process();
    assert.equal(TaskManager.hasActiveTask(7, "MovementTask"), false);
    (underTargetCombat as any).processNpcUnderTarget(objectBusyState);
    assert.equal(underTargetCheckpoint, null, "a generic interaction completed before NPC processing must stay busy that cycle");

    stopMovementTask = false;
    TaskManager.submit(new MovementTask());
    assert.equal(TaskManager.hasActiveTask(7, "MovementTask"), true,
        "a pending movement interaction must be visible before task processing");
    TaskManager.process();
    TaskManager.cancelTasks(7);
    TaskManager.process();
    assert.equal(TaskManager.wasTaskActiveThisCycle(7, "MovementTask"), false,
        "a task cancelled between ticks must not remain busy for another cycle");

    console.info("combat pathing smoke passed");
} finally {
    (RegionManager as any).canMovestart = originalCanMoveStart;
    (RegionManager as any).canMove = originalCanMove;
    (RegionManager as any).canProjectileAttackBounds = originalProjectile;
    (RegionManager as any).getClipping = originalGetClipping;
    (World as any).isNpcOccupyingTile = originalNpcOccupancy;
    (World as any).isPlayerOccupyingTile = originalPlayerOccupancy;
    (World as any).players = originalPlayers;
    (World as any).npcs = originalNpcs;
    (World as any).playerProcessOrder = originalPlayerOrder;
    (World as any).nextPlayerOrderShuffleCycle = originalNextShuffle;
    Math.random = originalRandom;
    (Misc as any).getRandom = originalGetRandom;
    (TaskManager as any).hasActiveTask = originalHasActiveTask;
    (TaskManager as any).wasTaskActiveThisCycle = originalWasTaskActiveThisCycle;
    (AreaManager as any).inMulti = originalInMulti;
    (World as any).npcTileOccupants = originalNpcTileOccupants;
    (World as any).playerTileOccupants = originalPlayerTileOccupants;
    (World as any).npcRegionOccupants = originalNpcRegionOccupants;
    (World as any).activeRegionIndex = originalActiveRegionIndex;
    (World as any).activeNpcsForUpdate = originalActiveNpcsForUpdate;
    (World as any).combatActiveNpcs = originalCombatActiveNpcs;
    (RangedWeapon as any).getFor = originalRangedWeaponFor;
    (Ammunition as any).getFor = originalAmmunitionFor;
}
