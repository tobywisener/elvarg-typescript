import { getClientCycle } from "../../network/ServerConnection";
import type { WebGLMapSquare } from "../WebGLMapSquare";
import type { WebGLOsrsRenderer } from "../WebGLOsrsRenderer";

export type GfxAnchor = "ground" | "offset";

export interface GfxInstance {
    id: number;
    spotId: number;
    /** OSRS spot animation slot (0..255). When set, newer instances replace older ones for the same anchor. */
    slot?: number;
    // Attach by server id; resolve pid each frame
    attachPlayerServerId?: number;
    attachNpcServerId?: number;
    anchor: GfxAnchor;
    yOffsetTiles?: number; // only for anchor=offset
    loop: boolean;
    startCycle: number; // client cycle when scheduled to start
    // Wall-clock playback for correct speed (~20ms per client cycle)
    startTimeMs?: number; // set when startCycle gate passes
    durationMs?: number; // computed from sequence duration if not looping
    endTimeMs?: number; // startTimeMs + durationMs
    // Internal: last frame index we dispatched frame-sounds for (to avoid duplicates across passes)
    lastSoundFrame?: number;
    world?: {
        tileX: number;
        tileY: number;
        level: number;
        heightOffsetTiles?: number;
        mapId?: number;
        slot?: number;
    };
}

/**
 * Minimal GFX manager: tracks actor-attached spot animations and exposes
 * per-map instance queries for the renderer. Auto-attaches 833 to all players.
 */
export class GfxManager {
    private nextId = 1;
    private instances: Map<number, GfxInstance> = new Map();
    // Reusable buffers (avoid per-call allocation)
    private worldInstancesBuffer: GfxInstance[] = [];
    private worldInstancesWithSlotBuffer: Array<{ inst: GfxInstance; slot: number }> = [];
    constructor(private renderer: WebGLOsrsRenderer) {}

    update(): void {
        const nowCycle = getClientCycle() | 0;
        const nowMs = (performance?.now?.() as number) || Date.now();
        for (const [id, inst] of this.instances) {
            // Activate when the scheduled start tick has passed
            if (inst.startCycle <= nowCycle && inst.startTimeMs == null) {
                inst.startTimeMs = nowMs;
                if (!inst.loop && typeof inst.durationMs === "number" && inst.durationMs > 0) {
                    inst.endTimeMs = inst.startTimeMs + inst.durationMs;
                }
            }
            if (!inst.loop && typeof inst.endTimeMs === "number" && nowMs >= (inst.endTimeMs | 0)) {
                this.instances.delete(id);
            }
        }
    }

    // Auto policy: ensure 833 exists per visible player
    private ensureAttached833ForAllPlayers(): void {
        const pe: any = this.renderer.osrsClient.playerEcs as any;
        const n = pe?.size?.() ?? 0;
        for (let i = 0; i < n; i++) {
            const sid = pe.getServerIdForIndex?.(i);
            if (typeof sid !== "number" || sid <= 0) continue;
            const key = this.findAttachedInstanceKey(833, sid);
            if (key === undefined) {
                this.spawnAttachedToPlayer(833, sid, "ground", undefined, true);
            }
        }
    }

    private findAttachedInstanceKey(spotId: number, serverId: number): number | undefined {
        for (const [id, inst] of this.instances) {
            if (inst.spotId === spotId && inst.attachPlayerServerId === serverId) return id;
        }
        return undefined;
    }

    clearAttachedSlotPlayer(serverId: number, slotArg?: number): void {
        const slot = typeof slotArg === "number" ? (slotArg | 0) & 0xff : 0;
        for (const [existingId, inst] of this.instances) {
            if (inst.attachPlayerServerId === (serverId | 0) && inst.slot === slot) {
                this.instances.delete(existingId);
            }
        }
    }

    clearAttachedSlotNpc(serverId: number, slotArg?: number): void {
        const slot = typeof slotArg === "number" ? (slotArg | 0) & 0xff : 0;
        for (const [existingId, inst] of this.instances) {
            if (inst.attachNpcServerId === (serverId | 0) && inst.slot === slot) {
                this.instances.delete(existingId);
            }
        }
    }

