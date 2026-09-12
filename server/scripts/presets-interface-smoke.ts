// Opens the Presets interface for a stub player and checks what the server sends: the
// widget group is mounted, both preset lists are filled, and selecting one renders its
// combat levels, spellbook, inventory and equipment into the right components.
// Usage: TS_NODE_COMPILER_OPTIONS='{"target":"es2020"}' yarn ts-node ./scripts/presets-interface-smoke.ts
import { strict as assert } from "assert";
import path = require("path");
import { CachePipeline } from "../src/main/typescript/elvarg/game/cache/CachePipeline";
import { Location } from "../src/main/typescript/elvarg/game/model/Location";

// PrayerHandler <-> QuickPrayers is a require cycle that only resolves when the server
// boots in its usual order; the preset renderer never touches prayers, so stub it out.
const prayerHandlerPath = require.resolve(
  "../src/main/typescript/elvarg/game/content/PrayerHandler"
);
require.cache[prayerHandlerPath] = {
  exports: { PrayerHandler: {}, PrayerData: { values: () => [] } },
} as NodeModule;

const {
  GROUP_ID,
  COMPONENT,
  LAYERED_COMPONENT_PAIRS,
  CONTENT_X,
  CONTENT_RIGHT,
  CONTENT_BOTTOM,
  MIN_MODAL,
  EQUIPMENT_PLACEHOLDER_START,
  PRESET_ROW_START,
  PRESET_ROW_COUNT,
  GLOBAL_ROW_COUNT,
  INVENTORY_SLOT_START,
  EQUIPMENT_SLOT_START,
  EQUIPMENT_SLOTS,
  STAT_ROW_START,
  STAT_MAX_ROW_START,
  uid,
} = require("../plugins/modes/pvp/presetsWidget");
const Presets = require("../plugins/modes/pvp/Presets");
const PvpMode = require("../plugins/modes/PvpMode.plugin");

type Sent = { call: string; args: any[] };

function stubPlayer(sent: Sent[], location: any = null) {
  const record = (call: string) => (...args: any[]) => {
    sent.push({ call, args });
    return sender;
  };
  const sender: any = new Proxy(
    {
      sendString: record("sendString"),
      sendItemOnInterfaces: record("sendItemOnInterfaces"),
      sendSubInterface: record("sendSubInterface"),
      sendInterfaceDisplayState: record("sendInterfaceDisplayState"),
      sendMessage: record("sendMessage"),
    },
    { get: (target, property) => (target as any)[property] ?? (() => sender) }
  );

  let currentPreset: any = null;
  let presets: any[] = [];
  let interfaceId = -1;
  const attributes = new Map<string, unknown>();
  return {
    getPacketSender: () => sender,
    getCurrentPreset: () => currentPreset,
    setCurrentPreset: (preset: any) => {
      currentPreset = preset;
    },
    getPresets: () => presets,
    setPresets: (next: any[]) => {
      presets = next;
    },
    getInterfaceId: () => interfaceId,
    setInterfaceId: (id: number) => {
      interfaceId = id;
    },
    getAttribute: (key: string) => attributes.get(key),
    setAttribute: (key: string, value: unknown) => attributes.set(key, value),
    isPlayerBot: () => false,
    busy: () => false,
    getLocation: () => location,
  };
}

type Box = { id: number; x0: number; y0: number; x1: number; y1: number };

/**
 * The frame draws a border and title bar over the group, so everything has to fit the
 * usable area, and nothing may sit on top of anything else - which is what the first few
 * attempts at this layout got wrong.
 *
 * Only components positioned absolutely can be checked this way; the root, the frame and
 * the close button use position modes, where rawX is an inset rather than a coordinate.
 */
