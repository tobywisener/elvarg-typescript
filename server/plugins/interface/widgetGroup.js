/**
 * Builds widget groups for interfaces that do not exist in the game cache.
 *
 * The client's widget nodes carry a lot of fields; every component needs all of them, so
 * this fills in the defaults and lets a caller describe only what differs. The finished
 * group is handed to api.registerCustomInterface and served from /api/interfaces/<groupId>.
 */

// actions[i] is op i+1 client-side (inferWidgetOpId), and each op needs its transmit bit
// set in flags or the client will not send the click.
const FLAG_OP1 = 1 << 1;
const FLAG_OP2 = 1 << 2;

const TYPE_LAYER = 0;
const TYPE_RECTANGLE = 3;
const TYPE_TEXT = 4;
const TYPE_GRAPHIC = 5;
const TYPE_MODEL = 6;

function createWidgetGroup(groupId) {
  const widgets = [];
  const uid = (component) => (groupId << 16) | component;

  const add = (component, parent, overrides = {}) => {
    const id = uid(component);
    widgets.push({
      uid: id,
      id,
      childIndex: -1,
      parentUid: parent,
      groupId,
      fileId: component,
      isIf3: true,
      type: TYPE_LAYER,
      contentType: 0,
      rawX: 0,
      rawY: 0,
      rawWidth: 0,
      rawHeight: 0,
      widthMode: 0,
      heightMode: 0,
      xPositionMode: 0,
      yPositionMode: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      scrollX: 0,
      scrollY: 0,
      scrollWidth: 0,
      scrollHeight: 0,
      isHidden: false,
      hidden: false,
      cachedHidden: false,
      rootIndex: -1,
      cycle: -1,
      modelFrame: 0,
      modelFrameCycle: 0,
      aspectWidth: 1,
      aspectHeight: 1,
      itemId: -1,
      itemQuantity: 0,
      ...overrides,
    });
    return id;
  };

  return { groupId, widgets, uid, add };
}

module.exports = {
  FLAG_OP1,
  FLAG_OP2,
  TYPE_LAYER,
  TYPE_RECTANGLE,
  TYPE_TEXT,
  TYPE_GRAPHIC,
  TYPE_MODEL,
  createWidgetGroup,
};
