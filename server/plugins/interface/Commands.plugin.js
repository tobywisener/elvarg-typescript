const { TYPE_TEXT, createWidgetGroup } = require("./widgetGroup");

const GROUP_ID = 30004;
const MAIN_MODAL_UID = (161 << 16) | 16;
const COMPONENT = { ROOT: 0, FRAME: 1, LIST_VIEW: 2, LIST_SCROLLBAR: 3, ROW_START: 10 };
const ROW_COUNT = 128;
const ROW_HEIGHT = 16;
const LIST_CONTENT_HEIGHT = ROW_COUNT * ROW_HEIGHT + 4;
const uid = (component) => (GROUP_ID << 16) | component;

const COMMANDS = {
  player: [
    "::commands - Open this command list",
    "::players / ::online / ::who - List online players",
    "::claim - Purchase-claim information",
    "::store / ::donate - Open the store",
    "::kdr - Say your kill/death ratio",
    "::timeplayed - Say your play time",
    "::creationdate - Say your account creation date",
    "::changepassword [password] - Change password",
    "::lockxp - Toggle experience lock",
    "::maxhit / ::mh [player] - Check melee max hit",
    "::thread [id] - Open a forum thread",
    "::title [text] - Set your title",
    "::skull - Apply a white skull",
    "::redskull - Apply a red skull",
    "::yell [message] - Staff and donors only",
    "::presets - Open the presets interface",
  ],
  moderator: ["No moderator-only commands are currently registered."],
  admin: [
    "::tele x y [z] - Teleport to coordinates",
    "::coords - Show your coordinates",
    "::glow [preset] [intensity] [player] - Set glow",
    "::teleto [player] / ::teletome [player]",
    "::item [id] [amount] - Spawn an item",
    "::saveall - Save all players",
    "::botme [on|off|toggle|status] - Control yourself as a bot",
    "::bh [player] [behaviour] - Set bot behaviour",
    "::bothotspots - Show bot hotspot counts",
    "::pluginperf [once|on|off|reset] [limit] [intervalMs]",
    "::serverperf [ticks] - Show server performance",
  ],
  developer: [
    "::kick [player] / ::exit [player] / ::copybank [player]",
    "::bank / ::runes / ::master / ::reset",
    "::normal / ::lunar / ::ancients / ::arceuus",
    "::pnpc [npc-id] / ::npc [id] [amount] / ::npcanim [npc-id]",
    "::npcperm [id] [radius] [facing] / ::object [id] [type] [rotation]",
    "::mypos / ::config [id] [value] / ::spec [amount]",
    "::gfx [id] [height] / ::sound [id] / ::anim [id]",
    "::interface [id] / ::chatboxinterface [id] / ::update [seconds]",
    "::area / ::infhp / ::poisonme [amount] / ::taskdebug",
    "::noclip / ::up / ::down / ::save / ::reprocorruptsave [player]",
    "::cwar [x] [y] / ::listsizes / ::atkrange [distance]",
    "::attackrange [distance] / ::unlockprayers [0|1|2]",
    "::gesell [item-id] / ::flood [amount]",
    "::reloadpunishments / ::reloadshops / ::reloaddrops",
    "::reloadnpcspawns / ::reloadnpcdefs / ::reloaditems",
    "::logstatus / ::loglevels [levels] / ::logtypeon [types]",
    "::logtypeoff [types] / ::logtypeclear [enabled|all]",
    "::mute [player] / ::unmute [player] / ::ipmute [player]",
    "::unipmute [player] / ::ban [player] / ::unban [player] / ::ipban [player]",
    "::t / ::barrage / ::dialogue / ::items / ::ground (owner only)",
    "::procregion [x] [y] [seed] / ::procregionhere [seed]",
    "::cleargen / ::procregscan [radius] / ::procreglearn [radius]",
    "::dumphouse [tag] [type] / ::dumpterrain [biome]",
    "::genterrain [biome] [seed] / ::buildhouse [style] [index]",
    "::genhouse [style] [type] [seed] / ::genstreet [style] [type] [seed]",
    "::checkhouse",
  ],
};

function rightsLevel(player) {
  const id = player?.getRights?.()?.getId?.();
  if (id === 4 || id === 3) return 3;
  return Number.isInteger(id) ? Math.max(0, Math.min(2, id)) : 0;
}

function commandRows(player) {
  const level = rightsLevel(player);
  const sections = [["Player commands", COMMANDS.player]];
  if (level >= 1) sections.push(["Moderator commands", COMMANDS.moderator]);
  if (level >= 2) sections.push(["Administrator commands", COMMANDS.admin]);
  if (level >= 3) sections.push(["Developer commands", COMMANDS.developer]);
  return sections.flatMap(([title, commands]) => [
    `<col=ffd27f>${title}</col>`,
    ...commands.map((command) => `<col=e8ded0>${command}</col>`),
    "",
  ]);
}

function buildWidgetGroup() {
  const { widgets, add } = createWidgetGroup(GROUP_ID);
  const root = add(COMPONENT.ROOT, -1, {
    rawWidth: 18,
    rawHeight: 18,
    widthMode: 1,
    heightMode: 1,
    width: 494,
    height: 316,
    xPositionMode: 1,
    yPositionMode: 1,
  });
  add(COMPONENT.FRAME, root, { widthMode: 1, heightMode: 1, width: 494, height: 316 });
  const list = add(COMPONENT.LIST_VIEW, root, {
    rawX: 18,
    rawY: 30,
    rawWidth: 442,
    rawHeight: 270,
    width: 442,
    height: 270,
    scrollWidth: 442,
    scrollHeight: LIST_CONTENT_HEIGHT,
  });
  add(COMPONENT.LIST_SCROLLBAR, root, {
    rawX: 464,
    rawY: 30,
    rawWidth: 16,
    rawHeight: 270,
    width: 16,
    height: 270,
    noClickThrough: true,
  });
  for (let row = 0; row < ROW_COUNT; row++) {
    add(COMPONENT.ROW_START + row, list, {
      type: TYPE_TEXT,
      rawY: row * ROW_HEIGHT,
      rawWidth: 442,
      rawHeight: 14,
      width: 442,
      height: 14,
      text: "",
      fontId: 494,
      textColor: 0xe8ded0,
      textShadowed: true,
      yTextAlignment: 1,
    });
  }
  return { groupId: GROUP_ID, widgets };
}

const INTERFACE_DEFINITION = {
  ...buildWidgetGroup(),
  scroll: [{ viewComponent: COMPONENT.LIST_VIEW, scrollbarComponent: COMPONENT.LIST_SCROLLBAR, contentHeight: LIST_CONTENT_HEIGHT }],
};

function openCommands(player) {
  const sender = player.getPacketSender();
  const rows = commandRows(player);
  player.setInterfaceId(GROUP_ID);
  sender.sendSubInterface(MAIN_MODAL_UID, GROUP_ID, 0, {
    postScripts: [{ scriptId: 227, args: [uid(COMPONENT.FRAME), "Commands"] }],
  });
  for (let row = 0; row < ROW_COUNT; row++) {
    sender
      .sendString(rows[row] ?? "", uid(COMPONENT.ROW_START + row))
      .sendInterfaceDisplayState(uid(COMPONENT.ROW_START + row), row >= rows.length);
  }
}

module.exports = {
  name: "Commands",
  register(api) {
    api.registerCustomInterface(INTERFACE_DEFINITION);
    api.registerCommand("commands", ({ player }) => {
      openCommands(player);
      return true;
    });
  },
  _test: { commandRows, GROUP_ID, COMPONENT, ROW_COUNT, LIST_CONTENT_HEIGHT, uid },
};
