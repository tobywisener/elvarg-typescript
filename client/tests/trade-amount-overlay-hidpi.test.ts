import assert from "node:assert/strict";

import { WidgetsOverlay } from "../ui/devoverlay/WidgetsOverlay";

// The Offer-X / Remove-X chatbox panel (group 162) is drawn by the overlay itself into the
// device-pixel buffer. _absX/_absWidth are device space, x/width are layout space; adding a
// layout width to a device origin put the right edge at half the panel on a 2x display.
const drawn: any[] = [];

function makeOverlay(roots: any[]) {
    const overlay: any = Object.create(WidgetsOverlay.prototype);
    overlay.overlayScaleX = 1;
    overlay.overlayScaleY = 1;
    overlay.overlayCanvas = { __uiRenderScale: 2 };
    overlay.glRenderer = {
        width: 2034,
        height: 1528,
        drawRect: (x: number, y: number, w: number, h: number) => drawn.push({ x, y, w, h }),
        flush: () => undefined,
    };
    overlay.ctx = {
        getGameContext: () => ({
            osrsClient: {
                isTradeQuantityInputActive: () => true,
                cs2Vm: { inputDialogString: "42" },
            },
        }),
        // Font loader returns undefined so drawTextGL early-returns; this test pins the
        // panel geometry, and glyph scaling is covered by mouseover-text-hidpi-scale.
        getFontLoader: () => () => undefined,
    };
    return { overlay, widgetManager: { getAllGroupRoots: () => roots } as any };
}

// Device-space widget (the normal case once the tree has rendered once).
// Both spaces present, as they are once the tree has rendered: device is 2x layout.
const { overlay, widgetManager } = makeOverlay([
    {
        _absX: 0, _absY: 1000, _absWidth: 1000, _absHeight: 300,
        x: 0, y: 500, width: 500, height: 150,
    },
]);
drawn.length = 0;
overlay.drawTradeAmountOverlay(widgetManager);

assert.equal(drawn.length, 1, "panel must be drawn once");
const rect = drawn[0];
// x/y inset by 4/4 layout px => 8 device px at 2x; width inset by 8 layout px => 16 device.
assert.deepEqual(
    { x: rect.x, y: rect.y, w: rect.w },
    { x: 8, y: 1008, w: 1000 - 16 },
    "insets must be scaled into device space",
);
// height = max(72*2, 300 - 25*2) = max(144, 250) = 250, minus 8*2 inset.
assert.equal(rect.h, 250 - 16);

// Layout-space fallback (before _abs* exist): must be promoted to device space, not used raw.
const second = makeOverlay([{ x: 0, y: 500, width: 500, height: 150 }]);
drawn.length = 0;
second.overlay.drawTradeAmountOverlay(second.widgetManager);
const fallback = drawn[0];
assert.equal(fallback.y, 500 * 2 + 8, "layout-space y must be scaled to device space");
assert.equal(fallback.w, 500 * 2 - 16, "layout-space width must be scaled to device space");

console.log("trade amount overlay HiDPI test passed");
