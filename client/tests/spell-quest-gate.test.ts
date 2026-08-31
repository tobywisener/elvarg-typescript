import assert from "node:assert/strict";
import { ObjType } from "../rs/config/objtype/ObjType";
import { registerClientOps } from "../rs/cs2/handlers/ClientOps";
import { Opcodes } from "../rs/cs2/Opcodes";

const spell: any = Object.create(ObjType.prototype);
Object.defineProperty(spell, "id", { value: 25511 });
spell.params = new Map([[596, 1], [1189, 81]]);
spell.post();
assert.equal(spell.params.has(1189), false);

const item: any = Object.create(ObjType.prototype);
item.params = new Map([[1189, 81]]);
item.post();
assert.equal(item.params.has(1189), true);

const thrall: any = Object.create(ObjType.prototype);
Object.defineProperty(thrall, "id", { value: 25511 });
thrall.params = new Map([[596, 1], [365, 558], [366, 5], [367, 556], [368, 10], [369, 564], [370, 1]]);
thrall.post();
assert.deepEqual([...thrall.params.entries()].filter(([key]) => key >= 365 && key <= 370 || key === 606 || key === 607), [
    [365, 25818], [366, 1], [367, 558], [368, 5], [369, 556], [370, 10], [606, 564], [607, 1],
]);

const handlers = new Map();
registerClientOps(handlers as never);
const invTotal = handlers.get(Opcodes.INV_TOTAL) as (ctx: any) => void;

const bookRequirementCount = (scriptId: number, backpackBooks: number, equippedBooks: number): number => {
    const ctx: any = {
        currentScriptId: scriptId,
        intStack: Int32Array.from([93, 25818]),
        intStackSize: 2,
        getInventory: (id: number) => id === 93
            ? { count: () => backpackBooks }
            : id === 94
                ? { count: () => equippedBooks }
                : undefined,
        pushInt(value: number) {
            this.intStack[this.intStackSize++] = value;
        },
    };
    invTotal(ctx);
    return ctx.intStack[0];
};

assert.equal(bookRequirementCount(19, 0, 1), 1);
assert.equal(bookRequirementCount(19, 1, 0), 0);
assert.equal(bookRequirementCount(9346, 0, 1), 0);
assert.equal(bookRequirementCount(9346, 1, 0), 1);

console.log("spell quest gate test passed");
