import { strict as assert } from "node:assert";

import { SplitPrivateChatPlugin } from "../game/plugins/splitprivatechat/SplitPrivateChatPlugin";

const plugin = new SplitPrivateChatPlugin();

plugin.addMessage({ messageType: "public", text: "Hello", from: "Alice" }, 1_000);
assert.equal(plugin.getState().messages.length, 0, "public chat must stay out of split chat");

plugin.addMessage({ messageType: "private_in", text: "<col=ff0000>Hello</col>", from: "<img=1>Alice" }, 1_000);
plugin.addMessage({ messageType: "private_out", text: "Hi", from: "Bob" }, 1_001);
assert.deepEqual(
    plugin.getState().messages.map((message) => message.text),
    ["From Alice: Hello", "To Bob: Hi"],
);

plugin.prune(11_001);
assert.equal(plugin.getState().messages.length, 0, "expired messages must disappear");

console.log("split private chat plugin smoke test passed");
