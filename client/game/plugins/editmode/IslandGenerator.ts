import type { EditModeEdit } from "./types";

type Area = {
    origin: { x: number; y: number };
    width: number;
    height: number;
    wideTerrain: boolean;
    tiles: Array<{ x: number; y: number; plane: number; terrain: number[]; overlay?: number }>;
};

/** Read the overlay from the editor's lossless area export, including pending edits. */
export function waterArea(contents: string, isWater: (id: number) => boolean): Area | undefined {
    const area: Area = JSON.parse(contents);
    if (area.width <= 2 || area.height <= 2) return;
    const ground = area.tiles.filter((tile) => tile.plane === 0);
    if (ground.length !== area.width * area.height) return;
    for (const tile of ground) {
        let offset = 0;
        const read = () => {
            const width = area.wideTerrain ? 2 : 1;
            if (offset + width > tile.terrain.length) throw new Error("Incomplete terrain record");
            const value = area.wideTerrain
                ? tile.terrain[offset] * 256 + tile.terrain[offset + 1]
                : tile.terrain[offset];
            offset += width;
            return value;
        };
        let overlay = 0;
        let shape = 0;
        for (;;) {
            const opcode = read();
            if (opcode <= 1) break;
            if (opcode <= 49) {
                overlay = read();
                shape = (opcode - 2) >> 2;
            }
        }
        // A partial water overlay can expose land, so it is not an all-water tile.
        if (shape !== 0 || !isWater(overlay)) return;
        tile.overlay = overlay;
    }
    return area;
}

export function generateIslandEdits(area: Area, random = Math.random, sampleHeight: (x: number, y: number) => number = () => 0): EditModeEdit[] {
    const { width, height } = area;
    const water = new Map(area.tiles.filter((tile) => tile.plane === 0).map((tile) => [`${tile.x}:${tile.y}`, tile.overlay!]));
    const phase = random() * Math.PI * 2;
    const plateauHeight = 16 + random() * 4;
    const shoreWidth = 2 + random() * 0.5;
    const radiusX = Math.max(0.6, (width - 2) / 2);
    const radiusY = Math.max(0.6, (height - 2) / 2);
    const depth = (x: number, y: number) => {
        const dx = (x - width / 2) / radiusX;
        const dy = (y - height / 2) / radiusY;
        const angle = Math.atan2(dy, dx);
        return 1 - Math.hypot(dx, dy) / (1 + 0.08 * Math.sin(angle * 3 + phase) + 0.025 * Math.cos(angle * 4 - phase));
    };
    const footprint = new Set<number>();
    const land = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && footprint.has(x * height + y);
    for (let x = 1; x < width - 1; x++) {
        for (let y = 1; y < height - 1; y++) {
            if (depth(x + 0.5, y + 0.5) > 0) footprint.add(x * height + y);
        }
    }
    // Keep only tiles supported by a solid 2x2 patch. This also removes diagonal
    // whiskers that have two neighbours but still taper to a sharp single tile.
    // Tiny selections without a 2x2 interior retain their footprint.
    const supported = [...footprint].filter((key) => {
        const x = Math.floor(key / height), y = key % height;
        return [-1, 1].some((dx) => [-1, 1].some((dy) =>
            land(x + dx, y) && land(x, y + dy) && land(x + dx, y + dy),
        ));
    });
    if (supported.length > 0) {
        footprint.clear();
        for (const key of supported) footprint.add(key);
    }
    const edits: EditModeEdit[] = [];
    const add = (kind: EditModeEdit["kind"], x: number, y: number, locId: number, shape = 0, rotation = 0) => {
        edits.push({ kind, tileX: area.origin.x + x, tileY: area.origin.y + y, plane: 0, locId, shape, rotation });
    };
    // ponytail: one island palette from the supplied OSRS sample; add biomes when needed.
    for (let x = 1; x < width - 1; x++) {
        for (let y = 1; y < height - 1; y++) {
            if (!land(x, y)) continue;
            const west = !land(x - 1, y), north = !land(x, y + 1);
            const east = !land(x + 1, y), south = !land(x, y - 1);
            const corner = Number(west) + Number(north) + Number(east) + Number(south) === 2 && west !== east;
            const rotation = west ? (north ? 1 : 0) : north ? 2 : 3;
            add("terrain", x, y, corner ? water.get(`${x}:${y}`)! : 0, corner ? 1 : 0, corner ? rotation : 0);
            add("underlay", x, y, west || north || east || south ? 98 : depth(x + 0.5, y + 0.5) < 0.5 ? 64 : 48);
            add("flag", x, y, 0);
        }
    }
    // Distance from the actual waterline, in tile vertices. Only the coastal
    // band slopes; beyond it the interior stays level with small broad ripples.
    const distances = new Map<number, number>();
    const queue: number[] = [];
    for (let x = 0; x <= width; x++) {
        for (let y = 0; y <= height; y++) {
            if ([land(x, y), land(x - 1, y), land(x, y - 1), land(x - 1, y - 1)].every(Boolean)) continue;
            const key = x * (height + 1) + y;
            distances.set(key, 0);
            queue.push(key);
        }
    }
    for (let i = 0; i < queue.length; i++) {
        const key = queue[i], x = Math.floor(key / (height + 1)), y = key % (height + 1);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx, ny = y + dy, next = nx * (height + 1) + ny;
            if (nx < 0 || ny < 0 || nx > width || ny > height || distances.has(next)) continue;
            distances.set(next, distances.get(key)! + 1);
            queue.push(next);
        }
    }
    for (let x = 1; x < width; x++) {
        for (let y = 1; y < height; y++) {
            const distance = distances.get(x * (height + 1) + y)!;
            if (distance === 0) continue;
            const base = Math.round(-sampleHeight(area.origin.x + x, area.origin.y + y) * 16);
            const t = Math.min(1, distance / shoreWidth);
            const variation = 1.5 * Math.sin(x * 0.35 + phase) * Math.cos(y * 0.3 - phase);
            const rise = t * t * (3 - 2 * t) * (plateauHeight + variation);
            add("height", x, y, Math.max(2, Math.min(255, base + Math.max(2, Math.round(rise)))));
        }
    }
    return edits;
}
