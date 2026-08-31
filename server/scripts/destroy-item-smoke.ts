import assert = require("assert");

const plugin = require("../plugins/interface/DestroyItem.plugin.js");
const handlers = new Map<number, (event: { player: any }) => boolean | void>();
let dropPolicy: ((event: any) => void) | undefined;
let interfaceDefinition: any;
plugin.register({
  onInterfaceActionButton(buttonIds: number | number[], handler: (event: { player: any }) => boolean | void) {
    for (const buttonId of Array.isArray(buttonIds) ? buttonIds : [buttonIds]) {
      handlers.set(buttonId, handler);
    }
  },
  onItemDropPolicy(handler: (event: any) => void) {
    dropPolicy = handler;
  },
  registerCustomInterface(definition: any) {
    interfaceDefinition = definition;
  },
});

function player(itemId: number, amount: number) {
  const item = {
    getId: () => itemId,
    getAmount: () => amount,
    getDefinition: () => ({ getName: () => "Book of the dead", isDropable: () => false }),
  };
  let chatboxId = -1;
  let destroyedAt: [number, number, number] | undefined;
  const inventory = {
    getItems: () => [item],
    deleteAtSlot: (slot: number, quantity: number) => {
      destroyedAt = [slot, itemId, quantity];
      amount = 0;
    },
  };
  let destroyItem = itemId;
  let closed = false;
  const sender = {
    sendChatboxInterface: (id: number) => { chatboxId = id; return sender; },
    sendItemOnInterface: () => sender,
    sendString: () => sender,
    isChatboxInterface: (id: number) => chatboxId === id,
    sendInterfaceRemoval: () => { closed = true; destroyItem = -1; chatboxId = -1; },
  };
  return {
    getDestroyItem: () => destroyItem,
    setDestroyItem: (id: number) => { destroyItem = id; },
    getInventory: () => inventory,
    getPacketSender: () => sender,
    result: () => ({ amount, closed, destroyedAt }),
  };
}

assert.equal(interfaceDefinition.groupId, 30005);
assert.equal(interfaceDefinition.widgets.length, 13);
const yes = handlers.get((30005 << 16) | 11)!;
const no = handlers.get((30005 << 16) | 12)!;
const confirmed = player(4151, 2);
const drop = { player: confirmed, item: confirmed.getInventory().getItems()[0], itemId: 4151, slot: 0, handled: false };
dropPolicy!(drop);
assert(drop.handled, "destroyable item should open the confirmation interface");
yes({ player: confirmed });
assert.deepStrictEqual(confirmed.result(), { amount: 0, closed: true, destroyedAt: [0, 4151, 2] });

const cancelled = player(4151, 2);
dropPolicy!({ player: cancelled, item: cancelled.getInventory().getItems()[0], itemId: 4151, slot: 0, handled: false });
no({ player: cancelled });
assert.deepStrictEqual(cancelled.result(), { amount: 2, closed: true, destroyedAt: undefined });

console.log("destroy-item smoke passed");
