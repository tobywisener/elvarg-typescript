/**
 * Scene viewport geometry in device pixels. Widgets use layout units, so the
 * no-widget fallback must use the layout size before applying the scale.
 */
export interface SceneViewportInput {
    fallbackWidth: number;
    fallbackHeight: number;
    layoutWidth: number;
    layoutHeight: number;
    viewport?: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        _absX?: number;
        _absY?: number;
        _absLogicalX?: number;
        _absLogicalY?: number;
    };
}

export interface SceneViewportRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function computeSceneViewportRect(input: SceneViewportInput): SceneViewportRect {
    const fallbackWidth = Math.max(1, input.fallbackWidth | 0);
    const fallbackHeight = Math.max(1, input.fallbackHeight | 0);
    const layoutWidth = Math.max(1, (input.layoutWidth || fallbackWidth) | 0);
    const layoutHeight = Math.max(1, (input.layoutHeight || fallbackHeight) | 0);
    const scaleX = fallbackWidth / layoutWidth;
    const scaleY = fallbackHeight / layoutHeight;
    const viewport = input.viewport;

    const rawX =
        typeof viewport?._absLogicalX === "number"
            ? viewport._absLogicalX
            : typeof viewport?._absX === "number"
              ? Math.round(viewport._absX / scaleX)
              : typeof viewport?.x === "number"
                ? viewport.x
                : 0;
    const rawY =
        typeof viewport?._absLogicalY === "number"
            ? viewport._absLogicalY
            : typeof viewport?._absY === "number"
              ? Math.round(viewport._absY / scaleY)
              : typeof viewport?.y === "number"
                ? viewport.y
                : 0;
    const rawWidth = typeof viewport?.width === "number" ? viewport.width | 0 : layoutWidth;
    const rawHeight = typeof viewport?.height === "number" ? viewport.height | 0 : layoutHeight;

    return {
        x: Math.round(rawX * scaleX),
        y: Math.round(rawY * scaleY),
        width: Math.max(1, Math.round(rawWidth * scaleX)),
        height: Math.max(1, Math.round(rawHeight * scaleY)),
    };
}