function assertNothingOverlaps(definition: any): void {
    // The root fills its modal slot, so the layout has to fit the smallest window worth
    // supporting. Bottom-anchored components are checked against that height separately.
    const CONTENT = { x0: CONTENT_X, y0: 26, x1: CONTENT_RIGHT, y1: CONTENT_BOTTOM };

    const boxes: Box[] = definition.widgets
        .filter(
            (widget: any) =>
                widget.parentUid === uid(COMPONENT.ROOT) &&
                !(widget.xPositionMode | 0) &&
                !(widget.yPositionMode | 0) &&
                widget.fileId !== COMPONENT.FRAME
        )
        .map((widget: any) => ({
            id: widget.fileId,
            x0: widget.rawX | 0,
            y0: widget.rawY | 0,
            x1: (widget.rawX | 0) + (widget.rawWidth | 0),
            y1: (widget.rawY | 0) + (widget.rawHeight | 0),
        }));

    for (const box of boxes) {
        assert.ok(
            box.x0 >= CONTENT.x0 && box.x1 <= CONTENT.x1 && box.y0 >= CONTENT.y0 && box.y1 <= CONTENT.y1,
            `component ${box.id} (${box.x0},${box.y0})-(${box.x1},${box.y1}) leaves the frame`
        );
    }

    // An item icon is meant to sit inside its own background, and a button label on top of
    // its own button. Everything else overlapping is a layout bug.
    const layered = new Set(
        (LAYERED_COMPONENT_PAIRS as number[][]).map(([front, back]) =>
            [front, back].sort((left, right) => left - right).join(":")
        )
    );
    const paired = (a: Box, b: Box) =>
        layered.has([a.id, b.id].sort((left, right) => left - right).join(":"));
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const b = boxes[j];
            if (paired(a, b)) continue;
            const overlaps = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
            assert.ok(
                !overlaps,
                `components ${a.id} and ${b.id} overlap: ` +
                    `(${a.x0},${a.y0})-(${a.x1},${a.y1}) vs (${b.x0},${b.y0})-(${b.x1},${b.y1})`
            );
        }
    }
}

