const fs = require("fs");
const path = require("path");

function requireGameModule(modulePath) {
  const candidates = [
    path.resolve(process.cwd(), "src", "main", "typescript", "elvarg", modulePath),
    path.resolve(process.cwd(), "dist", modulePath),
  ];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

const getGameConstants = () =>
  requireGameModule(path.join("game", "GameConstants")).GameConstants;
const getItemDefinition = () =>
  requireGameModule(path.join("game", "definition", "ItemDefinition"))
    .ItemDefinition;
const getEquipmentType = () =>
  requireGameModule(path.join("game", "model", "EquipmentType"))
    .EquipmentType;
const getWeaponInterfaces = () =>
  requireGameModule(path.join("game", "content", "combat", "WeaponInterfaces"))
    .WeaponInterfaces;
const getItemIdentifiers = () =>
  requireGameModule(path.join("util", "ItemIdentifiers")).ItemIdentifiers;

const AVERNIC_TREADS_BONUSES = [
  5, 5, 5, 11, 15,
  21, 25, 25, 10, 10,
  4, 2, 1, 0,
];

function hydrateEquipmentType(raw) {
  const EquipmentType = getEquipmentType();
  if (raw && typeof raw.getSlot === "function") {
    return raw;
  }
  if (typeof raw === "string" && EquipmentType[raw] != null) {
    return EquipmentType[raw];
  }
  return EquipmentType.NONE;
}

function hydrateWeaponInterface(raw) {
  if (raw == null) {
    return null;
  }
  if (raw && typeof raw.getInterfaceId === "function") {
    return raw;
  }
  const WeaponInterfaces = getWeaponInterfaces();
  if (typeof raw === "string") {
    return WeaponInterfaces?.[raw] ?? null;
  }
  return null;
}

function getItemDefinitionsPath() {
  const GameConstants = getGameConstants();
  return path.resolve(
    process.cwd(),
    GameConstants.DEFINITIONS_DIRECTORY,
    "item-gameplay.json"
  );
}

function loadItemDefinitions() {
  const ItemDefinition = getItemDefinition();
  const filePath = getItemDefinitionsPath();
  const content = fs.readFileSync(filePath, "utf8");
  const rawDefs = JSON.parse(content);
  const defs = Array.isArray(rawDefs) ? rawDefs : Object.values(rawDefs);

  ItemDefinition.definitions.clear();

  let loaded = 0;
  let unresolvedWeaponInterfaces = 0;
  let mismatched = 0;
  for (const rawDef of defs) {
    if (!rawDef || typeof rawDef !== "object") {
      continue;
    }

    const id = rawDef.id;
    if (!Number.isInteger(id) || id < 0) {
      continue;
    }
    const def = ItemDefinition.forId(id);
    if ((rawDef.name || "").trim().toLowerCase() !== def.getName().trim().toLowerCase()) {
      mismatched++;
      continue;
    }
    def.equipmentType = hydrateEquipmentType(rawDef.equipmentType);
    def.weaponInterface = hydrateWeaponInterface(rawDef.weaponInterface);
    for (const property of [
      "doubleHanded", "sellable", "bloodMoneyValue", "highAlch",
      "lowAlch", "dropValue", "blockAnim", "standAnim", "walkAnim", "runAnim",
      "standTurnAnim", "turn180Anim", "turn90CWAnim", "turn90CCWAnim", "bonuses",
      "requirements",
    ]) {
      if (rawDef[property] !== undefined) def[property] = rawDef[property];
    }
    if (rawDef.weaponInterface != null && def.weaponInterface == null) {
      unresolvedWeaponInterfaces++;
    }

    loaded += 1;
  }

  ItemDefinition.forId(getItemIdentifiers().AVERNIC_TREADS).bonuses = AVERNIC_TREADS_BONUSES;

  return {
    filePath,
    loaded,
    total: ItemDefinition.definitions.size,
    unresolvedWeaponInterfaces,
    mismatched,
  };
}

module.exports = {
  name: "ItemDefinitionLoader",
  register(api) {
    const startedAt = Date.now();
    const result = loadItemDefinitions();
    api.log("loaded", {
      file: path.relative(process.cwd(), result.filePath),
      loaded: result.loaded,
      total: result.total,
      unresolvedWeaponInterfaces: result.unresolvedWeaponInterfaces,
      mismatched: result.mismatched,
      elapsedMs: Date.now() - startedAt,
    });
  },
};
