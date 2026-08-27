import assert from "node:assert/strict";

async function main(): Promise<void> {
    const { GfxManager } = await import("../render/gfx/GfxManager");
    const renderPlayers = [6, 2];
    const manager = new GfxManager({
        osrsClient: {
            playerEcs: { getServerIdForIndex: (pid: number) => ({ 6: 41, 2: 84 })[pid] },
        },
        playerRenderer: { getRenderPlayersForMap: () => renderPlayers },
    } as any);

    manager.spawnAttachedToPlayer(726, 84);
    assert.deepEqual(
        manager.getAttachedPlayersForMap({} as any).map(({ pid, slot }) => ({ pid, slot })),
        [{ pid: 2, slot: 1 }],
    );
    console.log("Player spot-animation targeting regression test passed");
}

void main();
