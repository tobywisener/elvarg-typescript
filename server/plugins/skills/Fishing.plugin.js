const { Task } = require("../../src/main/typescript/elvarg/game/task/Task");
const { Skill } = require("../../src/main/typescript/elvarg/game/model/Skill");
const { Animation } = require("../../src/main/typescript/elvarg/game/model/Animation");
const { Item } = require("../../src/main/typescript/elvarg/game/model/Item");
const { Chance } = require("../../src/main/typescript/elvarg/util/Chance");
const { Misc } = require("../../src/main/typescript/elvarg/util/Misc");
const { Sound } = require("../../src/main/typescript/elvarg/game/Sound");
const { Sounds } = require("../../src/main/typescript/elvarg/game/Sounds");
const { ItemIds, NpcIds } = require("../../src/main/typescript/elvarg/util/IdEnums");

const FISHING_ACTION_INTERVAL_TICKS = 5;
const FISHING_ANIMATION_INTERVAL_TICKS = 5;
let fishingTick = 0;

class Fish {
  constructor(id, level, chance, experience, name) {
    this.id = id;
    this.level = level;
    this.chance = chance;
    this.experience = experience;
    this.name = name;
  }
}

class FishingTool {
  constructor(id, level, needed, speed, animationId, fish) {
    this.id = id;
    this.level = level;
    this.needed = needed;
    this.speed = speed;
    this.animationId = animationId;
    this.fish = fish;
  }
}

const FISH = Object.freeze({
  SHRIMP: new Fish(ItemIds.RAW_SHRIMPS, 1, Chance.VERY_COMMON, 10, "shrimp"),
  ANCHOVY: new Fish(ItemIds.RAW_ANCHOVIES, 15, Chance.SOMETIMES, 40, "anchovy"),
  SARDINE: new Fish(ItemIds.RAW_SARDINE, 5, Chance.VERY_COMMON, 20, "sardine"),
  HERRING: new Fish(ItemIds.RAW_HERRING, 10, Chance.VERY_COMMON, 30, "herring"),
  TROUT: new Fish(ItemIds.RAW_TROUT, 20, Chance.VERY_COMMON, 50, "trout"),
  SALMON: new Fish(ItemIds.RAW_SALMON, 30, Chance.VERY_COMMON, 70, "salmon"),
  TUNA: new Fish(ItemIds.RAW_TUNA, 35, Chance.VERY_COMMON, 80, "tuna"),
  LOBSTER: new Fish(ItemIds.RAW_LOBSTER, 40, Chance.VERY_COMMON, 90, "lobster"),
  SWORDFISH: new Fish(ItemIds.RAW_SWORDFISH, 50, Chance.COMMON, 100, "swordfish"),
  SHARK: new Fish(ItemIds.RAW_SHARK, 76, Chance.COMMON, 110, "shark"),
});

const TOOLS = Object.freeze({
  NET: new FishingTool(ItemIds.SMALL_FISHING_NET, 1, -1, 3, 621, [
    FISH.SHRIMP,
    FISH.ANCHOVY,
  ]),
  FISHING_ROD: new FishingTool(
    ItemIds.FISHING_ROD,
    5,
    ItemIds.FISHING_BAIT,
    1,
    622,
    [FISH.SARDINE, FISH.HERRING]
  ),
  FLY_FISHING_ROD: new FishingTool(
    ItemIds.FLY_FISHING_ROD,
    20,
    ItemIds.FEATHER,
    1,
    622,
    [FISH.TROUT, FISH.SALMON]
  ),
  HARPOON: new FishingTool(ItemIds.HARPOON, 35, -1, 4, 618, [
    FISH.TUNA,
    FISH.SWORDFISH,
  ]),
  SHARK_HARPOON: new FishingTool(ItemIds.HARPOON, 76, -1, 6, 618, [
    FISH.SHARK,
  ]),
  LOBSTER_POT: new FishingTool(ItemIds.LOBSTER_POT, 40, -1, 4, 619, [
    FISH.LOBSTER,
  ]),
});

