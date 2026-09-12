import * as fs from "fs";
import * as path from "path";
import { Boundary } from "../model/Boundary";
import { Location } from "../model/Location";

export type WorldZoneTag = "pvp" | "multi-combat" | "safe";

export interface WorldPosition {
    x: number;
    y: number;
    z: number;
}

export interface WorldZone {
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
    z?: number;
    tags: WorldZoneTag[];
}

export interface WorldDefinitionData {
    spawn: WorldPosition;
    zones: WorldZone[];
    disabledPlugins: string[];
    experienceMultiplier: number;
}

export class WorldDefinitionValidationError extends Error {}

type JsonObject = Record<string, unknown>;

const WORLD_FILE = path.resolve("data/definitions/world.json");

function object(value: unknown, label: string): JsonObject {
    if (!value || Array.isArray(value) || typeof value !== "object") {
        throw new WorldDefinitionValidationError(`${label} must be an object`);
    }
    return value as JsonObject;
}

function integer(source: JsonObject, key: string, label: string): number {
    const value = source[key];
    if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new WorldDefinitionValidationError(`${label}.${key} must be an integer`);
    }
    return value;
}

function positiveNumber(source: JsonObject, key: string, label: string): number {
    const value = source[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new WorldDefinitionValidationError(`${label}.${key} must be a positive number`);
    }
    return value;
}

function coordinate(source: JsonObject, key: string, label: string): number {
    const value = integer(source, key, label);
    if (value < 0 || value > 0x3fff) {
        throw new WorldDefinitionValidationError(`${label}.${key} is outside the world`);
    }
    return value;
}

function plane(source: JsonObject, label: string): number {
    const value = integer(source, "z", label);
    if (value < 0 || value > 3) {
        throw new WorldDefinitionValidationError(`${label}.z must be between 0 and 3`);
    }
    return value;
}

export function parseWorldPosition(value: unknown, label = "world spawn"): WorldPosition {
    const position = object(value, label);
    return {
        x: coordinate(position, "x", label),
        y: coordinate(position, "y", label),
        z: plane(position, label),
    };
}

const ZONE_BOUND_KEYS = ["minX", "maxX", "minY", "maxY", "z"] as const;

export function parseWorldZone(value: unknown, label = "world zone"): WorldZone {
    const zone = object(value, label);
    const bounded = ZONE_BOUND_KEYS.some((key) => zone[key] !== undefined);
    const parsed: WorldZone = bounded
        ? {
              minX: coordinate(zone, "minX", label),
              maxX: coordinate(zone, "maxX", label),
              minY: coordinate(zone, "minY", label),
              maxY: coordinate(zone, "maxY", label),
              z: plane(zone, label),
              tags: [],
          }
        : { tags: [] };
    if (bounded && (parsed.minX! > parsed.maxX! || parsed.minY! > parsed.maxY!)) {
        throw new WorldDefinitionValidationError(`${label} has reversed bounds`);
    }
    if (!Array.isArray(zone.tags)) {
        throw new WorldDefinitionValidationError(`${label}.tags must be a non-empty array`);
    }
    if (bounded && zone.tags.length === 0) {
        throw new WorldDefinitionValidationError(`${label}.tags must be a non-empty array`);
    }
    for (const tag of new Set(zone.tags)) {
        if (tag !== "pvp" && tag !== "multi-combat" && tag !== "safe") {
            throw new WorldDefinitionValidationError(
                `${label} has unsupported tag: ${String(tag)}`
            );
        }
        parsed.tags.push(tag);
    }
    return parsed;
}

export function parseWorldDefinition(value: unknown): WorldDefinitionData {
    const world = object(value, "world.json");
    if (!Array.isArray(world.zones)) {
        throw new WorldDefinitionValidationError("world.json zones must be an array");
    }
    if (!Array.isArray(world.disabledPlugins) || world.disabledPlugins.some(
        (pluginName) => typeof pluginName !== "string" || pluginName.trim().length === 0
    )) {
        throw new WorldDefinitionValidationError("world.json disabledPlugins must be a string[]");
    }
    const experienceMultiplier = world.experienceMultiplier === undefined
        ? 1
        : positiveNumber(world, "experienceMultiplier", "world.json");
    return {
        spawn: parseWorldPosition(world.spawn, "world.json spawn"),
        zones: world.zones.map((zone, index) =>
            parseWorldZone(zone, `world.json zones[${index}]`)
        ),
        disabledPlugins: world.disabledPlugins.map((pluginName) => pluginName.trim()),
        experienceMultiplier,
    };
}

const definition = parseWorldDefinition(
    JSON.parse(fs.readFileSync(WORLD_FILE, "utf8"))
);

export const WORLD_SPAWN = new Location(
    definition.spawn.x,
    definition.spawn.y,
    definition.spawn.z
);

export const WORLD_ZONE_BOUNDARIES: Record<WorldZoneTag, Boundary[]> = {
    pvp: [],
    safe: [],
    "multi-combat": [],
};

function zoneBoundaries(zone: WorldZone): Boundary[] {
    if (zone.minX === undefined) {
        return [0, 1, 2, 3].map((z) => new Boundary(0, 0x3fff, 0, 0x3fff, z));
    }
    return [new Boundary(zone.minX, zone.maxX!, zone.minY!, zone.maxY!, zone.z!)];
}

function syncRuntime(): void {
    WORLD_SPAWN.set(definition.spawn.x, definition.spawn.y, definition.spawn.z);
    WORLD_ZONE_BOUNDARIES.pvp.length = 0;
    WORLD_ZONE_BOUNDARIES.safe.length = 0;
    WORLD_ZONE_BOUNDARIES["multi-combat"].length = 0;
    for (const zone of definition.zones) {
        const boundaries = zoneBoundaries(zone);
        for (const tag of zone.tags) WORLD_ZONE_BOUNDARIES[tag].push(...boundaries);
    }
}

function copyWorldDefinition(): WorldDefinitionData {
    return {
        spawn: { ...definition.spawn },
        zones: definition.zones.map((zone) => ({ ...zone, tags: [...zone.tags] })),
        disabledPlugins: [...definition.disabledPlugins],
        experienceMultiplier: definition.experienceMultiplier,
    };
}

export function getWorldDefinition(): WorldDefinitionData {
    return copyWorldDefinition();
}

syncRuntime();