    spawnAttachedToPlayer(
        spotId: number,
        serverId: number,
        anchor: GfxAnchor = "ground",
        yOffsetTiles?: number,
        loop: boolean = false,
        startCycleArg?: number,
        slotArg?: number,
    ): number {
        const slot = typeof slotArg === "number" ? (slotArg | 0) & 0xff : undefined;
        if (slot !== undefined) {
            for (const [existingId, inst] of this.instances) {
                if (inst.attachPlayerServerId === (serverId | 0) && inst.slot === slot) {
                    this.instances.delete(existingId);
                }
            }
        }
        const id = this.nextId++;
        // Compute approximate duration for lifetime when not looping (ms from client cycles)
        let durationMs: number | undefined = undefined;
        try {
            const cache = (this.renderer as any).gfxRenderer?.getCache?.();
            const durationTicks = cache?.getDurationTicks?.(spotId | 0);
            if (typeof durationTicks === "number" && durationTicks > 0) {
                durationMs = durationTicks * 20;
            } else {
                const fc = cache?.getFrameCount?.(spotId | 0) ?? 0;
                if ((fc | 0) > 0) durationMs = Math.max(20, (fc | 0) * 20);
            }
        } catch {}

        this.instances.set(id, {
            id,
            spotId: spotId | 0,
            attachPlayerServerId: serverId | 0,
            attachNpcServerId: undefined,
            slot,
            anchor,
            yOffsetTiles,
            loop,
            startCycle:
                typeof startCycleArg === "number" ? startCycleArg | 0 : getClientCycle() | 0,
            startTimeMs: undefined,
            durationMs,
            endTimeMs: undefined,
        });
        return id;
    }

    spawnAttachedToNpc(
        spotId: number,
        serverId: number,
        anchor: GfxAnchor = "ground",
        yOffsetTiles?: number,
        loop: boolean = false,
        startCycleArg?: number,
        slotArg?: number,
    ): number {
        const slot = typeof slotArg === "number" ? (slotArg | 0) & 0xff : undefined;
        if (slot !== undefined) {
            for (const [existingId, inst] of this.instances) {
                if (inst.attachNpcServerId === (serverId | 0) && inst.slot === slot) {
                    this.instances.delete(existingId);
                }
            }
        }
        const id = this.nextId++;
        let durationMs: number | undefined = undefined;
        try {
            const cache = (this.renderer as any).gfxRenderer?.getCache?.();
            const durationTicks = cache?.getDurationTicks?.(spotId | 0);
            if (typeof durationTicks === "number" && durationTicks > 0) {
                durationMs = durationTicks * 20;
            } else {
                const fc = cache?.getFrameCount?.(spotId | 0) ?? 0;
                if ((fc | 0) > 0) durationMs = Math.max(20, (fc | 0) * 20);
            }
        } catch {}

        this.instances.set(id, {
            id,
            spotId: spotId | 0,
            attachPlayerServerId: undefined,
            attachNpcServerId: serverId | 0,
            slot,
            anchor,
            yOffsetTiles,
            loop,
            startCycle:
                typeof startCycleArg === "number" ? startCycleArg | 0 : getClientCycle() | 0,
            startTimeMs: undefined,
            durationMs,
            endTimeMs: undefined,
        });
        return id;
    }

    spawnAtTile(
        spotId: number,
        tile: { x: number; y: number; level?: number },
        opts?: { heightTiles?: number; startCycle?: number },
    ): number {
        const id = this.nextId++;
        let durationMs: number | undefined = undefined;
        try {
            const cache = (this.renderer as any).gfxRenderer?.getCache?.();
            const durationTicks = cache?.getDurationTicks?.(spotId | 0);
            if (typeof durationTicks === "number" && durationTicks > 0) {
                durationMs = durationTicks * 20;
            } else {
                const fc = cache?.getFrameCount?.(spotId | 0) ?? 0;
                if ((fc | 0) > 0) durationMs = Math.max(20, (fc | 0) * 20);
            }
        } catch {}

        this.instances.set(id, {
            id,
            spotId: spotId | 0,
            anchor: opts?.heightTiles ? "offset" : "ground",
            yOffsetTiles: opts?.heightTiles,
            loop: false,
            startCycle:
                typeof opts?.startCycle === "number" ? opts.startCycle | 0 : getClientCycle() | 0,
            startTimeMs: undefined,
            durationMs,
            endTimeMs: undefined,
            world: {
                tileX: tile.x | 0,
                tileY: tile.y | 0,
                level: tile.level ?? 0,
                heightOffsetTiles: opts?.heightTiles,
            },
        });
        return id;
    }

    kill(id: number): void {
        this.instances.delete(id);
    }