const SPOT_TOOL_BY_NPC_AND_CLICK = new Map();

function addSpotTool(npcId, clickType, tool) {
  SPOT_TOOL_BY_NPC_AND_CLICK.set(`${npcId}:${clickType}`, tool);
}

const FISH_SPOT_ROD_BAIT_IDS = [NpcIds.FISHING_SPOT_2, NpcIds.FISHING_SPOT_3];
for (const npcId of FISH_SPOT_ROD_BAIT_IDS) {
  addSpotTool(npcId, 1, TOOLS.NET);
  addSpotTool(npcId, 2, TOOLS.FISHING_ROD);
}

const FISH_SPOT_CAGE_HARPOON_IDS = [NpcIds.FISHING_SPOT_11, NpcIds.FISHING_SPOT_10];
for (const npcId of FISH_SPOT_CAGE_HARPOON_IDS) {
  addSpotTool(npcId, 1, TOOLS.LOBSTER_POT);
  addSpotTool(npcId, 2, TOOLS.HARPOON);
}
const FISHING_SPOT_NPC_IDS = Object.freeze(
  Array.from(
    new Set(
      Array.from(SPOT_TOOL_BY_NPC_AND_CLICK.keys()).map((key) =>
        Number.parseInt(key.split(":", 1)[0], 10)
      )
    )
  )
);

function getFishingLevel(player) {
  return player.getSkillManager().getCurrentLevel(Skill.FISHING);
}

function hasToolRequirements(player, tool) {
  const level = getFishingLevel(player);
  if (level < tool.level) {
    player
      .getPacketSender()
      .sendMessage(`You need a Fishing level of at least ${tool.level} to do this.`);
    return false;
  }

  if (!player.getInventory().contains(tool.id)) {
    player.getPacketSender().sendMessage("You don't have the right tool to fish there.");
    return false;
  }

  if (tool.needed > 0 && !player.getInventory().contains(tool.needed)) {
    player.getPacketSender().sendMessage("You do not have the required bait.");
    return false;
  }

  return true;
}

function stopFishing(activeSessions, player, resetAnimation = true) {
  if (!activeSessions.has(player)) {
    return;
  }
  activeSessions.delete(player);
  if (resetAnimation) {
    player.performAnimation(Animation.DEFAULT_RESET_ANIMATION);
  }
}

function cyclesRequired(player) {
  let cycles = 4 + Misc.getRandom(2);
  cycles -= getFishingLevel(player) * 0.03;
  const tickBudget = Math.max(3, Math.floor(cycles));
  return Math.max(1, Math.ceil(tickBudget / FISHING_ACTION_INTERVAL_TICKS));
}

function determineFish(player, tool) {
  const level = getFishingLevel(player);
  const available = tool.fish.filter((fish) => fish.level <= level);
  if (available.length === 0) {
    return null;
  }

  const rarityFiltered = available.filter((fish) => fish.chance.success());
  if (rarityFiltered.length === 0) {
    return available[Misc.getRandom(available.length - 1)];
  }
  return rarityFiltered[Misc.getRandom(rarityFiltered.length - 1)];
}

function startFishing(player, npc, clickType, activeSessions) {
  const tool = SPOT_TOOL_BY_NPC_AND_CLICK.get(`${npc.getId()}:${clickType}`);
  if (!tool) {
    return false;
  }

  if (!hasToolRequirements(player, tool)) {
    return true;
  }

  if (player.getInventory().isFull()) {
    player.getInventory().full();
    return true;
  }

  stopFishing(activeSessions, player, false);

  activeSessions.set(player, {
    npcIndex: npc.getIndex(),
    npcId: npc.getId(),
    tool,
    cyclesUntilCatch: cyclesRequired(player),
    nextAnimationTick: fishingTick + FISHING_ANIMATION_INTERVAL_TICKS,
    nextCatchTick: fishingTick + FISHING_ACTION_INTERVAL_TICKS,
  });

  player.getPacketSender().sendMessage("You begin to fish..");
  Sounds.sendSound(player, Sound.FISHING_FISH);
  player.performAnimation(new Animation(tool.animationId));
  return true;
}

