const { Skill } = require("../../src/main/typescript/elvarg/game/model/Skill");
const { Equipment } = require("../../src/main/typescript/elvarg/game/model/container/impl/Equipment");
const { Animation } = require("../../src/main/typescript/elvarg/game/model/Animation");
const { Task } = require("../../src/main/typescript/elvarg/game/task/Task");
const { MapObjects } = require("../../src/main/typescript/elvarg/game/entity/impl/object/MapObjects");
const { GameObject } = require("../../src/main/typescript/elvarg/game/entity/impl/object/GameObject");
const { Item } = require("../../src/main/typescript/elvarg/game/model/Item");
const { Sound } = require("../../src/main/typescript/elvarg/game/Sound");
const { Sounds } = require("../../src/main/typescript/elvarg/game/Sounds");
const { ItemIds, ObjectIds } = require("../../src/main/typescript/elvarg/util/IdEnums");
const { Pets } = require("../npcs/Pets.plugin");

const TREE_STUMP_OBJECT_ID = ObjectIds.TREE_STUMP_3;
const WOODCUTTING_ACTION_INTERVAL_TICKS = 4;
const CHOP_ANIMATION_INTERVAL_TICKS = 4;
const MULTI_TREE_DEPLETION_ROLL_MAX = 15;
const MULTI_TREE_DEPLETION_THRESHOLD = 2;
const BIRD_NEST_DROP_CHANCE = 256;
let woodcuttingTick = 0;
let activeSessionsRef = null;

const BIRD_NESTS = Object.freeze({
  RED_EGG_NEST: ItemIds.BIRD_NEST,
  GREEN_EGG_NEST: ItemIds.BIRD_NEST_2,
  BLUE_EGG_NEST: ItemIds.BIRD_NEST_3,
  SEED_NEST: ItemIds.BIRD_NEST_4,
  RING_NEST: ItemIds.BIRD_NEST_5,
  EMPTY_NEST: ItemIds.BIRD_NEST_6,
});

const SEARCHABLE_NEST_IDS = new Set([
  BIRD_NESTS.RED_EGG_NEST,
  BIRD_NESTS.GREEN_EGG_NEST,
  BIRD_NESTS.BLUE_EGG_NEST,
  BIRD_NESTS.SEED_NEST,
  BIRD_NESTS.RING_NEST,
]);

const AXES = [
  { id: ItemIds.BRONZE_AXE, requiredLevel: 1, speed: 0.03, animationId: 879 },
  { id: ItemIds.IRON_AXE, requiredLevel: 1, speed: 0.05, animationId: 877 },
  { id: ItemIds.STEEL_AXE, requiredLevel: 6, speed: 0.09, animationId: 875 },
  { id: ItemIds.BLACK_AXE, requiredLevel: 6, speed: 0.11, animationId: 873 },
  { id: ItemIds.MITHRIL_AXE, requiredLevel: 21, speed: 0.13, animationId: 871 },
  { id: ItemIds.ADAMANT_AXE, requiredLevel: 31, speed: 0.16, animationId: 869 },
  { id: ItemIds.RUNE_AXE, requiredLevel: 41, speed: 0.19, animationId: 867 },
  { id: ItemIds.DRAGON_AXE, requiredLevel: 61, speed: 0.25, animationId: 2846 },
  { id: ItemIds.INFERNAL_AXE, requiredLevel: 61, speed: 0.3, animationId: 2117 },
];

const AXES_BY_REQUIREMENT_DESC = [...AXES].sort(
  (a, b) => b.requiredLevel - a.requiredLevel
);

