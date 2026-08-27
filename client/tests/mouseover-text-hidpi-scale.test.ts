import assert from "node:assert/strict";

import { WidgetsOverlay } from "../ui/devoverlay/WidgetsOverlay";

// Retina desktop: CSS 1017x764, device buffer 2034x1528, so the renderer publishes
// __uiRenderScale = 2. overlayScaleX/Y is 1 on desktop by construction
// (targetUiScale === mainScaleX), so text drawn with overlayScale alone lands at 1x in a
// device-pixel buffer - the "tooltips are tiny on retina" bug.
const overlay: any = Object.create(WidgetsOverlay.prototype);
overlay.overlayScaleX = 1;
overlay.overlayScaleY = 1;
overlay.overlayCanvas = { __uiRenderScale: 2 };

const scale = overlay.getOverlayTextScale();
assert.deepEqual(scale, { x: 2, y: 2 }, "HiDPI text must scale by the renderer's UI scale");

// 16px glyph box must become 32 device px, matching the widget tree's 2x roots.
assert.equal(Math.max(1, Math.round(16 * scale.y)), 32);

// Touch//fractional path: overlay scale and render scale compose, they don't override.
overlay.overlayScaleX = 1.5;
overlay.overlayScaleY = 1.5;
assert.deepEqual(overlay.getOverlayTextScale(), { x: 3, y: 3 });

// No render scale published yet (first frame before onResize): fall back to overlay scale
// rather than 0/NaN, which would make drawTextGL bail on a non-positive size.
overlay.overlayScaleX = 1;
overlay.overlayScaleY = 1;
overlay.overlayCanvas = {};
assert.deepEqual(overlay.getOverlayTextScale(), { x: 1, y: 1 });

console.log("mouseover text HiDPI scale test passed");