class FishingTask extends Task {
  constructor(activeSessions) {
    super(1);
    this.activeSessions = activeSessions;
    this.cycle = 0;
  }

  execute() {
    this.cycle++;
    fishingTick = this.cycle;

    for (const [player, session] of this.activeSessions) {
      if (!player || !player.isRegistered() || player.getHitpoints() <= 0) {
        this.activeSessions.delete(player);
        continue;
      }

      if (player.getMovementQueue().size() > 0 || player.getForceMovement() != null) {
        stopFishing(this.activeSessions, player);
        continue;
      }

      const npc = World.getNpcs().get(session.npcIndex);
      if (!npc || npc.getId() !== session.npcId) {
        stopFishing(this.activeSessions, player);
        continue;
      }

      if (!player.getLocation().isWithinDistance(npc.getLocation(), 2)) {
        stopFishing(this.activeSessions, player);
        continue;
      }

      if (!hasToolRequirements(player, session.tool)) {
        stopFishing(this.activeSessions, player);
        continue;
      }

      if (player.getInventory().isFull()) {
        player.getInventory().full();
        stopFishing(this.activeSessions, player);
        continue;
      }

      if (this.cycle >= session.nextAnimationTick) {
        Sounds.sendSound(player, Sound.FISHING_FISH);
        player.performAnimation(new Animation(session.tool.animationId));
        session.nextAnimationTick = this.cycle + FISHING_ANIMATION_INTERVAL_TICKS;
      }

      if (this.cycle < session.nextCatchTick) {
        continue;
      }
      session.nextCatchTick = this.cycle + FISHING_ACTION_INTERVAL_TICKS;
      session.cyclesUntilCatch--;
      if (session.cyclesUntilCatch > 0) {
        continue;
      }

      const fish = determineFish(player, session.tool);
      if (fish) {
        player.getInventory().addItem(new Item(fish.id, 1));
        player.getPacketSender().sendMessage(`You catch a ${fish.name}.`);
        player.getSkillManager().addExperiences(Skill.FISHING, fish.experience);
        pluginApi.emitCustomEvent("fishing:success", { player, skill: Skill.FISHING });
      }

      if (session.tool.needed > 0) {
        player.getInventory().deleteNumber(session.tool.needed, 1);
      }

      if (Misc.getRandom(90) === 0) {
        stopFishing(this.activeSessions, player);
        continue;
      }

      session.cyclesUntilCatch = cyclesRequired(player);
    }
  }
}

let TaskManager;
let World;
let pluginApi;

module.exports = {
  name: "Fishing",
  register(api) {
    pluginApi = api;
    TaskManager = api.getTaskManager();
    World = api.getWorld();
    const activeSessions = new Map();
    TaskManager.submit(new FishingTask(activeSessions));

    api.onPlayerDisconnect(({ player }) => {
      stopFishing(activeSessions, player, false);
    });
    api.onPlayerLevelUp(({ player }) => {
      stopFishing(activeSessions, player, false);
    });

    function startFishingInteraction(event) {
      const started = startFishing(
        event.player,
        event.npc,
        event.clickType,
        activeSessions
      );
      if (started) {
        event.handled = true;
      }
      return started;
    }
    api.onNpcClick(FISHING_SPOT_NPC_IDS, 1, startFishingInteraction);
    api.onNpcClick(FISHING_SPOT_NPC_IDS, 2, startFishingInteraction);

    api.log("registered", {
      fishingSpotMappings: SPOT_TOOL_BY_NPC_AND_CLICK.size,
      tools: Object.keys(TOOLS).length,
    });
  },
  TOOLS,
  FISH,
};