const TREES = [
  {
    name: "normal tree",
    objectNames: ["Tree", "Dead tree", "Evergreen tree", "Dying tree"],
    action: "Chop down",
    requiredLevel: 1,
    xpReward: 25,
    logId: ItemIds.LOGS,
    objectIds: [
      ObjectIds.EVERGREEN_TREE,
      ObjectIds.EVERGREEN_TREE_2,
      ObjectIds.EVERGREEN_TREE_3,
      ObjectIds.EVERGREEN_TREE_4,
      ObjectIds.EVERGREEN_TREE_5,
      ObjectIds.EVERGREEN_TREE_6,
      ObjectIds.EVERGREEN_TREE_7,
      ObjectIds.EVERGREEN_TREE_8,
      ObjectIds.EVERGREEN_TREE_9,
      ObjectIds.JUNGLE_TREE_3,
      ObjectIds.TREE,
      ObjectIds.TREE_2,
      ObjectIds.TREE_3,
      ObjectIds.TREE_4,
      ObjectIds.TREE_5,
      ObjectIds.DEAD_TREE,
      ObjectIds.DEAD_TREE_2,
      ObjectIds.DEAD_TREE_3,
      ObjectIds.DEAD_TREE_4,
      ObjectIds.DEAD_TREE_5,
      ObjectIds.DEAD_TREE_8,
      ObjectIds.DEAD_TREE_9,
      ObjectIds.DEAD_TREE_10,
      ObjectIds.TREE_9,
      ObjectIds.TREE_10,
      ObjectIds.TREE_11,
      ObjectIds.DEAD_TREE_12,
      ObjectIds.DEAD_TREE_13,
      ObjectIds.DEAD_TREE_14,
      ObjectIds.TREE_16,
      ObjectIds.TREE_17,
      ObjectIds.TREE_18,
      ObjectIds.DEAD_TREE_18,
      ObjectIds.DEAD_TREE_19,
      ObjectIds.DEAD_TREE_20,
    ],
    cycles: 10,
    respawnTicks: 8,
    multi: false,
  },
  {
    name: "achey tree",
    objectNames: ["Achey Tree"],
    action: "Chop",
    requiredLevel: 1,
    xpReward: 25,
    logId: ItemIds.ACHEY_TREE_LOGS,
    objectIds: [ObjectIds.ACHEY_TREE],
    cycles: 13,
    respawnTicks: 9,
    multi: false,
  },
  {
    name: "oak",
    objectNames: ["Oak tree"],
    action: "Chop down",
    requiredLevel: 15,
    xpReward: 38,
    logId: ItemIds.OAK_LOGS,
    objectIds: [
      ObjectIds.ARCTIC_PINE_TREE,
      ObjectIds.OAK_TREE, ObjectIds.OAK_TREE_2, ObjectIds.OAK_TREE_3, ObjectIds.OAK_TREE_4,
      ObjectIds.OAK_TREE_5, ObjectIds.OAK_TREE_6, ObjectIds.OAK_TREE_7, ObjectIds.OAK_TREE_8,
      ObjectIds.OAK_TREE_9, ObjectIds.OAK_TREE_10, ObjectIds.OAK_TREE_11, ObjectIds.OAK_TREE_12,
      ObjectIds.OAK_TREE_13, ObjectIds.OAK_TREE_14, ObjectIds.OAK_TREE_15, ObjectIds.OAK_TREE_16,
      ObjectIds.OAK_TREE_17, ObjectIds.OAK_TREE_18,
    ],
    cycles: 14,
    respawnTicks: 11,
    multi: true,
  },
  {
    name: "willow",
    objectNames: ["Willow tree"],
    action: "Chop down",
    requiredLevel: 30,
    xpReward: 68,
    logId: ItemIds.WILLOW_LOGS,
    objectIds: [
      ObjectIds.WILLOW_TREE, ObjectIds.WILLOW_TREE_2, ObjectIds.WILLOW_TREE_3, ObjectIds.WILLOW_TREE_4,
      ObjectIds.WILLOW_TREE_5, ObjectIds.WILLOW_TREE_6, ObjectIds.WILLOW_TREE_7, ObjectIds.WILLOW_TREE_8,
      ObjectIds.WILLOW_TREE_9, ObjectIds.WILLOW_TREE_10, ObjectIds.WILLOW_TREE_11, ObjectIds.WILLOW_TREE_12,
      ObjectIds.WILLOW_TREE_13, ObjectIds.WILLOW_TREE_14,
    ],
    cycles: 15,
    respawnTicks: 14,
    multi: true,
  },
  {
    name: "teak",
    objectNames: ["Teak tree"],
    action: "Chop down",
    requiredLevel: 35,
    xpReward: 85,
    logId: ItemIds.TEAK_LOGS,
    objectIds: [
      ObjectIds.TEAK_TREE, ObjectIds.TEAK_TREE_2, ObjectIds.TEAK_TREE_3, ObjectIds.TEAK_TREE_4,
      ObjectIds.TEAK_TREE_5, ObjectIds.TEAK_TREE_6, ObjectIds.TEAK_TREE_7, ObjectIds.TEAK_TREE_8,
      ObjectIds.TEAK_TREE_9, ObjectIds.TEAK_TREE_10, ObjectIds.TEAK_TREE_11, ObjectIds.TEAK_TREE_12,
      ObjectIds.TEAK_TREE_13,
    ],
    cycles: 16,
    respawnTicks: 16,
    multi: true,
  },
  {
    name: "dramen",
    objectNames: ["Dramen tree"],
    action: "Chop down",
    requiredLevel: 36,
    xpReward: 88,
    logId: ItemIds.DRAMEN_BRANCH,
    objectIds: [ObjectIds.DRAMEN_TREE],
    cycles: 16,
    respawnTicks: 17,
    multi: true,
  },
  {
    name: "maple",
    objectNames: ["Maple tree"],
    action: "Chop down",
    requiredLevel: 45,
    xpReward: 100,
    logId: ItemIds.MAPLE_LOGS,
    objectIds: [
      ObjectIds.MAPLE_TREE, ObjectIds.MAPLE_TREE_2, ObjectIds.MAPLE_TREE_3, ObjectIds.MAPLE_TREE_4,
      ObjectIds.MAPLE_TREE_5, ObjectIds.MAPLE_TREE_6, ObjectIds.MAPLE_TREE_7, ObjectIds.MAPLE_TREE_8,
      ObjectIds.MAPLE_TREE_9, ObjectIds.MAPLE_TREE_10, ObjectIds.MAPLE_TREE_11, ObjectIds.MAPLE_TREE_12,
      ObjectIds.MAPLE_TREE_13, ObjectIds.MAPLE_TREE_14, ObjectIds.MAPLE_TREE_15, ObjectIds.MAPLE_TREE_16,
      ObjectIds.MAPLE_TREE_17, ObjectIds.MAPLE_TREE_18,
    ],
    cycles: 17,
    respawnTicks: 18,
    multi: true,
  },
  {
    name: "mahogany",
    objectNames: ["Mahogany tree"],
    action: "Chop down",
    requiredLevel: 50,
    xpReward: 125,
    logId: ItemIds.MAHOGANY_LOGS,
    objectIds: [
      ObjectIds.MAHOGANY_TREE, ObjectIds.MAHOGANY_TREE_2, ObjectIds.MAHOGANY_TREE_3, ObjectIds.MAHOGANY_TREE_4,
      ObjectIds.MAHOGANY_TREE_5, ObjectIds.MAHOGANY_TREE_6, ObjectIds.MAHOGANY_TREE_7, ObjectIds.MAHOGANY_TREE_8,
      ObjectIds.MAHOGANY_TREE_9, ObjectIds.MAHOGANY_TREE_10, ObjectIds.MAHOGANY_TREE_11, ObjectIds.MAHOGANY_TREE_12,
      ObjectIds.MAHOGANY_TREE_13, ObjectIds.MAHOGANY_TREE_14,
    ],
    cycles: 17,
    respawnTicks: 20,
    multi: true,
  },
  {
    name: "yew",
    objectNames: ["Yew tree"],
    action: "Chop down",
    requiredLevel: 60,
    xpReward: 175,
    logId: ItemIds.YEW_LOGS,
    objectIds: [
      ObjectIds.YEW_TREE, ObjectIds.YEW_TREE_2, ObjectIds.YEW_TREE_3, ObjectIds.YEW_TREE_4,
      ObjectIds.YEW_TREE_5, ObjectIds.YEW_TREE_6, ObjectIds.YEW_TREE_7, ObjectIds.YEW_TREE_8,
      ObjectIds.YEW_TREE_9, ObjectIds.YEW_TREE_10, ObjectIds.YEW_TREE_11, ObjectIds.YEW_TREE_12,
      ObjectIds.YEW_TREE_13, ObjectIds.YEW_TREE_14, ObjectIds.YEW_TREE_15, ObjectIds.YEW_TREE_16,
      ObjectIds.YEW_TREE_17, ObjectIds.YEW_TREE_18, ObjectIds.YEW_TREE_19,
    ],
    cycles: 18,
    respawnTicks: 28,
    multi: true,
  },
  {
    name: "magic",
    objectNames: ["Magic tree"],
    action: "Chop down",
    requiredLevel: 75,
    xpReward: 250,
    logId: ItemIds.MAGIC_LOGS,
    objectIds: [
      ObjectIds.MAGIC_TREE, ObjectIds.MAGIC_TREE_2, ObjectIds.MAGIC_TREE_3, ObjectIds.MAGIC_TREE_4,
      ObjectIds.MAGIC_TREE_5, ObjectIds.MAGIC_TREE_6, ObjectIds.MAGIC_TREE_7, ObjectIds.MAGIC_TREE_8,
      ObjectIds.MAGIC_TREE_9, ObjectIds.MAGIC_TREE_10, ObjectIds.MAGIC_TREE_11, ObjectIds.MAGIC_TREE_12,
      ObjectIds.MAGIC_TREE_13, ObjectIds.MAGIC_TREE_14, ObjectIds.MAGIC_TREE_15, ObjectIds.MAGIC_TREE_16,
      ObjectIds.MAGIC_TREE_17, ObjectIds.MAGIC_TREE_18,
    ],
    cycles: 20,
    respawnTicks: 40,
    multi: true,
  },
  {
    name: "redwood",
    objectNames: ["Redwood tree"],
    action: "Cut",
    requiredLevel: 90,
    xpReward: 380,
    logId: ItemIds.REDWOOD_LOGS,
    objectIds: [
      ObjectIds.REDWOOD_TREE, ObjectIds.REDWOOD_TREE_2, ObjectIds.REDWOOD_TREE_3, ObjectIds.REDWOOD_TREE_4,
      ObjectIds.REDWOOD_TREE_5, ObjectIds.REDWOOD_TREE_6, ObjectIds.REDWOOD_TREE_7, ObjectIds.REDWOOD_TREE_8,
      ObjectIds.REDWOOD_TREE_9, ObjectIds.REDWOOD_TREE_10, ObjectIds.REDWOOD_TREE_11, ObjectIds.REDWOOD_TREE_12,
      ObjectIds.REDWOOD_TREE_13, ObjectIds.REDWOOD_TREE_14, ObjectIds.REDWOOD_TREE_15, ObjectIds.REDWOOD_TREE_16,
      ObjectIds.REDWOOD_TREE_17, ObjectIds.REDWOOD_TREE_18, ObjectIds.REDWOOD_TREE_19, ObjectIds.REDWOOD_TREE_20,
      ObjectIds.REDWOOD_TREE_21, ObjectIds.REDWOOD_TREE_22, ObjectIds.REDWOOD_TREE_23, ObjectIds.REDWOOD_TREE_24,
      ObjectIds.REDWOOD_TREE_25, ObjectIds.REDWOOD_TREE_26, ObjectIds.REDWOOD_TREE_27, ObjectIds.REDWOOD_TREE_28,
      ObjectIds.REDWOOD_TREE_29, ObjectIds.REDWOOD_TREE_30, ObjectIds.REDWOOD_TREE_31, ObjectIds.REDWOOD_TREE_32,
      ObjectIds.REDWOOD_TREE_33, ObjectIds.REDWOOD_TREE_34, ObjectIds.REDWOOD_TREE_35, ObjectIds.REDWOOD_TREE_36,
      ObjectIds.REDWOOD_TREE_37, ObjectIds.REDWOOD_TREE_38, ObjectIds.REDWOOD_TREE_39, ObjectIds.REDWOOD_TREE_40,
      ObjectIds.REDWOOD_TREE_41, ObjectIds.REDWOOD_TREE_42, ObjectIds.REDWOOD_TREE_43, ObjectIds.REDWOOD_TREE_44,
      ObjectIds.REDWOOD_TREE_45, ObjectIds.REDWOOD_TREE_46, ObjectIds.REDWOOD_TREE_47, ObjectIds.REDWOOD_TREE_48,
      ObjectIds.REDWOOD_TREE_49, ObjectIds.REDWOOD_TREE_50, ObjectIds.REDWOOD_TREE_51, ObjectIds.REDWOOD_TREE_52,
      ObjectIds.REDWOOD_TREE_53, ObjectIds.REDWOOD_TREE_54, ObjectIds.REDWOOD_TREE_55, ObjectIds.REDWOOD_TREE_56,
      ObjectIds.REDWOOD_TREE_57, ObjectIds.REDWOOD_TREE_58, ObjectIds.REDWOOD_TREE_59, ObjectIds.REDWOOD_TREE_60,
      ObjectIds.REDWOOD_TREE_61, ObjectIds.REDWOOD_TREE_62, ObjectIds.REDWOOD_TREE_63, ObjectIds.REDWOOD_TREE_64,
      ObjectIds.REDWOOD_TREE_65, ObjectIds.REDWOOD_TREE_66, ObjectIds.REDWOOD_TREE_67, ObjectIds.REDWOOD_TREE_68,
      ObjectIds.REDWOOD_TREE_69, ObjectIds.REDWOOD_TREE_70, ObjectIds.REDWOOD_TREE_71, ObjectIds.REDWOOD_TREE_72,
      ObjectIds.REDWOOD_TREE_73, ObjectIds.REDWOOD_TREE_74, ObjectIds.REDWOOD_TREE_75, ObjectIds.REDWOOD_TREE_76,
      ObjectIds.REDWOOD_TREE_77, ObjectIds.REDWOOD_TREE_78, ObjectIds.REDWOOD_TREE_79, ObjectIds.REDWOOD_TREE_80,
      ObjectIds.REDWOOD_TREE_81, ObjectIds.REDWOOD_TREE_82, ObjectIds.REDWOOD_TREE_83, ObjectIds.REDWOOD_TREE_84,
      ObjectIds.REDWOOD_TREE_85, ObjectIds.REDWOOD_TREE_86, ObjectIds.REDWOOD_TREE_87, ObjectIds.REDWOOD_TREE_88,
      ObjectIds.REDWOOD_TREE_89, ObjectIds.REDWOOD_TREE_90, ObjectIds.REDWOOD_TREE_91, ObjectIds.REDWOOD_TREE_92,
      ObjectIds.REDWOOD_TREE_93, ObjectIds.REDWOOD_TREE_94, ObjectIds.REDWOOD_TREE_95, ObjectIds.REDWOOD_TREE_96,
      ObjectIds.REDWOOD_TREE_97, ObjectIds.REDWOOD_TREE_98, ObjectIds.REDWOOD_TREE_99, ObjectIds.REDWOOD_TREE_100,
      ObjectIds.REDWOOD_TREE_101, ObjectIds.REDWOOD_TREE_102, ObjectIds.REDWOOD_TREE_103, ObjectIds.REDWOOD_TREE_104,
      ObjectIds.REDWOOD_TREE_105, ObjectIds.REDWOOD_TREE_106, ObjectIds.REDWOOD_TREE_107, ObjectIds.REDWOOD_TREE_108,
      ObjectIds.REDWOOD_TREE_109, ObjectIds.REDWOOD_TREE_110, ObjectIds.REDWOOD_TREE_111, ObjectIds.REDWOOD_TREE_112,
      ObjectIds.REDWOOD_TREE_113, ObjectIds.REDWOOD_TREE_114, ObjectIds.REDWOOD_TREE_115, ObjectIds.REDWOOD_TREE_116,
      ObjectIds.REDWOOD_TREE_117, ObjectIds.REDWOOD_TREE_118, ObjectIds.REDWOOD_TREE_119, ObjectIds.REDWOOD_TREE_120,
      ObjectIds.REDWOOD_TREE_121,
    ],
    cycles: 22,
    respawnTicks: 43,
    multi: true,
  },
];

