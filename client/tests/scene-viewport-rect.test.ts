import assert from "node:assert/strict";

import { computeSceneViewportRect } from "../render/render/viewportRect";

assert.deepEqual(
    computeSceneViewportRect({
        fallbackWidth: 2560,
        fallbackHeight: 1426,
        layoutWidth: 1280,
        layoutHeight: 713,
        viewport: { x: 4, y: 4, width: 512, height: 334 },
    }),
    { x: 8, y: 8, width: 1024, height: 668 },
);

assert.deepEqual(
    computeSceneViewportRect({
        fallbackWidth: 2560,
        fallbackHeight: 1426,
        layoutWidth: 1280,
        layoutHeight: 713,
    }),
    { x: 0, y: 0, width: 2560, height: 1426 },
);

console.log("Scene viewport rect tests passed");
