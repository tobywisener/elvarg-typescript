import assert from "node:assert/strict";

import { registerClientOps } from "../rs/cs2/handlers/ClientOps";
import { Opcodes } from "../rs/cs2/Opcodes";

// HiDPI: widget layout is 1017x764, the renderer's backing store is 2034x1528, and the
// camera tracks buffer resolution. viewport_geteffectivesize must hand CS2 layout space
// in BOTH branches - scripts feed it straight into if_setsize, so buffer pixels there
// size gameframe containers at 2x and push their children off-screen.
const LAYOUT_W = 1017;
const LAYOUT_H = 764;
const BUFFER_W = 2034;
const BUFFER_H = 1528;

function effectiveSize(viewportWidget: any): { w: number; h: number } {
    const camera = {
        viewportWidth: BUFFER_W,
        viewportHeight: BUFFER_H,
        computeViewportMetricsForSize: (w: number, h: number) => ({
            viewportWidth: w,
            viewportHeight: h,
        }),
    };
    const widgetManager: any = {
        canvasWidth: LAYOUT_W,
        canvasHeight: LAYOUT_H,
        viewportWidget,
        osrsClient: { camera, renderer: { canvas: { width: BUFFER_W, height: BUFFER_H } } },
    };
    const stack: number[] = [];
    const ctx: any = {
        widgetManager,
        intStack: stack,
        intStackSize: 0,
        pushInt: (v: number) => { stack[ctx.intStackSize++] = v | 0; },
    };

    const handlers = new Map<number, (ctx: any, intOp?: number) => void>();
    registerClientOps(handlers as never);
    handlers.get(Opcodes.VIEWPORT_GETEFFECTIVESIZE)!(ctx);

    assert.equal(ctx.intStackSize, 2, "must push width and height");
    return { w: stack[0], h: stack[1] };
}

// With a viewport widget: the documented path, already layout-space.
const withWidget = effectiveSize({ width: LAYOUT_W, height: LAYOUT_H });
assert.deepEqual(withWidget, { w: LAYOUT_W, h: LAYOUT_H });

// Without one - setRootInterface() nulls viewportWidget on every root swap, which is what
// the Welcome Screen (378) does - the fallback must scale back too, not emit buffer px.
const withoutWidget = effectiveSize(null);
assert.deepEqual(
    withoutWidget,
    { w: LAYOUT_W, h: LAYOUT_H },
    "fallback must return layout space, not buffer pixels",
);

console.log("viewport effective size scale test passed");