const TREES_BY_NAME = new Map(TREES.flatMap((tree) => tree.objectNames.map((name) => [name, tree])));



const TREE_LOG_IDS = Object.freeze(
  Array.from(new Set(TREES.map((tree) => tree.logId)))
);

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getWoodcuttingLevel(player) {
  return player.getSkillManager().getCurrentLevel(Skill.WOODCUTTING);
}

function getEquippedWeaponId(player) {
  const equippedWeapon =
    player.getEquipment().getItems()[Equipment.WEAPON_SLOT];
  return equippedWeapon ? equippedWeapon.getId() : -1;
}

function findBestUsableAxe(player) {
  const woodcuttingLevel = getWoodcuttingLevel(player);
  const equippedWeaponId = getEquippedWeaponId(player);
  const inventory = player.getInventory();

  for (const axe of AXES_BY_REQUIREMENT_DESC) {
    if (woodcuttingLevel < axe.requiredLevel) {
      continue;
    }
    if (equippedWeaponId === axe.id || inventory.contains(axe.id)) {
      return axe;
    }
  }

  return null;
}

function findBestUsableAxeByLevel(level) {
  for (const axe of AXES_BY_REQUIREMENT_DESC) {
    if (level >= axe.requiredLevel) {
      return axe;
    }
  }
  return null;
}