async function main() {
    await CachePipeline.initialize(path.resolve(__dirname, ".."));

    let openPresets: ((event: any) => boolean) | undefined;
    let actionButtons: ((event: any) => boolean) | undefined;
    let registeredGroupId = -1;
    let registeredWidgets = 0;
    let registeredDefinition: any;

    const api = new Proxy<any>(
        {
            registerCustomInterface: (definition: any) => {
                registeredGroupId = definition.groupId;
                registeredWidgets = definition.widgets.length;
                registeredDefinition = definition;
            },
            registerCommand: (command: string, handler: any) => {
                if (command === "presets") openPresets = handler;
            },
            onInterfaceActionButton: (_ids: number[], handler: any) => {
                actionButtons = handler;
            },
        },
        { get: (target, property) => (target as any)[property] ?? (() => undefined) }
    );
    PvpMode.register(api);

    assert.equal(registeredGroupId, GROUP_ID, "the interface must be registered as a resource");
    assert.ok(registeredWidgets > 100, "the widget group travels with it");
    assert.ok(openPresets, "::presets must be registered for everyone");

    // The preset column scrolls, and its declared content height has to match the rows the
    // widget group actually lays out or the scrollbar lies about how far there is to go.
    const region = registeredDefinition.scroll?.[0];
    assert.ok(region, "the preset list must be declared scrollable");
    assert.equal(region.viewComponent, COMPONENT.LIST_VIEW);
    const rows = registeredDefinition.widgets.filter(
        (widget: any) =>
            widget.parentUid === uid(COMPONENT.LIST_VIEW) && widget.type === 4
    );
    assert.equal(
        rows.length,
        PRESET_ROW_COUNT,
        "every preset row lives inside the scrolling view",
    );
    const lowestRow = Math.max(...rows.map((row: any) => (row.rawY | 0) + (row.rawHeight | 0)));
    assert.ok(
        region.contentHeight >= lowestRow,
        `declared scroll height ${region.contentHeight} must cover the rows (${lowestRow})`,
    );

    // Opening mounts the group and fills both preset lists.
    const sent: Sent[] = [];
    const player = stubPlayer(sent);
    openPresets!({ player });

    const mount = sent.find((entry) => entry.call === "sendSubInterface");
    assert.ok(mount, "opening must mount the interface");
    assert.equal(mount!.args[1], GROUP_ID);
    assert.equal(player.getInterfaceId(), GROUP_ID, "the open interface is tracked");

    const feroxPlayer = stubPlayer([], new Location(3140, 3630, 0));
    openPresets!({ player: feroxPlayer });
    assert.equal(feroxPlayer.getInterfaceId(), GROUP_ID, "::presets must open inside the Ferox safe zone");

    const stringAt = (component: number) =>
        [...sent].reverse().find(
            (entry) => entry.call === "sendString" && entry.args[1] === uid(component)
        )?.args[0];
    assert.match(String(stringAt(PRESET_ROW_START)), /\w/, "presets are listed");
    assert.match(
        String(stringAt(PRESET_ROW_START + GLOBAL_ROW_COUNT)),
        /Empty slot/,
        "the player's own slots follow, in the same list",
    );
    assert.equal(
        stringAt(COMPONENT.SELECTED_NAME),
        Presets.getGlobalPresetPool()[0].getName(),
        "::presets opens with its default preset selected",
    );
    assert.match(String(stringAt(COMPONENT.LOAD_BUTTON + 50)), /Load preset/);
    assert.match(String(stringAt(COMPONENT.DEATH_BUTTON + 50)), /On death/);

    // Selecting a global preset renders it without applying anything.
    sent.length = 0;
    const preset = Presets.getGlobalPresetPool()[0];
    actionButtons!({ player, buttonId: uid(PRESET_ROW_START) });
    assert.equal(player.getCurrentPreset(), preset, "the row selects that preset");
    assert.equal(stringAt(COMPONENT.SELECTED_NAME), preset.getName());
    // The box has a divider, so the level is drawn on both sides of it.
    assert.match(String(stringAt(STAT_ROW_START)), /^\d+$/, "the current level is rendered");
    assert.equal(
        stringAt(STAT_MAX_ROW_START),
        stringAt(STAT_ROW_START),
        "and the maximum beneath the divider",
    );

    // The selected preset is the white row in the list.
    assert.equal(
        stringAt(PRESET_ROW_START),
        `<col=ffffff>${preset.getName()}</col>`,
        "the selected preset is highlighted",
    );
    assert.match(
        String(stringAt(PRESET_ROW_START + 1)),
        /^<col=c5b79b>/,
        "the others are not",
    );
    assert.match(String(stringAt(COMPONENT.SPELLBOOK)), /^Spellbook: /);

    const items = sent.filter((entry) => entry.call === "sendItemOnInterfaces");
    const inventorySlots = items.filter(
        (entry) => entry.args[0] >= uid(INVENTORY_SLOT_START) && entry.args[0] < uid(INVENTORY_SLOT_START + 28)
    );
    assert.equal(inventorySlots.length, 28, "every inventory slot is written, filled or not");
    assert.ok(
        inventorySlots.some((entry) => entry.args[1] > 0),
        "the preset's inventory is shown"
    );
    const equipmentUids = EQUIPMENT_SLOTS.map((slot: number) => uid(EQUIPMENT_SLOT_START + slot));
    const equipped = items.filter(
        (entry) => equipmentUids.includes(entry.args[0]) && entry.args[1] > 0
    );
    assert.ok(equipped.length > 0, "the preset's equipment is shown");
    const strayEquipment = items.filter(
        (entry) =>
            entry.args[0] >= uid(EQUIPMENT_SLOT_START) &&
            entry.args[0] < uid(EQUIPMENT_SLOT_START + 20) &&
            !equipmentUids.includes(entry.args[0])
    );
    assert.deepEqual(strayEquipment, [], "no item is written to a slot the layout omits");

    // Empty equipment slots show the cache's own silhouettes, and a filled one hides its.
    const placeholders = registeredDefinition.widgets.filter(
        (widget: any) =>
            widget.fileId >= EQUIPMENT_PLACEHOLDER_START &&
            widget.fileId < EQUIPMENT_PLACEHOLDER_START + 20
    );
    assert.equal(
        placeholders.length,
        EQUIPMENT_SLOTS.length,
        "every equipment slot has an empty-slot silhouette",
    );
    for (const placeholder of placeholders) {
        assert.ok(
            (placeholder.spriteId | 0) > 0,
            `equipment placeholder ${placeholder.fileId} has no sprite`,
        );
    }
    const hiddenPlaceholders = sent.filter(
        (entry) =>
            entry.call === "sendInterfaceDisplayState" &&
            entry.args[0] >= uid(EQUIPMENT_PLACEHOLDER_START) &&
            entry.args[1] === true,
    );
    assert.equal(
        hiddenPlaceholders.length,
        equipped.length,
        "a slot with an item hides its silhouette",
    );

    // The close button comes from the cache's own frame script, so this interface gets the
    // same widget - and the same hover and pressed states - as every other one.
    const frameScript = mount!.args[3].postScripts[0];
    assert.equal(frameScript.scriptId, 227, "the frame script that includes a close button");
    assert.equal(frameScript.args[0], uid(COMPONENT.FRAME));

    assertNothingOverlaps(registeredDefinition);

    console.log(
        `presets interface ok: ${registeredWidgets} widgets, '${preset.getName()}' -> ` +
            `${inventorySlots.filter((entry) => entry.args[1] > 0).length} items, ` +
            `${equipped.length} equipped`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
