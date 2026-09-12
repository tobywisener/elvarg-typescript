import type { SdMapData } from "../loader/SdMapData";

export function isMapProfileEnabled(): boolean {
    try {
        const params = new URLSearchParams(globalThis.location?.search);
        return params.get("map-profile") === "1";
    } catch {
        return false;
    }
}

export function markMapWorkerReady(map: SdMapData, queuedAt: number): void {
    if (!isMapProfileEnabled()) return;
    map.mapProfile = { queuedAt, workerReadyAt: performance.now() };
    console.info(
        `[map-profile] ${map.mapX},${map.mapY} worker ${(map.mapProfile.workerReadyAt - queuedAt).toFixed(0)}ms`,
    );
}

export function logMapApplied(map: SdMapData, applyStartedAt: number): void {
    const profile = map.mapProfile;
    if (!profile) return;
    const now = performance.now();
    console.info(
        `[map-profile] ${map.mapX},${map.mapY} total ${(now - profile.queuedAt).toFixed(0)}ms ` +
        `queue ${(applyStartedAt - profile.workerReadyAt).toFixed(0)}ms ` +
        `apply ${(now - applyStartedAt).toFixed(0)}ms`,
    );
}