function isWoodcuttingActive(player) {
  return !!(activeSessionsRef && player && activeSessionsRef.has(player));
}

function calculateCyclesRequired(player, tree, axe) {
  let cycles = tree.cycles + randomIntInclusive(0, 4);
  cycles -= getWoodcuttingLevel(player) * 0.1;
  cycles -= cycles * axe.speed;
  const tickBudget = Math.max(3, Math.floor(cycles));
  return Math.max(1, Math.ceil(tickBudget / WOODCUTTING_ACTION_INTERVAL_TICKS));
}

function shouldDepleteTree(tree) {
  if (!tree.multi) {
    return true;
  }
  const roll = randomIntInclusive(0, MULTI_TREE_DEPLETION_ROLL_MAX);
  return roll >= MULTI_TREE_DEPLETION_THRESHOLD;
}

function rollBirdNestId() {
  const random = Math.random();
  if (random < 0.64) {
    return BIRD_NESTS.SEED_NEST;
  }
  if (random < 0.96) {
    return BIRD_NESTS.RING_NEST;
  }
  const color = randomIntInclusive(0, 2);
  if (color === 0) {
    return BIRD_NESTS.RED_EGG_NEST;
  }
  if (color === 1) {
    return BIRD_NESTS.GREEN_EGG_NEST;
  }
  return BIRD_NESTS.BLUE_EGG_NEST;
}

