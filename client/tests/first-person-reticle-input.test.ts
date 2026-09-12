import assert from "node:assert/strict";

import { Camera } from "../game/Camera";
import { ClickMode, InputManager } from "../game/InputManager";
import { FirstPersonPlugin } from "../game/plugins/firstperson/FirstPersonPlugin";

const originalDocument = globalThis.document;
let pointerLockElement: HTMLElement | undefined;
const element = {
    width: 640,
    height: 480,
    requestPointerLock: () => {
        pointerLockElement = element as HTMLElement;
    },
} as HTMLElement;
Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
        get pointerLockElement() {
            return pointerLockElement;
        },
        exitPointerLock: () => {
            pointerLockElement = undefined;
        },
    },
});

try {
    const input = new InputManager();
    input.element = element;
    pointerLockElement = element;
    input.setInteractionPointerOverride(320, 240);

    input.clickMode3 = ClickMode.LEFT;
    assert.equal(input.leftClickX, 320);
    assert.equal(input.leftClickY, 240);

    input.clickMode3 = ClickMode.RIGHT;
    assert.equal(input.pickX, 320);
    assert.equal(input.pickY, 240);

    input.clickMode3 = ClickMode.NONE;
    assert.equal(input.leftClickX, -1);
    assert.equal(input.pickX, -1);

    input.clearInteractionPointerOverride();
    input.clickMode3 = ClickMode.LEFT;
    input.saveClickX = 12;
    assert.equal(input.leftClickX, 12, "clearing an override should restore physical clicks");

    let menuCloseCount = 0;
    let inGame = true;
    const client = {
        camera: new Camera(0, 0, 0, 256, 512),
        inputManager: input,
        renderSelf: true,
        followPlayerCamera: false,
        menuOpen: false,
        isLoggedIn: () => inGame,
        closeMenu: () => {
            menuCloseCount++;
            client.menuOpen = false;
        },
    };
    const plugin = new FirstPersonPlugin(client);
    plugin.onKeyDown({ code: "Backquote", repeat: false } as KeyboardEvent);
    assert.equal(plugin.shouldKeepWorldMenuOpen(), false, "Backquote should not keep a closed menu alive");
    plugin.onKeyDown({ code: "Backquote", repeat: false } as KeyboardEvent);
    plugin.onKeyDown({ code: "Backquote", repeat: false } as KeyboardEvent);
    assert.equal(menuCloseCount, 3, "changing Backquote mode should discard stale menus");
    client.camera.update(640, 480);
    plugin.updateInteractionPointer(client.camera);
    assert.equal(input.hasInteractionPointerOverride(), false, "arrow-key mode should keep the normal cursor");
    input.keys.set("ArrowUp", true);
    plugin.handleCameraKeys({ camera: client.camera, input, deltaTime: 100 });
    assert.ok((client.camera.getViewPitchOverride() ?? 0) < 0, "Backquote mode up must be inverted");
    plugin.onKeyDown({ code: "AltLeft", repeat: false } as KeyboardEvent);
    plugin.updateInteractionPointer(client.camera);
    assert.equal(input.hasInteractionPointerOverride(), true, "Alt should enable mouse-look targeting");
    assert.equal(input.enablePointerLock, true, "Alt should enable pointer lock for mouse look");
    input.wheelDeltaY = -120;
    assert.equal(
        plugin.handleCameraScroll({ camera: client.camera, input, deltaTime: 0 }),
        true,
        "Backquote mode should handle scroll in either cursor mode",
    );
    assert.ok(client.camera.getViewZoomScale() > 1, "scrolling up should zoom in");

    plugin.onMouseDown({ button: 2 } as MouseEvent);
    plugin.updateInteractionPointer(client.camera);
    assert.equal(input.hasInteractionPointerOverride(), true, "opening a menu should keep the reticle target");
    assert.deepEqual(input.getContextMenuAnchor(0, 0), { x: 320, y: 228 }, "the menu should open above the reticle");
    client.menuOpen = true;
    assert.equal(plugin.shouldKeepWorldMenuOpen(), true, "an open Backquote menu should remain available");
    assert.equal(input.isPointerLock(), true, "the virtual menu cursor should keep pointer lock active");
    plugin.onMouseMove({ movementX: 10, movementY: 5 } as MouseEvent);
    assert.equal(input.mouseX, 330, "the virtual cursor should move from the reticle");
    assert.equal(input.mouseY, 245, "the virtual cursor should move from the reticle");
    input.clickX = 1;
    input.clickY = 1;
    plugin.onMouseDown({ button: 0 } as MouseEvent);
    assert.equal(client.menuOpen, true, "the menu action must receive the left click before closing");
    assert.equal(input.clickX, 330, "menu clicks should use the virtual cursor position");
    assert.equal(input.clickY, 245, "menu clicks should use the virtual cursor position");
    assert.equal(input.isPointerLock(), true, "a left click should resume mouse look");
    client.menuOpen = false;

    plugin.onMouseDown({ button: 2 } as MouseEvent);
    plugin.updateInteractionPointer(client.camera);
    client.menuOpen = true;
    client.menuOpen = false;
    plugin.handleCameraMouse({ camera: client.camera, input, deltaTime: 0 });
    assert.equal(input.isPointerLock(), true, "dismissing a menu by leaving it should resume mouse look");

    plugin.onMouseDown({ button: 2 } as MouseEvent);
    client.menuOpen = true;
    input.clickMode1 = ClickMode.RIGHT;
    input.clickMode2 = ClickMode.RIGHT;
    plugin.onMouseDown({ button: 2 } as MouseEvent);
    assert.equal(client.menuOpen, false, "a second right click should close the menu");
    assert.equal(input.clickMode1, ClickMode.NONE, "closing a menu must not open another one");
    assert.equal(input.isPointerLock(), true, "a second right click should resume mouse look");

    plugin.onKeyDown({ code: "AltLeft", repeat: false } as KeyboardEvent);
    plugin.updateInteractionPointer(client.camera);
    assert.equal(input.hasInteractionPointerOverride(), false, "Alt should return to arrow-key mode");
    assert.equal(input.enablePointerLock, false, "arrow-key mode should release pointer lock");

    inGame = false;
    input.setInteractionPointerOverride(320, 240);
    plugin.updateInteractionPointer(client.camera);
    assert.equal(input.hasInteractionPointerOverride(), false, "the reticle must be hidden outside the game");
} finally {
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument,
    });
}

console.log("first-person reticle input ok");
