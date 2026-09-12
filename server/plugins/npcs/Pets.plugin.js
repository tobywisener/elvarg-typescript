const { NPC } = require("../../src/main/typescript/elvarg/game/entity/impl/npc/NPC");
const { Animation } = require("../../src/main/typescript/elvarg/game/model/Animation");
const { Item } = require("../../src/main/typescript/elvarg/game/model/Item");
const { Sound } = require("../../src/main/typescript/elvarg/game/Sound");
const { Sounds } = require("../../src/main/typescript/elvarg/game/Sounds");
const { Skill } = require("../../src/main/typescript/elvarg/game/model/Skill");
const { Bank } = require("../../src/main/typescript/elvarg/game/model/container/impl/Bank");
const { Misc } = require("../../src/main/typescript/elvarg/util/Misc");
const {NpcIdentifiers} = require("../../src/main/typescript/elvarg/util/NpcIdentifiers");

const INTERACTION_ANIM = new Animation(827);
let pluginApi = null;

const PETS = [
  { enumName: "DARK_CORE", petId: 318, morphId: 0, itemId: 12816, dialogue: 123 },
  { enumName: "VENENATIS_SPIDERLING", petId: 495, morphId: 0, itemId: 13177, dialogue: 126 },
  { enumName: "CALLISTO_CUB", petId: 497, morphId: 0, itemId: 13178, dialogue: 130 },
  {
    enumName: "HELLPUPPY",
    // 317 clients reliably render the legacy hellcat model id.
    petId: 1625,
    morphId: 0,
    itemId: 13247,
    dialogue: 138,
    getDialogue() {
      const ids = [138, 143, 145, 150, 154];
      return ids[Misc.getRandom(ids.length - 1)];
    },
  },
  { enumName: "CHAOS_ELEMENTAL_JR", petId: 2055, morphId: 0, itemId: 11995, dialogue: 158 },
  { enumName: "SNAKELING", petId: 2130, morphId: 2131, itemId: 12921, dialogue: 162 },
  { enumName: "MAGMA_SNAKELING", petId: 2131, morphId: 2132, itemId: 12921, dialogue: 169 },
  { enumName: "TANZANITE_SNAKELING", petId: 2132, morphId: 2130, itemId: 12921, dialogue: 176 },
  { enumName: "VETION_JR", petId: 5536, morphId: 5537, itemId: 13179, dialogue: 183 },
  { enumName: "VETION_JR_REBORN", petId: 5537, morphId: 5536, itemId: 13179, dialogue: 189 },
  { enumName: "SCORPIAS_OFFSPRING", petId: 5561, morphId: 0, itemId: 13181, dialogue: 195 },
  {
    enumName: "ABYSSAL_ORPHAN",
    petId: 5884,
    morphId: 0,
    itemId: 13262,
    dialogue: 202,
    getDialogue(player) {
      if (!player?.getAppearance?.()?.isMale?.()) {
        return 206;
      }
      const ids = [202, 209];
      return ids[Misc.getRandom(ids.length - 1)];
    },
  },
  {
    enumName: "TZREK_JAD",
    petId: 5892,
    morphId: 0,
    itemId: 13225,
    dialogue: 212,
    getDialogue() {
      const ids = [212, 217];
      return ids[Misc.getRandom(ids.length - 1)];
    },
  },
  { enumName: "SUPREME_HATCHLING", petId: 6628, morphId: 0, itemId: 12643, dialogue: 220 },
  { enumName: "PRIME_HATCHLING", petId: 6629, morphId: 0, itemId: 12644, dialogue: 223 },
  { enumName: "REX_HATCHLING", petId: 6630, morphId: 0, itemId: 12645, dialogue: 231 },
  { enumName: "CHICK_ARRA", petId: 6631, morphId: 0, itemId: 12649, dialogue: 239 },
  { enumName: "GENERAL_AWWDOR", petId: 6632, morphId: 0, itemId: 12650, dialogue: 247 },
  {
    enumName: "COMMANDER_MINIANA",
    petId: 6633,
    morphId: 0,
    itemId: 12651,
    dialogue: 250,
    getDialogue(player) {
      if (player?.getEquipment?.()?.contains?.(11806)) {
        return 252;
      }
      return 250;
    },
  },
  { enumName: "KRIL_TINYROTH", petId: 6634, morphId: 0, itemId: 12652, dialogue: 254 },
  { enumName: "BABY_MOLE", petId: 6635, morphId: 0, itemId: 12646, dialogue: 261 },
  { enumName: "PRINCE_BLACK_DRAGON", petId: 6636, morphId: 0, itemId: 12653, dialogue: 267 },
  { enumName: "KALPHITE_PRINCESS", petId: 6637, morphId: 6638, itemId: 12654, dialogue: 271 },
  {
    enumName: "MORPHED_KALPHITE_PRINCESS",
    petId: 6638,
    morphId: 6637,
    itemId: 12654,
    dialogue: 279,
  },
  { enumName: "SMOKE_DEVIL", petId: 6639, morphId: 0, itemId: 12648, dialogue: 288 },
  { enumName: "KRAKEN", petId: 6640, morphId: 0, itemId: 12655, dialogue: 291 },
  { enumName: "PENANCE_PRINCESS", petId: 6642, morphId: 0, itemId: 12703, dialogue: 296 },
  { enumName: "OLMLET", petId: 7520, morphId: 0, itemId: 20851, dialogue: 298 },
  { enumName: "SKOTOS", petId: 425, morphId: 0, itemId: 21273, dialogue: 298 },

  { enumName: "HERON", petId: 6715, morphId: 0, itemId: 13320, dialogue: -1, skill: Skill.FISHING, chance: 5000 },
  {
    enumName: "BEAVER",
    petId: 6717,
    morphId: 0,
    itemId: 13322,
    dialogue: -1,
    skill: Skill.WOODCUTTING,
    chance: 5000,
  },
  {
    enumName: "GREY_CHINCHOMPA",
    petId: 6719,
    morphId: 6720,
    itemId: 13324,
    dialogue: -1,
    skill: Skill.HUNTER,
    chance: 3000,
  },
  {
    enumName: "RED_CHINCHOMPA",
    petId: 6718,
    morphId: 6719,
    itemId: 13323,
    dialogue: -1,
    skill: Skill.HUNTER,
    chance: 4000,
  },
  {
    enumName: "BLACK_CHINCHOMPA",
    petId: 6720,
    morphId: 6718,
    itemId: 13325,
    dialogue: -1,
    skill: Skill.HUNTER,
    chance: 5000,
  },
  {
    enumName: "ROCK_GOLEM",
    petId: NpcIdentifiers.ROCK_GOLEM_25,
    morphId: 0,
    itemId: 13321,
    dialogue: -1,
    skill: Skill.MINING,
    chance: 5000,
  },
  {
    enumName: "GIANT_SQUIRREL",
    petId: 7334,
    morphId: 0,
    itemId: 20659,
    dialogue: -1,
    skill: Skill.AGILITY,
    chance: 5000,
  },
  {
    enumName: "TANGLEROOT",
    petId: 7335,
    morphId: 0,
    itemId: 0,
    dialogue: -1,
    skill: Skill.FARMING,
    chance: 5000,
  },
  {
    enumName: "ROCKY",
    petId: 7336,
    morphId: 0,
    itemId: 0,
    dialogue: -1,
    skill: Skill.THIEVING,
    chance: 5000,
  },

  {
    enumName: "FIRE_RIFT_GAURDIAN",
    petId: 7337,
    morphId: 7338,
    itemId: 20665,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "AIR_RIFT_GUARDIAN",
    petId: 7338,
    morphId: 7339,
    itemId: 20667,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "MIND_RIFT_GUARDIAN",
    petId: 7339,
    morphId: 7340,
    itemId: 20669,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "WATER_RIFT_GUARDIAN",
    petId: 7340,
    morphId: 7341,
    itemId: 20671,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "EARTH_RIFT_GUARDIAN",
    petId: 7341,
    morphId: 7342,
    itemId: 20673,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "BODY_RIFT_GUARDIAN",
    petId: 7342,
    morphId: 7343,
    itemId: 20675,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "COSMIC_RIFT_GUARDIAN",
    petId: 7343,
    morphId: 7344,
    itemId: 20677,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "CHAOS_RIFT_GUARDIAN",
    petId: 7344,
    morphId: 7345,
    itemId: 20679,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "NATURE_RIFT_GUARDIAN",
    petId: 7345,
    morphId: 7346,
    itemId: 20681,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "LAW_RIFT_GUARDIAN",
    petId: 7346,
    morphId: 7347,
    itemId: 20683,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "DEATH_RIFT_GUARDIAN",
    petId: 7347,
    morphId: 7348,
    itemId: 20685,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "SOUL_RIFT_GUARDIAN",
    petId: 7348,
    morphId: 7349,
    itemId: 20687,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "ASTRAL_RIFT_GUARDIAN",
    petId: 7349,
    morphId: 7350,
    itemId: 20689,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
  {
    enumName: "BLOOD_RIFT_GUARDIAN",
    petId: 7350,
    morphId: 7337,
    itemId: 20691,
    dialogue: -1,
    skill: Skill.RUNECRAFTING,
    chance: 8000,
  },
];

const PET_BY_ID = new Map();
const PET_BY_ITEM_ID = new Map();
const PET_BY_NAME = new Map();

for (const pet of PETS) {
  PET_BY_ID.set(pet.petId, pet);
  PET_BY_NAME.set(pet.enumName, pet);
  if (Number.isInteger(pet.itemId) && !PET_BY_ITEM_ID.has(pet.itemId)) {
    PET_BY_ITEM_ID.set(pet.itemId, pet);
  }
}

const SKILLING_PETS = [
  PET_BY_NAME.get("HERON"),
  PET_BY_NAME.get("BEAVER"),
  PET_BY_NAME.get("GREY_CHINCHOMPA"),
  PET_BY_NAME.get("RED_CHINCHOMPA"),
  PET_BY_NAME.get("BLACK_CHINCHOMPA"),
  PET_BY_NAME.get("ROCK_GOLEM"),
  PET_BY_NAME.get("GIANT_SQUIRREL"),
  PET_BY_NAME.get("TANGLEROOT"),
  PET_BY_NAME.get("ROCKY"),
].filter((pet) => pet != null);

function getPetByNpcId(id) {
  return PET_BY_ID.get(id) ?? null;
}

function getPetForItemId(itemId) {
  return PET_BY_ITEM_ID.get(itemId) ?? null;
}

function getPetDialogue(pet, player) {
  if (!pet) {
    return -1;
  }
  if (typeof pet.getDialogue === "function") {
    return pet.getDialogue(player);
  }
  return pet.dialogue;
}

function getPetDisplayName(pet) {
  if (!pet) {
    return "pet";
  }
  return Misc.capitalizeWords(pet.enumName.toLowerCase().replace(/_/g, " "));
}

function normalizeSkillName(skill) {
  const skillName =
    skill?.getName?.() ??
    skill?.name ??
    (typeof skill === "number" && typeof Skill?.[skill] === "string" ? Skill[skill] : null);
  if (typeof skillName === "string" && skillName.length > 0) {
    return skillName.toLowerCase().replace(/_/g, " ");
  }
  if (typeof skill === "number" && typeof Skill?.[skill] === "string") {
    return Skill[skill].toLowerCase().replace(/_/g, " ");
  }
  return String(skill).toLowerCase().replace(/_/g, " ");
}

function log(event, extra = {}) {
  if (pluginApi && typeof pluginApi.log === "function") {
    pluginApi.log(event, extra);
    return;
  }
  try {
    console.log(`[plugin:Pets] ${event}`, extra);
  } catch {
    // Best-effort logging only.
  }
}

function chooseSpawnLocation(player) {
  const tiles = [];
  const outterTiles = player?.outterTiles?.() ?? [];
  for (const tile of outterTiles) {
    if (RegionManager.blocked(tile, player.getPrivateArea())) {
      continue;
    }
    tiles.push(tile);
  }
  if (tiles.length === 0) {
    return player.getLocation().clone();
  }
  return tiles[Misc.getRandom(tiles.length - 1)];
}

function canSummonPetHere(player, reward) {
  if (reward) {
    return true;
  }
  const area = player.getArea?.();
  if (!area || typeof area.allowSummonPet !== "function") {
    return true;
  }
  return area.allowSummonPet(player) !== false;
}

function findOwnedPetItemSource(player) {
  if (!player) {
    return null;
  }

  const petItems = Array.from(PET_BY_ITEM_ID.values()).filter(
    (pet) => Number.isInteger(pet?.itemId) && pet.itemId > 0
  );

  const inventory = player.getInventory?.();
  for (const pet of petItems) {
    if (inventory?.contains?.(pet.itemId)) {
      return { itemId: pet.itemId, source: "inventory", bankTab: -1 };
    }
  }

  const banks = player.getBanks?.() ?? [];
  for (let tab = 0; tab < Bank.TOTAL_BANK_TABS; tab++) {
    if (tab === Bank.BANK_SEARCH_TAB_INDEX) {
      continue;
    }
    const bank = banks[tab];
    if (!bank) {
      continue;
    }
    for (const pet of petItems) {
      if (bank.contains?.(pet.itemId)) {
        return { itemId: pet.itemId, source: "bank", bankTab: tab };
      }
    }
  }

  return null;
}

function summonOwnedPetOnBotLogin(player) {
  if (!player?.isPlayerBot?.() || !player.isPlayerBot()) {
    return false;
  }
  if (player.getCurrentPet?.()) {
    return false;
  }

  const ownedPet = findOwnedPetItemSource(player);
  if (!ownedPet) {
    return false;
  }

  // Use reward summon path to avoid interaction-side effects while auto-restoring bots.
  const summoned = drop(player, ownedPet.itemId, true);
  if (!summoned) {
    return false;
  }

  if (ownedPet.source === "inventory") {
    player.getInventory().deleteNumber(ownedPet.itemId, 1);
  } else {
    player.getBank(ownedPet.bankTab).deleteNumber(ownedPet.itemId, 1);
  }
  return true;
}

function spawnPetNpc(npc) {
  if (World.getNpcs().add(npc)) {
    return {
      mode: "direct",
      alreadyQueued: false,
      addNpcQueueSize: World.getAddNPCQueue().length,
    };
  }

  const addQueue = World.getAddNPCQueue();
  const alreadyQueued = addQueue.includes(npc);
  if (!alreadyQueued) {
    addQueue.push(npc);
  }

  return {
    mode: "queued",
    alreadyQueued,
    addNpcQueueSize: addQueue.length,
  };
}

function despawnPetNpc(npc) {
  if (!npc) {
    return {
      removedFromAddQueue: false,
      queuedForRemoval: false,
      registered: false,
    };
  }

  const addQueue = World.getAddNPCQueue();
  let removedFromAddQueue = false;
  for (let index = addQueue.indexOf(npc); index !== -1; index = addQueue.indexOf(npc)) {
    addQueue.splice(index, 1);
    removedFromAddQueue = true;
  }

  let queuedForRemoval = false;
  const registered = typeof npc.isRegistered === "function" ? npc.isRegistered() : false;
  if (registered) {
    const removeQueue = World.getRemoveNPCQueue();
    if (!removeQueue.includes(npc)) {
      removeQueue.push(npc);
      queuedForRemoval = true;
    }
  }

  return {
    removedFromAddQueue,
    queuedForRemoval,
    registered,
  };
}

function drop(player, itemId, reward) {
  const username = player?.getUsername?.() ?? null;
  const pet = getPetForItemId(itemId);
  if (!pet) {
    log("drop_not_pet_item", { username, itemId, reward });
    return false;
  }

  const existingPet = player.getCurrentPet?.();
  if (existingPet && !existingPet.isRegistered?.()) {
    log("drop_clear_stale_current_pet", {
      username,
      itemId,
      stalePetId: existingPet.getId?.() ?? null,
    });
    player.setCurrentPet?.(null);
  }

  if (!player.getCurrentPet()) {
    if (!canSummonPetHere(player, reward)) {
      log("drop_blocked_by_area", {
        username,
        itemId,
        petNpcId: pet.petId,
        area: player.getArea?.()?.getName?.() ?? null,
        reward,
      });
      return false;
    }

    const location = chooseSpawnLocation(player);
    const npc = NPC.create(pet.petId, location);
    npc.setPet(true);
    npc.setOwner(player);
    npc.setFollowing(player);
    npc.setMobileInteraction(player);
    npc.setArea(player.getArea());
    const spawnResult = spawnPetNpc(npc);
    log(spawnResult.mode === "direct" ? "drop_spawn_added" : "drop_spawn_queued", {
      username,
      itemId: pet.itemId,
      petNpcId: pet.petId,
      x: location.getX?.() ?? null,
      y: location.getY?.() ?? null,
      z: location.getZ?.() ?? null,
      addNpcQueueSize: spawnResult.addNpcQueueSize,
      spawnMode: spawnResult.mode,
      alreadyQueued: spawnResult.alreadyQueued,
      npcRegistered: npc.isRegistered?.() ?? null,
      npcIndex: npc.getIndex?.() ?? null,
    });

    player.setCurrentPet(npc);
    setTimeout(() => {
      const index = npc.getIndex?.() ?? -1;
      const inWorld = index > 0 ? World.getNpcs().get(index) === npc : false;
      log("drop_spawn_postcheck", {
        username,
        itemId: pet.itemId,
        petNpcId: pet.petId,
        spawnMode: spawnResult.mode,
        npcRegistered: npc.isRegistered?.() ?? null,
        npcIndex: index,
        inWorld,
        addNpcQueueSize: World.getAddNPCQueue().length,
        removeNpcQueueSize: World.getRemoveNPCQueue().length,
      });
    }, 1200);

    if (reward) {
      player.getPacketSender().sendMessage("You have a funny feeling like you're being followed.");
    } else {
      player.getInventory().deleteNumber(pet.itemId, 1);
      Sounds.sendSound(player, Sound.DROP_ITEM);
      player.getPacketSender().sendMessage("You drop your pet..");
      player.performAnimation(INTERACTION_ANIM);
      player.setPositionToFace(npc.getLocation());
    }
  } else if (reward) {
    if (!player.getInventory().isFull()) {
      player.getInventory().adds(pet.itemId, 1);
    } else {
      ItemOnGroundManager.registerNonGlobal(player, new Item(pet.itemId));
    }
    player.getPacketSender().sendMessage("@dre@You've received a pet!");
  } else {
    const currentPet = player.getCurrentPet();
    log("drop_already_has_pet", {
      username,
      itemId,
      currentPetId: currentPet?.getId?.() ?? null,
      currentPetRegistered: currentPet?.isRegistered?.() ?? null,
    });
    player.getPacketSender().sendMessage("You already have a pet following you.");
  }

  return true;
}

function pickup(player, npc) {
  if (!npc || !player?.getCurrentPet?.()) {
    return false;
  }

  const pet = getPetByNpcId(npc.getId());
  if (!pet) {
    return false;
  }

  if (player.getCurrentPet() !== npc) {
    return false;
  }

  player.getMovementQueue().reset();
  player.performAnimation(INTERACTION_ANIM);
  const despawnResult = despawnPetNpc(player.getCurrentPet());
  log("pickup_despawn", {
    username: player?.getUsername?.() ?? null,
    petNpcId: npc.getId?.() ?? null,
    petIndex: npc.getIndex?.() ?? null,
    removedFromAddQueue: despawnResult.removedFromAddQueue,
    queuedForRemoval: despawnResult.queuedForRemoval,
    registered: despawnResult.registered,
    addNpcQueueSize: World.getAddNPCQueue().length,
    removeNpcQueueSize: World.getRemoveNPCQueue().length,
  });

  if (!player.getInventory().isFull()) {
    player.getInventory().adds(pet.itemId, 1);
  } else {
    player.getBank(Bank.getTabForItem(player, pet.itemId)).adds(pet.itemId, 1);
  }

  player.getPacketSender().sendMessage("You pick up your pet..");
  Sounds.sendSound(player, Sound.PICK_UP_ITEM);
  player.setCurrentPet(null);
  return true;
}

function morph(player, npc) {
  if (!npc || !player?.getCurrentPet?.()) {
    return false;
  }

  const pet = getPetByNpcId(npc.getId());
  if (!pet) {
    return false;
  }

  if (player.getCurrentPet() !== npc) {
    return false;
  }

  if (pet.morphId !== 0) {
    npc.setNpcTransformationId(pet.morphId);
    player.getPacketSender().sendMessage("Your pet endures metamorphosis and transforms.");
  }
  return true;
}

function interact(player, npc) {
  if (!npc || !player?.getCurrentPet?.()) {
    return false;
  }

  const pet = getPetByNpcId(npc.getId());
  if (!pet) {
    return false;
  }

  if (getPetDialogue(pet, player) === -1) {
    return false;
  }

  if (player.getCurrentPet() !== npc) {
    return false;
  }

  // Dialogue handlers are still commented out in both Java and TS branches.
  return true;
}

function onSkill(player, skill) {
  for (const pet of SKILLING_PETS) {
    if (pet.skill !== skill) {
      continue;
    }
    if (Misc.getRandom(pet.chance) !== 1) {
      continue;
    }

    World.sendMessage(
      `@dre@${player.getUsername()} just found a stray ${getPetDisplayName(pet)} while ${normalizeSkillName(skill)}!`
    );
    drop(player, pet.itemId, true);
    return true;
  }
  return false;
}

let World;
let RegionManager;
let ItemOnGroundManager;

module.exports = {
  name: "Pets",
  register(api) {
    World = api.getWorld();
    RegionManager = api.getRegionManager();
    ItemOnGroundManager = api.getItemOnGroundManager();
    pluginApi = api;
    for (const skill of new Set(SKILLING_PETS.map((pet) => pet.skill))) {
      const eventName = `${normalizeSkillName(skill)}:success`;
      api.onCustomEvent(eventName, ({ player }) => onSkill(player, skill));
    }

    api.onItemDropPolicy((event) => {
      if (!event || !event.player) {
        return;
      }
      log("item_drop_event", {
        username: event.player.getUsername?.() ?? null,
        itemId: event.itemId,
        interfaceId: event.interfaceId,
        slot: event.slot,
      });
      if (drop(event.player, event.itemId, false)) {
        event.handled = true;
      }
    });

    function interactWithPet(event) {
      if (!event || !event.player || !event.npc) {
        return false;
      }
      if (event.clickType === 1) {
        if (interact(event.player, event.npc)) {
          event.handled = true;
          return true;
        }
        return false;
      }
      if (event.clickType === 2) {
        if (pickup(event.player, event.npc)) {
          event.handled = true;
          return true;
        }
        return false;
      }
      if (event.clickType === 3) {
        if (morph(event.player, event.npc)) {
          event.handled = true;
          return true;
        }
      }
      return false;
    }
    const petNpcIds = Array.from(PET_BY_ID.keys());
    api.onNpcFirstClick(petNpcIds, interactWithPet);
    api.onNpcSecondClick(petNpcIds, interactWithPet);
    api.onNpcThirdClick(petNpcIds, interactWithPet);

    api.onPlayerLogout(({ player }) => {
      pickup(player, player.getCurrentPet?.());
    });

    api.onPlayerDisconnect(({ player }) => {
      pickup(player, player.getCurrentPet?.());
    });

    api.onPlayerLogin(({ player }) => {
      summonOwnedPetOnBotLogin(player);
    });

    api.log("registered", {
      pets: PETS.length,
      skillingPets: SKILLING_PETS.length,
    });
  },
};