function maybeDropBirdNest(player) {
  if (!player || player.getLocation().getZ() > 0) {
    return;
  }
  if (randomIntInclusive(1, BIRD_NEST_DROP_CHANCE) !== 1) {
    return;
  }

  const nestId = rollBirdNestId();
  ItemOnGroundManager.registers(player, new Item(nestId, 1));
  player.getPacketSender().sendMessage("@red@A bird's nest falls out of the tree.");
}

function rollNestSeed() {
  const random = randomIntInclusive(1, 1000);
  if (random <= 220) return { id: ItemIds.ACORN, name: "acorn" };
  if (random <= 350) return { id: ItemIds.WILLOW_SEED, name: "willow" };
  if (random <= 400) return { id: ItemIds.MAPLE_SEED, name: "maple" };
  if (random <= 430) return { id: ItemIds.YEW_SEED, name: "yew" };
  if (random <= 440) return { id: ItemIds.MAGIC_SEED, name: "magic" };
  if (random <= 600) return { id: ItemIds.APPLE_TREE_SEED, name: "apple" };
  if (random <= 700) return { id: ItemIds.BANANA_TREE_SEED, name: "banana" };
  if (random <= 790) return { id: ItemIds.ORANGE_TREE_SEED, name: "orange" };
  if (random <= 850) return { id: ItemIds.CURRY_TREE_SEED, name: "curry" };
  if (random <= 900) return { id: ItemIds.PINEAPPLE_SEED, name: "pineapple" };
  if (random <= 930) return { id: ItemIds.PAPAYA_TREE_SEED, name: "papaya" };
  if (random <= 960) return { id: ItemIds.PALM_TREE_SEED, name: "palm" };
  if (random <= 980) return { id: ItemIds.CALQUAT_TREE_SEED, name: "calquat" };
  return { id: ItemIds.SPIRIT_SEED, name: "spirit" };
}

