import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { DrawRange } from "../render/DrawRange";
import { VertexBuffer } from "../render/buffer/VertexBuffer";

async function main(): Promise<void> {
    const playerShader = fs.readFileSync(
        path.resolve(__dirname, "../render/shaders/player.vert.glsl"),
        "utf8",
    );
    const priorityBias = playerShader.indexOf(
        "applyPriorityDepthBias(depthLayerPos, vertex.priority)",
    );
    const transparentGuard = playerShader.lastIndexOf("#ifdef DISCARD_ALPHA", priorityBias);
    assert.ok(priorityBias > 0);
    assert.ok(
        transparentGuard === -1 || playerShader.indexOf("#endif", transparentGuard) < priorityBias,
    );
    assert.ok(playerShader.includes("gl_Position = u_projectionMatrix * viewPos"));
    assert.ok(
        playerShader.includes(
            "gl_Position.z = depthLayerClipPos.z * gl_Position.w / depthLayerClipPos.w",
        ),
    );

    const vertexBuffer = new VertexBuffer(1);
    vertexBuffer.addVertex(0, 0, 0, 0, 0xff, 0, 0, -1, false, 7, true);
    const packedVertex = new DataView(vertexBuffer.byteArray().buffer);
    assert.equal((packedVertex.getUint32(8, true) >> 6) & 0x7, 7);

    (globalThis as any).self = globalThis;
    const { drawPlayerSlots, PlayerRenderer, shouldUseUnanimatedIdlePlayer } = await import(
        "../render/player/PlayerRenderer"
    );

    assert.equal(shouldUseUnanimatedIdlePlayer(200, true, false, false, 808, 808), false);
    assert.equal(shouldUseUnanimatedIdlePlayer(201, true, false, false, 808, 808), true);
    assert.equal(shouldUseUnanimatedIdlePlayer(300, true, true, false, 808, 808), false);
    assert.equal(shouldUseUnanimatedIdlePlayer(300, true, false, true, 808, 808), false);

    const drawn: Array<{ slot: number; range: DrawRange }> = [];
    let slot = -1;
    let range: DrawRange = [0, 0, 0];
    let uploadedSlots: number[] = [];
    const slotBuffer = {
        data(value: Int32Array) {
            uploadedSlots = Array.from(value);
        },
    };
    const drawCall = {
        uniform(name: string, value: number) {
            if (name === "u_drawIdOverride") slot = value;
            return this;
        },
        drawRanges(value: DrawRange) {
            range = value;
            return this;
        },
        draw() {
            drawn.push({ slot, range });
        },
    };

    drawPlayerSlots(
        drawCall as any,
        slotBuffer as any,
        new Int32Array(256),
        [2, 3, 5, 8, 9, 10],
        42,
    );

    assert.deepEqual(uploadedSlots, [2, 3, 5, 8, 9, 10]);
    assert.deepEqual(drawn, [{ slot: -1, range: [0, 42, 6] }]);

    uploadedSlots = [];
    drawn.length = 0;
    drawPlayerSlots(drawCall as any, slotBuffer as any, new Int32Array(256), [7], 13);
    assert.deepEqual(uploadedSlots, []);
    assert.deepEqual(drawn, [{ slot: 7, range: [0, 13, 1] }]);

    let bufferCreates = 0;
    let bufferUpdates = 0;
    let bufferDeletes = 0;
    let vertexArrayDeletes = 0;
    const createBuffer = (data: ArrayBufferView) => {
        bufferCreates++;
        return {
            byteLength: data.byteLength,
            data() {
                bufferUpdates++;
                return this;
            },
            delete() {
                bufferDeletes++;
            },
        };
    };
    const vao = {
        vertexAttributeBuffer() {
            return this;
        },
        instanceAttributeBuffer() {
            return this;
        },
        indexBuffer() {
            return this;
        },
        delete() {
            vertexArrayDeletes++;
        },
    };
    const fluentDraw = {
        uniformBlock() {
            return this;
        },
        uniform() {
            return this;
        },
        texture() {
            return this;
        },
    };
    const renderer = {
        app: {
            createInterleavedBuffer: (_stride: number, data: ArrayBufferView) =>
                createBuffer(data),
            createIndexBuffer: (_type: number, data: ArrayBufferView) => createBuffer(data),
            createVertexArray: () => vao,
            createDrawCall: () => fluentDraw,
        },
        playerProgram: {},
        playerProgramOpaque: {},
        playerSlotBuffer: {},
        sceneUniformBuffer: {},
        textureArray: {},
        textureMaterials: {},
    };
    const playerRenderer = new PlayerRenderer(renderer as any) as any;
    const previousAppearance = { id: "previous" };
    const nextAppearance = { id: "next" };
    let nextAppearanceReady = true;
    playerRenderer.ensureBaseForAppearance = (appearance: object) =>
        appearance === nextAppearance && !nextAppearanceReady ? undefined : {};
    assert.equal(playerRenderer.resolveRenderableAppearance(1, previousAppearance), previousAppearance);
    nextAppearanceReady = false;
    assert.equal(
        playerRenderer.resolveRenderableAppearance(1, nextAppearance),
        previousAppearance,
        "keep the completed model visible while new equipment models load",
    );
    nextAppearanceReady = true;
    assert.equal(playerRenderer.resolveRenderableAppearance(1, nextAppearance), nextAppearance);
    playerRenderer.geomCache.set("frame:0", {
        verts: new Uint8Array(24),
        inds: new Int32Array(6),
        vertsA: new Uint8Array(12),
        indsA: new Int32Array(3),
    });
    const firstGeometry = playerRenderer.getPlayerGpuGeometry("appearance:0", "frame:0");
    const reusedGeometry = playerRenderer.getPlayerGpuGeometry("appearance:0", "frame:0");
    assert.equal(reusedGeometry, firstGeometry);
    assert.equal(bufferCreates, 4);
    assert.equal(bufferUpdates, 0);

    playerRenderer.geomCache.set("frame:1", {
        verts: new Uint8Array(12),
        inds: new Int32Array(3),
        vertsA: new Uint8Array(12),
        indsA: new Int32Array(3),
    });
    const nextFrameGeometry = playerRenderer.getPlayerGpuGeometry("appearance:0", "frame:1");
    assert.equal(nextFrameGeometry, firstGeometry);
    assert.equal(bufferCreates, 4);
    assert.equal(bufferUpdates, 4);
    playerRenderer.cleanupAppearanceCache();
    assert.equal(bufferDeletes, 4);
    assert.equal(vertexArrayDeletes, 2);
    console.log("Player draw batching regression test passed");
}

void main();
