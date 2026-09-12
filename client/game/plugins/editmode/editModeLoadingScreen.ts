import { isMapProfileEnabled } from "../../../render/render/mapLoadProfile";
import type { LoginRendererHost, RenderContext } from "../../login/renderer/host";
import { withRenderTransform } from "../../login/renderer/layout/config";
import { withContentTransform } from "../../login/renderer/layout/geometry";
import { drawCenteredText } from "../../login/renderer/render/drawUtils";
import type { OsrsClient } from "../../OsrsClient";

export function getEditModeSceneLoadingStatus(client: OsrsClient): string | undefined {
    const startedAt = client.scenePreviewLoadingStartedAt;
    if (!client.scenePreviewEnabled || startedAt === undefined) return undefined;
    const maps = client.renderer.mapManager;
    // Visible maps have passed canRender(), unlike worker results or newly uploaded maps.
    const ready = maps.visibleMaps.slice(0, maps.visibleMapCount).find(
        (map) => maps.isMapInTargetGrid(map.mapX, map.mapY),
    );
    if (ready) {
        if (isMapProfileEnabled()) console.info(`[map-profile] editor first region ${ready.mapX},${ready.mapY} visible after ${Math.round(performance.now() - startedAt)}ms`);
        client.scenePreviewLoadingStartedAt = undefined;
        return undefined;
    }
    const progress = client.js5?.getProgress();
    const stage = progress?.pending
        ? "Downloading scenery"
        : maps.loadingMapIds.size > 0
          ? "Building the first region"
          : "Preparing the first region";
    const received = progress?.downloadedBytes
        ? ` - ${(progress.downloadedBytes / 1048576).toFixed(1)} MiB received`
        : "";
    return `${stage}${received} (${Math.floor((performance.now() - startedAt) / 1000)}s)`;
}

export function drawEditModeLoadingScreen(host: LoginRendererHost, ctx: RenderContext, status = "Preparing the editor"): void {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, host.canvasWidth, host.canvasHeight);
    withRenderTransform(host, ctx, () => {
        withContentTransform(host, ctx, () => {
            const centerX = host.LOGIN_BOX_CENTER;
            if (host.fontBold12) {
                ctx.save();
                ctx.translate(centerX, 245);
                ctx.scale(1.5, 1.5);
                drawCenteredText(host, ctx, host.fontBold12, "Loading, please wait...", 0, 0, 0xffffff);
                ctx.restore();
                drawCenteredText(host, ctx, host.fontBold12, status, centerX, 270, 0xffffff);
            } else {
                ctx.font = "bold 20px Helvetica, Arial, sans-serif";
                ctx.fillStyle = "white";
                ctx.textAlign = "center";
                ctx.fillText("Loading, please wait...", centerX, 245);
                ctx.font = "bold 13px Helvetica, Arial, sans-serif";
                ctx.fillText(status, centerX, 270);
            }
        });
    });
}