function rollNestRing() {
  const random = randomIntInclusive(1, 100);
  if (random <= 35) return { id: ItemIds.GOLD_RING, name: "gold" };
  if (random <= 75) return { id: ItemIds.SAPPHIRE_RING, name: "sapphire" };
  if (random <= 90) return { id: ItemIds.EMERALD_RING, name: "emerald" };
  if (random <= 98) return { id: ItemIds.RUBY_RING, name: "ruby" };
  return { id: ItemIds.DIAMOND_RING, name: "diamond" };
}

function searchBirdNest(player, nestId) {
  if (!SEARCHABLE_NEST_IDS.has(nestId)) {
    return false;
  }

  if (player.getInventory().getFreeSlots() <= 0) {
    player
      .getPacketSender()
      .sendMessage("Your inventory is too full to search the bird's nest.");
    return true;
  }

  player.getInventory().deleteNumber(nestId, 1);
  player.getInventory().adds(BIRD_NESTS.EMPTY_NEST, 1);

  if (nestId === BIRD_NESTS.SEED_NEST) {
    const seed = rollNestSeed();
    player.getInventory().adds(seed.id, 1);
    player
      .getPacketSender()
      .sendMessage(`You take a ${seed.name} seed out of the bird's nest.`);
    return true;
  }

  if (nestId === BIRD_NESTS.RING_NEST) {
    const ring = rollNestRing();
    player.getInventory().adds(ring.id, 1);
    player
      .getPacketSender()
      .sendMessage(`You take a ${ring.name} ring out of the bird's nest.`);
    return true;
  }

  const eggId =
    nestId === BIRD_NESTS.RED_EGG_NEST
      ? ItemIds.BIRDS_EGG
      : nestId === BIRD_NESTS.GREEN_EGG_NEST
        ? ItemIds.BIRDS_EGG_3
        : ItemIds.BIRDS_EGG_2;
  player.getInventory().adds(eggId, 1);
  player
    .getPacketSender()
    .sendMessage("You take the bird's egg out of the bird's nest.");
  return true;
}