    /**
     * Return attached-player instances that belong to the given map square,
     * along with resolved ECS indices and per-map slot order.
     */
    getAttachedPlayersForMap(
        map: WebGLMapSquare,
    ): Array<{
        inst: GfxInstance;
        pid: number; // ECS player index
        slot: number; // order within this map square (0..N-1)
    }> {
        const out: Array<{ inst: GfxInstance; pid: number; slot: number }> = [];
        const pe: any = this.renderer.osrsClient.playerEcs as any;
        const pidsInMap = this.renderer.playerRenderer.getRenderPlayersForMap(map);
        if (pidsInMap.length === 0) return out;
        const nowCycle = getClientCycle() | 0;
        for (let slot = 0; slot < pidsInMap.length; slot++) {
            const pid = pidsInMap[slot] | 0;
            const sid = pe.getServerIdForIndex?.(pid);
            for (const inst of this.instances.values()) {
                if (inst.attachPlayerServerId !== (sid | 0)) continue;
                if ((inst.startCycle | 0) > nowCycle) continue; // honor start cycle delay
                out.push({ inst, pid, slot });
            }
        }
        return out;
    }

    getAttachedNpcsForMap(
        map: WebGLMapSquare,
    ): Array<{ inst: GfxInstance; ecsId: number; slot: number }> {
        const out: Array<{ inst: GfxInstance; ecsId: number; slot: number }> = [];
        const ids: number[] = map.npcEntityIds;
        if (!ids || ids.length === 0) return out;
        const ecs: any = this.renderer.osrsClient?.npcEcs;
        if (!ecs) return out;

        const sidToInfo = new Map<number, { ecsId: number; slot: number }>();
        for (let slot = 0; slot < ids.length; slot++) {
            const ecsId = ids[slot] | 0;
            if (!ecs.isActive?.(ecsId) || !ecs.isLinked?.(ecsId)) continue;
            if (!this.renderer.shouldRenderNpcFromMap(map, ecsId)) continue;
            const sid = ecs.getServerId?.(ecsId);
            if (typeof sid !== "number" || sid <= 0) continue;
            sidToInfo.set(sid | 0, { ecsId, slot });
        }
        if (sidToInfo.size === 0) return out;

        const nowCycle = getClientCycle() | 0;
        for (const inst of this.instances.values()) {
            const sid = inst.attachNpcServerId;
            if (typeof sid !== "number" || sid <= 0) continue;
            if ((inst.startCycle | 0) > nowCycle) continue;
            const info = sidToInfo.get(sid | 0);
            if (!info) continue;
            out.push({ inst, ecsId: info.ecsId, slot: info.slot });
        }
        return out;
    }

    resetWorldBindings(): void {
        for (const inst of this.instances.values()) {
            if (inst.world) {
                inst.world.mapId = undefined;
                inst.world.slot = undefined;
            }
        }
    }

    listWorldInstancesForMap(mapX: number, mapY: number): GfxInstance[] {
        const out = this.worldInstancesBuffer;
        out.length = 0; // Clear and reuse buffer
        const baseX = mapX * 64;
        const baseY = mapY * 64;
        const nowCycle = getClientCycle() | 0;
        for (const inst of this.instances.values()) {
            if (!inst.world) continue;
            if ((inst.startCycle | 0) > nowCycle) continue;
            const tileX = inst.world.tileX | 0;
            const tileY = inst.world.tileY | 0;
            if (tileX < baseX || tileX >= baseX + 64) continue;
            if (tileY < baseY || tileY >= baseY + 64) continue;
            out.push(inst);
        }
        return out;
    }

    getWorldInstancesForMap(map: WebGLMapSquare): Array<{ inst: GfxInstance; slot: number }> {
        const out = this.worldInstancesWithSlotBuffer;
        let idx = 0;
        const nowCycle = getClientCycle() | 0;
        for (const inst of this.instances.values()) {
            if (!inst.world) continue;
            if ((inst.startCycle | 0) > nowCycle) continue;
            if (inst.world.mapId !== map.id) continue;
            if (typeof inst.world.slot !== "number") continue;
            // Reuse existing objects in the buffer when possible
            if (idx < out.length) {
                out[idx].inst = inst;
                out[idx].slot = inst.world.slot | 0;
            } else {
                out.push({ inst, slot: inst.world.slot | 0 });
            }
            idx++;
        }
        out.length = idx; // Truncate to actual size
        return out;
    }
}