function stopWoodcutting(activeSessions, player, resetAnimation = true) {
  if (!activeSessions.has(player)) {
    return;
  }
  activeSessions.delete(player);
  if (resetAnimation) {
    player.performAnimation(Animation.DEFAULT_RESET_ANIMATION);
  }
}

class TreeRespawnTask extends Task {
  constructor(delayTicks, originalTreeObject, stumpObject) {
    super(Math.max(1, delayTicks));
    this.originalTreeObject = originalTreeObject;
    this.stumpObject = stumpObject;
  }

  execute() {
    const existingStump = MapObjects.get(
      this.stumpObject.getId(),
      this.stumpObject.getLocation(),
      this.stumpObject.getPrivateArea()
    );
    if (existingStump) {
      ObjectManager.deregister(existingStump, true);
    }

    // Always re-register the original tree so clients receive an explicit spawn
    // update, even if cache-backed map objects can still resolve this id/location.
    ObjectManager.register(this.originalTreeObject, true);

    this.stop();
  }
}

function depleteTree(treeObject, tree) {
  const stump = new GameObject(
    TREE_STUMP_OBJECT_ID,
    treeObject.getLocation().clone(),
    treeObject.getType(),
    treeObject.getFace(),
    treeObject.getPrivateArea()
  );
  ObjectManager.deregister(treeObject, true);
  ObjectManager.register(stump, true);
  TaskManager.submit(new TreeRespawnTask(tree.respawnTicks, treeObject, stump));
}

function startWoodcutting(player, treeObject, tree, activeSessions) {
  const axe = findBestUsableAxe(player);
  if (!axe) {
    player
      .getPacketSender()
      .sendMessage("You don't have an axe which you can use.");
    return false;
  }

  const woodcuttingLevel = getWoodcuttingLevel(player);
  if (woodcuttingLevel < tree.requiredLevel) {
    player
      .getPacketSender()
      .sendMessage(
        `You need a Woodcutting level of at least ${tree.requiredLevel} to cut this tree.`
      );
    return false;
  }

  if (player.getInventory().isFull()) {
    player.getInventory().full();
    return false;
  }

  const location = treeObject.getLocation().clone();
  const existingTree = MapObjects.get(
    treeObject.getId(),
    location,
    treeObject.getPrivateArea()
  );
  if (!existingTree) {
    player
      .getPacketSender()
      .sendMessage("You can't reach that tree right now.");
    return false;
  }

  player.getSkillManager()?.stopSkillable?.();
  stopWoodcutting(activeSessions, player, false);
  player.getCombat()?.reset?.();

  activeSessions.set(player, {
    tree,
    axe,
    objectId: treeObject.getId(),
    location,
    privateArea: treeObject.getPrivateArea(),
    cyclesUntilReward: calculateCyclesRequired(player, tree, axe),
    nextActionTick: woodcuttingTick + WOODCUTTING_ACTION_INTERVAL_TICKS,
    nextAnimationTick: woodcuttingTick + CHOP_ANIMATION_INTERVAL_TICKS,
  });

  player.getPacketSender().sendMessage("You swing your axe at the tree..");
  player.performAnimation(new Animation(axe.animationId));
  return true;
}

function processWoodcuttingTick(activeSessions, currentTick) {
  for (const [player, state] of activeSessions) {
    if (!player || !player.isRegistered() || player.getHitpoints() <= 0) {
      activeSessions.delete(player);
      continue;
    }

    if (player.getForceMovement() != null) {
      continue;
    }

    if (player.getMovementQueue()?.size?.() > 0) {
      stopWoodcutting(activeSessions, player);
      continue;
    }

    const activeTree = MapObjects.get(
      state.objectId,
      state.location,
      state.privateArea
    );
    if (!activeTree) {
      stopWoodcutting(activeSessions, player);
      continue;
    }

    if (
      !player.getLocation().isWithinInteractionDistance(activeTree.getLocation())
    ) {
      stopWoodcutting(activeSessions, player);
      continue;
    }

    const axe = findBestUsableAxe(player);
    if (!axe) {
      player
        .getPacketSender()
        .sendMessage("You don't have an axe which you can use.");
      stopWoodcutting(activeSessions, player);
      continue;
    }

    const woodcuttingLevel = getWoodcuttingLevel(player);
    if (woodcuttingLevel < axe.requiredLevel) {
      player
        .getPacketSender()
        .sendMessage(
          "You don't have an axe which you have the required Woodcutting level to use."
        );
      stopWoodcutting(activeSessions, player);
      continue;
    }

    if (woodcuttingLevel < state.tree.requiredLevel) {
      player
        .getPacketSender()
        .sendMessage(
          `You need a Woodcutting level of at least ${state.tree.requiredLevel} to cut this tree.`
        );
      stopWoodcutting(activeSessions, player);
      continue;
    }

    state.axe = axe;

    if (player.getInventory().isFull()) {
      player.getInventory().full();
      stopWoodcutting(activeSessions, player);
      continue;
    }

    if (currentTick >= state.nextAnimationTick) {
      player.performAnimation(new Animation(state.axe.animationId));
      state.nextAnimationTick = currentTick + CHOP_ANIMATION_INTERVAL_TICKS;
    }

    if (currentTick < state.nextActionTick) {
      continue;
    }
    state.nextActionTick = currentTick + WOODCUTTING_ACTION_INTERVAL_TICKS;
    state.cyclesUntilReward--;
    if (state.cyclesUntilReward > 0) {
      continue;
    }

    player.getInventory().adds(state.tree.logId, 1);
    player.getPacketSender().sendMessage("You get some logs.");
    player.getSkillManager().addExperiences(Skill.WOODCUTTING, state.tree.xpReward);
    Pets.onSkill(player, Skill.WOODCUTTING);
    maybeDropBirdNest(player);

    if (shouldDepleteTree(state.tree)) {
      Sounds.sendSound(player, Sound.WOODCUTTING_TREE_DOWN);
      depleteTree(activeTree, state.tree);
      stopWoodcutting(activeSessions, player);
      continue;
    }

    state.cyclesUntilReward = calculateCyclesRequired(
      player,
      state.tree,
      state.axe
    );
  }
}

class WoodcuttingTask extends Task {
  constructor(activeSessions) {
    super(1);
    this.activeSessions = activeSessions;
    this.currentTick = 0;
  }

  execute() {
    this.currentTick++;
    woodcuttingTick = this.currentTick;
    processWoodcuttingTick(this.activeSessions, this.currentTick);
  }
}

let TaskManager;
let ObjectManager;
let ItemOnGroundManager;

function handleChop(event) {
  const tree = TREES_BY_NAME.get(event.definition.getName());
  if (!tree) {
    return;
  }

  startWoodcutting(event.player, event.object, tree, activeSessionsRef);

  // Tree clicks are fully handled by this plugin (including fail messages).
  event.handled = true;
}

module.exports = {
  name: "Woodcutting",
  register(api) {
    TaskManager = api.getTaskManager();
    ObjectManager = api.getObjectManager();
    ItemOnGroundManager = api.getItemOnGroundManager();
    const activeSessions = new Map();
    activeSessionsRef = activeSessions;

    TaskManager.submit(new WoodcuttingTask(activeSessions));

    api.onPlayerDisconnect(({ player }) => {
      stopWoodcutting(activeSessions, player, false);
    });
    api.onPlayerLevelUp(({ player }) => {
      stopWoodcutting(activeSessions, player, false);
    });

    api.onItemFirstAction((event) => {
      if (searchBirdNest(event.player, event.itemId)) {
        event.handled = true;
        return true;
      }
      return false;
    });

    for (const tree of TREES) {
      for (const name of tree.objectNames) {
        api.onObjectInteraction(name, { [tree.action]: handleChop });
      }
    }

    api.log("registered", {
      treeNames: TREES_BY_NAME.size,
      supportedTrees: TREES.length,
      axes: AXES.length,
    });
  },
  AXES,
  AXES_BY_REQUIREMENT_DESC,
  TREES,
  TREE_LOG_IDS,
  findBestUsableAxe,
  findBestUsableAxeByLevel,
  isWoodcuttingActive,
};
