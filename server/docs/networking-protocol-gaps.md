# Networking Protocol Gaps

**Purpose:** track where elvarg-web-server's live gameplay behavior diverges from xrsps-typescript's
— actual broken/no-op/wrong features, not just missing packet-dispatch cases. Updated 2026-08-12 for
open-source release; supersedes the previous dispatch-level-only version. Verified directly against
both the xrsps-typescript and elvarg-web-server source by tracing each feature's real code path
(client packet → server handler → game state → outbound encoder → what the client actually renders),
not inferred from a switch statement existing.

Context: elvarg-web-server started as a port of an older Java-style Elvarg server. It's since been
adapted to speak xrsps-typescript's own custom protocol - xrsps-typescript's client is the actual
client this project serves. `PACKET_PROTOCOL_COMPARISON.md` (repo root) is a narrower audit that
checks only opcode numbers and declared frame lengths and found 160/160 exact matches across all
three packet families. That is necessary but not sufficient: a packet can have the exact right ID
and frame length and still be discarded, hardcoded to a dummy value, or built by dead code that never
reaches the wire. This document is the deeper, feature-level follow-up.

## Fixed since the previous version of this doc (2026-08-12)

- **Overhead prayer icon and skull icon** now render correctly. Root cause and fix are described in
  the "Dead code" section below (the fix was ported out of `PlayerUpdating.ts`/`NPCUpdating.ts`
  before those files were deleted).
- **Banned/IP-banned players could log in** - the only place ban checks existed
  (`LoginResponses.evaluate()`) was dead code with zero live callers; the live `login()` handler in
  `NetworkBuilder.ts` never called it. Ported `PlayerPunishment.banned()`/`IPBanned()` checks
  directly into the live login handler (`NetworkBuilder.ts`, right after name/password validation).
  This wasn't caught by the original handler-level audit because it required checking the *login*
  path specifically, not the per-tick packet dispatch the rest of this doc focuses on.
- **The entire dead legacy encoder and legacy networking file cluster has been deleted** - see "Dead
  code" below for the full list and what was ported out of each before deletion.
- **`PacketSender.ts` cleaned up** - 1785 → 1036 lines. See "PacketSender.ts cleanup" below for the
  full breakdown: every method that only wrote to the dead `PlayerSession.write()` sink with zero
  real callers was deleted outright; every already-live method's unreachable dead-code tail (the
  `if (sendClientPacket(...)) return this;` pattern always returns, since `sendClientPacket()` itself
  always returns `true` - so everything after it was dead) was stripped; `sendConsoleMessage` was
  found to be a pure duplicate of the already-live `sendMessage` and merged into it. The methods that
  are dead *and* still have real callers (actual broken features, not just clutter) are catalogued
  individually below, with what would be needed to fix each - most need new client-side work in
  xrsps-typescript, not just an elvarg-side wiring fix.
- **`sendEnterAmountPrompt`/`sendEnterInputPrompt` fixed** - server-initiated numeric/text entry
  prompts (admin `::setlevel`, clan chat channel naming, preset naming, shop custom quantity) now
  work. The reference wasn't in xrsps-typescript (it has no server-initiated prompt implementation
  at all) but in OpenRune-Server: `ProtectedAccess.countDialog()`/`stringDialog()`
  (`api/player/src/main/kotlin/org/rsmod/api/player/protect/ProtectedAccess.kt:2806-2839`) call
  `mesLayerMode7`/`mesLayerMode9` (`api/player-output/.../ClientScripts.kt:78-82`), which resolve to
  real, cache-verified OSRS clientscript IDs: `runClientScript(108, title)` opens the numeric prompt,
  `runClientScript(110, title, mode)` opens the free-text one. Confirmed xrsps's client actually
  executes real cache CS2 bytecode for server-pushed `runClientScript` calls (not a stub) at
  `client/network/serverConnection/handlers/inboundWorld.ts:277-305`. Both methods now delegate to
  the already-live `sendClientScript()` wrapper with those two script IDs - no new encoder needed,
  and the response side (`resume_countdialog`/`resume_namedialog`/`resume_stringdialog`) was already
  working. See `net/packet/PacketSender.ts:260-268`.

## The recurring bug pattern

Almost every confirmed bug below is one of these three shapes:

1. **Dead legacy encoder.** Before this cleanup, `game/entity/updating/PlayerUpdating.ts` and its
   sibling `NPCUpdating.ts` were large, fully-computed old-Java-Elvarg-style update encoders
   (bit-packed packet 81, `AccessType.BIT`) that correctly read real game state, but both ended by
   calling `player.getSession().write(packet)` into a hardcoded no-op sink
   (`PlayerSession.write()`). The actual live path is `PlayerSession.ts`'s per-tick `flushClient()`
   → `createPlayerView()`/`createActorUpdates()` → `encodePlayerSync`/`encodeNpcSync`
   (`net/protocol/ClientProtocol.ts`). Any field the dead encoders computed that the live path never
   picked up was a silent regression - correct-looking code sitting right next to the real bug. Both
   files are now gone (see "Dead code" below). `net/packet/PacketSender.ts` had the identical pattern
   at much larger scale (~140 methods) - see "PacketSender.ts cleanup" below.
2. **Live encoder hardcodes a stub value.** The live path exists and runs, but bakes in a dummy
   constant instead of reading real state.
3. **A handler silently no-ops for a whole case, or decodes a payload field it never reads.**

## Confirmed live-gameplay bugs

### Poison status indicator is a bare no-op
- **What's broken:** the dedicated "you are poisoned" status indicator never appears (per-hit green
  poison damage splats still render fine via the normal hitsplat path - only the persistent status
  indicator is affected).
- **Root cause:** `sendPoisonType()` (`net/packet/PacketSender.ts:254-257`) calls
  `this.player.getSession().write(...)` directly with no live-encoder attempt first - unlike
  `sendRunEnergy`/`sendSpecialAttackState`/`sendQuickPrayersState`, which all try
  `this.player.getSession().sendClientPacket(encodeX(...))` before falling back. This one goes
  straight to the dead path. Live callers that expect this to work:
  `CombatFactory.ts:804` (poison applied), `CombatPoisonEffect.ts:88` (cured),
  `Player.ts:278` (cured on login/effect).

### Freeze/teleblock/vengeance/antifire have no visible timer or indicator
- **What's broken:** all four effects apply correctly server-side (freeze locks movement,
  teleblock blocks teleports, vengeance primes correctly, the "You have been frozen!"-style chat
  message fires) but nothing shows the player a visible countdown or icon for any of them.
- **Root cause:** `sendEffectTimer()` (`net/packet/PacketSender.ts:1358-1360`) is a bare stub:
  ```ts
  sendEffectTimer(_seconds: number, _effect: any): this {
    return this;
  }
  ```
  It doesn't attempt an encode at all. Live callers: `CombatFactory.ts:992` (freeze),
  `magic/EffectSpells.ts:76` (vengeance), `magic/CombatSpells.ts:1386` and
  `model/teleportation/TeleportHandler.ts:121` (teleblock).
- **Compounding cause - the real xrsps mechanism doesn't exist in elvarg at all:** xrsps doesn't
  primarily show these via a timer widget - it tints the actor model itself via a timed HSL color
  override (`setColorOverride(hue, saturation, lightness, weight, durationTicks)`). Confirmed at
  `xrsps-typescript/server/src/game/player.ts:944` (blue tint on freeze),
  `xrsps-typescript/server/src/game/state/PlayerSkillSystem.ts:534,559` (green tint on poison/venom),
  same on `xrsps-typescript/server/src/game/npc.ts:387,1010,1041` for NPCs, encoded via
  `writeColorOverride()` in `xrsps-typescript/.../PlayerPacketEncoder.ts:361-365,1266`. elvarg has
  **no equivalent anywhere** - no color/tint field on `ActorUpdateView`/`PlayerView`/`NpcView`
  (`net/protocol/ClientProtocol.ts:71-105`), no `setColorOverride` method on `Mobile`/`Player`/`NPC`,
  zero occurrences of "colorOverride" in the codebase. Freeze/poison/venom currently have zero
  client-visible indicator through either of the two channels that should carry it.

### Ground/tile graphics never render
- **What's broken:** any visual effect anchored to a location rather than a character - altar
  activation flashes, boss ground-effect mechanics, teleport-area visuals - is silently invisible.
  Per-actor spotanim (the graphic attached to a player/NPC) is unaffected and confirmed working.
- **Root cause:** `sendGraphic()`/`sendGlobalGraphic()` (`net/packet/PacketSender.ts:1362-1368`) are
  bare no-op stubs (`(..._args: any[]): this { return this; }`) with commented-out real
  implementations directly above them at `PacketSender.ts:973,1000-1003`. Live callers:
  `game/entity/impl/object/GameObject.ts:73`, `game/World.ts:605`,
  `game/content/combat/method/impl/npcs/VetionCombatMethod.ts:76` (a boss mechanic that depends on
  this being visible), `game/model/movement/path/PathFinder.ts:439`.

### Bank search is unreachable
- **What's broken:** clicking the bank search (magnifying glass) button and typing does nothing -
  no filtering, no dialogue even opens.
- **Root cause:** `Bank.search(player, syntax)` (`Bank.ts:234-265`) is correctly implemented and
  would work if called. Its only trigger, `player.setEnteredSyntaxAction(new bankEntered(...))`
  (`Bank.ts:552-553`), lives inside `Bank.handleButton()` (`Bank.ts:449-560`) - a dead method keyed
  on raw old-opcode widget IDs (`50010`, `8130`, `5386`, etc.) from the pre-cache-native interface
  scheme, with zero live callers. The live widget entry point, `Bank.handleWidgetAction()`
  (`Bank.ts:341-393`, wired from `NetworkBuilder.ts:323`), only handles childIds
  `2, 3, 12, 17, 19, 23, 25, 27, 29, 31, 34, 41, 43` - no search trigger exists there.
  `setEnteredSyntaxAction` is otherwise only ever called with `null` from live code
  (`NetworkBuilder.ts:308`, `PacketSender.ts:1231`).

### Bank tab collapse and the tab-settings submenu are unreachable
- **What's broken:** clicking a tab icon to collapse/reorganize it, and the bank settings submenu,
  do nothing.
- **Root cause:** same dead `Bank.handleButton()` as the search bug above - the collapse branch
  (`action === 1`, `Bank.ts:482-502`), the `50013` settings-menu button, and the note-withdrawal
  quick-toggle buttons (`5386`/`5387`) are all inside it, all zero-caller.
- **Related, not a bug:** tab *viewing/switching* itself has no live server-driven trigger on
  either project - confirmed xrsps's own `PlayerBankSystem.setBankCurrentTab`
  (`xrsps-typescript/server/src/game/state/PlayerBankSystem.ts:193`) is likewise only called from
  state deserialization, never a live handler, meaning tab switching is legitimately client-local
  UI state on both projects. Only the *collapse* action is elvarg-specific dead code.

### Bank tab cross-tab moves are a silent no-op (previously known, root cause now confirmed)
- **What's broken:** dragging an item from one bank tab to another - including onto an empty tab
  to create a new one - does nothing.
- **Root cause:** `NetworkBuilder.ts:250-259`, the `"bank_move"` case:
  ```ts
  if (from && to && from.tab === to.tab) {
    this.player.setInsertMode(packet.mode === "insert");
    Bank.rearrange(this.player, this.player.getBank(from.tab), from.slot, to.slot);
  }
  ```
  Cross-tab moves are excluded by the `from.tab === to.tab` guard, and `packet.tab` - the payload
  field that would carry "put this in tab N" - is never referenced anywhere.
- **Architectural cause, not a one-line fix:** elvarg's bank model is per-tab discrete containers
  (`player.banks: Bank[]`, `Bank.TOTAL_BANK_TABS = 11` - a full separate item array per tab, the old
  Java-Elvarg model). xrsps's actual model (`server/src/game/state/PlayerBankSystem.ts`) is a single
  flat item list with a `tab` field per entry, plus computed tab boundaries
  (`getBankTabSizes()`/`getBankTabStartSlot()`). These two models are structurally incompatible -
  fixing this properly means migrating elvarg's bank storage to the flat-list-with-tab-field model,
  not just relaxing the guard.

### `item_spawner_search` is decoded then discarded
- **What's broken:** the admin item-spawner's search-as-you-type gets nothing back from the server.
- **Root cause:** `net/NetworkBuilder.ts:422-423`:
  ```ts
  case "item_spawner_search":
    continue;
  ```
  xrsps handles this live (`xrsps-typescript/server/src/network/handlers/binaryMessageHandlers.ts:191-209`,
  looks up a registered script handler and invokes it with the query payload).

### `pathfind` silently drops its request/response contract
- **What's broken:** `net/NetworkBuilder.ts:453-455`:
  ```ts
  case "pathfind":
    this.walk(packet.toX, packet.toY, 0);
    continue;
  ```
  converts the request straight into a walk command, ignoring `packet.id`, `packet.fromX/fromY`, and
  `packet.size`, and never sends any correlated response.
- **xrsps does this correctly:** `server/src/network/handlers/movementHandlers.ts:139-173` runs a
  dedicated path-finding service and always replies with `{id, ok, waypoints, message}` correlated by
  the request's `id`. Impact depends on what actually sends `pathfind` client-side (likely a
  debug/admin path-preview tool rather than normal movement, which has its own `walk` packet already
  working) - worth confirming client call sites before prioritizing.

### Logout does not check `canLogout()` - combat-logging is possible
- **What's broken:** the live logout handler unconditionally accepts every logout request and closes
  the socket instantly, regardless of combat state.
  `net/NetworkBuilder.ts:496-500`:
  ```ts
  case "logout":
    this.send(encodeLogoutResponse());
    this.cleanup("logout");
    this.channel.close(1000, "logout");
    return;
  ```
- **xrsps does this correctly:** `server/src/network/handlers/logoutHandler.ts:8-47` calls
  `player.canLogout()` first; if false (in combat, or a non-`NONE` lock state), it replies with
  `logout_response{success:false, reason}` and does **not** disconnect the player.
- **The fix already exists in elvarg, just isn't wired up:** `Player.canLogout()`
  (`game/entity/impl/player/Player.ts:612-622`) implements the identical combat/busy check with
  matching chat messages - it's just never called from the packet handler. Its only current caller is
  `World.ts:710`, a delayed post-disconnect cleanup sweep, not the live logout button.
- **Severity:** highest-value fix in this document - fairness/anti-combat-log gap, one-line fix
  (`if (!player.canLogout()) { ...; return; }` at the top of the `"logout"` case).

## Missing subsystems (would need new work, not just wiring)

### No generic "widget opened" notification
xrsps has a client→server notification for "the client just opened interface X" (distinct from
close), used to sync server-side state when a widget opens
(`server/src/network/handlers/widgetHandler.ts:19-62`, `action === "open"`). elvarg's client can
send it (`net/protocol/ClientProtocol.ts:673-676`, `HighClientPacket.WIDGET`) but
`NetworkBuilder.ts:379-381` only handles `action === "close"` - `"open"` falls through to nothing.
Low current impact - nothing in elvarg today needs to react to a client-initiated widget open (no
side-journal-style feature exists yet).

### No generic indexed/numbered-menu modal
xrsps has a reusable numbered-list modal, `server/src/network/managers/Cs2ModalManager.ts`
(`openIndexedMenu`), driven through `resume_pausebutton`. elvarg has no equivalent anywhere; its own
numbered-choice UI (`DialogueManager`/options dialogue) tops out at 5 options
(`NetworkBuilder.ts:358`, `buttonNum > 0 && <= 5`) rather than an arbitrary-length list. Low current
impact even in xrsps - its only caller there is a `::scroll` debug command.

### Secondary varp mirrors not handled
elvarg's `varp_transmit` handler (`NetworkBuilder.ts:363-378`) covers the core combat varps -
combat style (43), auto-retaliate (172), run toggle (173), special attack (301) - matching xrsps's
`server/src/network/handlers/varpTransmitHandler.ts` for those four, but has no equivalent for
xrsps's shop-quantity varp mirror, esc-to-close-keybinding varbit mirror, or music mode/volume varp
reactions. Low/cosmetic impact.

### `debug` message family unimplemented
xrsps's `ClientToServer` union includes a `debug` type (projectile/anim request-snapshot, `set_var`,
raw) backing an admin debug overlay (`server/src/network/messages.ts:679-692`,
`server/src/network/handlers/debugHandler.ts`). elvarg's decoded-packet union has no `"debug"`
variant at all. No impact for players - admin/dev tooling only.

## Verified working (checked, not a divergence - listed to avoid re-investigating)

- **NPC transformation display** - `npc.getId()` returns the transformed id, used directly as
  `NpcView.typeId` (`PlayerSession.ts:161`); `encodeNpcSync`'s diff logic force-refreshes on a
  typeId change (`ClientProtocol.ts:1916`).
- **Public chat bubble above head** - correctly bypasses the per-tick actor-update masks entirely,
  its own live broadcast path (`ChatPacketListener.ts:26-46` → `sendPublicChat` →
  `encodeChatMessage`).
- **Forced chat / single+double hitsplats / player and NPC spotanim / entity-interaction facing** -
  all correctly wired in both `PlayerSession.createActorUpdates()` and the wire encoders.
- **Player rank/crown/title in the appearance block** - confirmed this is *not* a divergence:
  checked xrsps's own `AppearanceEncoder.ts:143-239` and it never encodes rights/crown/title into
  the appearance block either. The dead `PlayerUpdating.updateAppearance()`'s rights/title bytes are
  vestigial from old-Elvarg's own client, not something xrsps's client expects.
- **Shop** (`game/model/container/shop/ShopManager.ts`) - buy/sell, stock limits, restock timers
  (per-item interval, general-store vs specialty-store decay), multi-currency, examine/price-check -
  all live-wired, no dead-pattern found. (xrsps has no shop system of its own to compare against;
  this is checked for internal correctness only.)
- **Trade** (`game/content/Trading.ts`) - full two-stage accept/confirm state machine, inventory-space
  validation before allowing accept, automatic re-confirmation reset when either side modifies their
  offer after accepting - all correctly implemented.
- **Run energy** - depletes while running, regenerates while idle, both directions synced live each
  tick it changes.
- **Special attack energy bar** - live varp 300 sync confirmed matching xrsps's `VARP_SPECIAL_ENERGY`.
- **Quick-prayers toggle UI state** - live varbit 4103 sync (separate from the overhead prayer icon
  bug above, which is about the icon rendering on the character, not this toggle button's own state).
- **Bank insert-mode toggle, withdraw-as-note toggle, quantity-mode presets, placeholder toggle,
  deposit-inventory/equipment** - all correctly wired through the live `Bank.handleWidgetAction` and
  actually change behavior.
- **`teleport`/`world_map_click`** - both correctly admin-gated identically on both projects
  (`PlayerRights.hasAdminRights` vs `services.canUseAdminTeleport`) - not a gap, regular players
  can't use these on xrsps either.
- **`if_buttond` (drag-and-drop), `if_triggeroplocal`, generic widget-action script-trigger
  routing, `resume_*dialog` family, `if_close`** - all functionally working; elvarg structures the
  dispatch differently (e.g. splitting/merging message types xrsps treats as one) but no missing
  terminal case was found in any of them.
- **Region rebuild / world-entity sync / ping/hello** - egress-only or intentionally no-op on both
  sides; no gap.

## Confirmed client-protocol-blocked (client has no way to send the action)

These are **not fixable server-side alone** - they need a corresponding client-side change in
xrsps-typescript first.

### Clan chat - sending a message
- **What's missing:** typing a message while in clan chat and hitting enter does not transmit
  anything to the server.
- **Why:** the client's CS2 script handler for `CHAT_SENDCLAN` (opcode 5010) is an unimplemented
  stub - it pops its inputs (message, chatType, clanIndex) off the interpreter stack so the VM
  doesn't desync, then discards them. No packet is sent.
  `xrsps-typescript/client/rs/cs2/handlers/ChatOps.ts:153-161`
- The client's only outgoing `chat` packet encoder (`encodeChat`, opcode `CHAT=190`) has a
  hardcoded `messageType === "game" ? 1 : 0` byte - there is no third value for "clan", and the
  function's own type signature (`"public" | "game"`) doesn't allow one.
  `xrsps-typescript/client/network/packet/ClientBinaryEncoder.ts:460-465`
- xrsps's own server-side decoder agrees exactly (`messageTypeVal === 1 ? "game" : "public"`),
  confirming client and server are consistent with each other - this isn't an oversight on one
  side, clan-chat-sending simply isn't wired up anywhere in this client/protocol at all.
  `xrsps-typescript/server/src/network/packet/ClientBinaryDecoder.ts:595-603`
- **What elvarg has today:** clan chat join/leave/setup/rank-management all work fine (they're
  widget/button-driven, going through the live `onButton`/`onInterfaceActionButton` plugin hooks).
  Only *sending a message* is blocked. `allowChat()` (mute + word-filter check) is still defined in
  `plugins/interface/ClanChat.plugin.js` for when this gets fixed - just nothing calls it right now.
- **To fix:** implement `CHAT_SENDCLAN` in the xrsps client to actually call `sendChat` with a
  distinguishable clan flag, extend `encodeChat`/`ClientPacketId.CHAT`'s wire format to carry a
  third messageType value, then mirror that in elvarg's own decoder (`ClientProtocol.ts:154,
  572-573`) and re-add a handler resembling the removed `clanChatPacketListener`.

### Friends list - add/remove friend
### Ignore list - add/remove ignore
### Private messages - send PM
- **What's missing:** none of these actions can be triggered by the client at all.
- **Why:** xrsps's `ClientToServer` message union (the authoritative list of every message type the
  server-side type system even acknowledges) has no add-friend, remove-friend, add-ignore,
  remove-ignore, or private-message variant anywhere. The `chat` message type's `messageType` field
  is `"public" | "game"` only - no `"private_in"`/`"private_out"` incoming variant exists (those
  strings do exist, but only in the *outgoing*, server-to-client messageType enum used for
  displaying messages the server already has some other way of producing - not for the client to
  request sending one). `xrsps-typescript/server/src/network/messages.ts:669-673` (incoming,
  confirmed no private variant); `messages.ts:455-465` (outgoing display-only enum, unrelated)
- **What elvarg has today:** the friends/ignore-list UI and PM interface can presumably be opened
  and viewed, but actually adding/removing a name or sending a message has no live path -
  `plugins/interface/FriendsList.plugin.js` and `plugins/interface/IgnoreList.plugin.js` registered
  their action handlers via `registerAlivePacketListener`, which was only ever fed by the
  now-removed dead dispatch.
- **To fix:** needs real client-side support added to xrsps-typescript first (new message types,
  encoder/decoder support, UI wiring), then corresponding elvarg-side handlers.

## Already re-wired (for reference, not a current gap)

These looked like they might have a client-protocol or dead-dispatch problem but turned out to be
fixable server-side once investigated:

- **Bot recruit-via-trade-request** (`registerBotStatusInteractions.js`) - trade-request already
  cleanly maps to a single event server-side; re-wired onto a `PluginManager.onTradeRequest` hook.
- **Bot "Status" right-click option** - NOT re-wired, but for a different reason than a client
  protocol gap: the protocol hardcodes option-slot 1 as "Attack" with no room for a per-target
  custom relabel, a real design conflict in elvarg's own interaction-option system, not a client
  limitation. Left as a known gap; fixing it means reworking how custom interaction options map onto
  the numeric option field generally.
- **Makeover Mage appearance change** - already works via the live default
  `ChangeAppearancePacketListener.apply()` path, which checks the same eligibility gate the plugin
  relies on. The one real difference (missing per-gender kit/color value clamping) was ported into
  the shared default handler so all appearance changes benefit, not just makeover.
- **Bank Deposit Box container actions** - re-wired onto the live `PluginManager.onItemAction` hook
  (already fed by `ItemActionPacketListener.handleAction`, called from `NetworkBuilder.ts`'s live
  `inventory_action` case for every clickType 1-5).
- **PriceChecker container clicks** - deposit/withdraw quantity clicks route through
  `NetworkBuilder.ts`'s live `inventory_action`/`onItemAction` path; the checker's own (non-
  inventory) container falls through to `onInterfaceActionButton` instead.
- **Smithing equipment-container clicks** - wired onto `onInterfaceActionButton` for the five
  "make X" column widget IDs, since that custom container never matches the real inventory.
- **Bot follow-back / combat-reaction / manual-control detection** - needed live signals that didn't
  exist yet. Added `PluginManager.emitPlayerFollow`/`onPlayerFollow` (from
  `FollowPlayerPacketListener.request`) and `emitPlayerAttack`/`onPlayerAttack` (from
  `PlayerOptionPacketListener.executeClientOption`, option 1). Manual-control detection was re-wired
  onto the existing `onObjectInteraction` hook.
- **Use-item-on-object / use-item-on-npc** - the client already sent the correct message; elvarg's
  dispatch just never read `target.kind === "loc" | "npc"`. `itemOnObject`/`itemOnNpc` were rewired
  into `NetworkBuilder.ts`'s `inventory_use_on` case; native `OPLOCU`/`OPLOC_T`/`OPNPC_U` route to
  the same plugin-owned paths.

## Dead code - remnants of the old raw-opcode/legacy packet systems

### Safe to delete outright (confirmed zero importers anywhere in `src/main/typescript`)

**Deleted in this pass** (all confirmed zero real importers before removal):

| File | Notes |
| --- | --- |
| `net/packet/PacketConstants.ts` | Raw Jagex opcode constants (`SPECIAL_ATTACK_OPCODE`, `ADD_FRIEND_OPCODE`, etc.). Two other files merely *mentioned* "PacketConstants" in a comment - not real references. |
| `net/PacketGuide.ts` | `PACKET_GUIDE` reference table of raw numeric opcode meanings; own comment said "derived from the Java server's PacketConstants/PacketSender... guide only". |
| `net/PacketLogger.ts` | File-based packet logging keyed on a `PACKET_LOGGING` env var, for the old dispatch. Removed the now-dead `PACKET_LOGGING`/`PACKET_OUT_LOGGING` env vars from `package.json`'s `start:prod` script too. |
| `net/PlayerBotSession.ts` | Never instantiated. All methods (`queuePacket`, `processPackets`, `write`, `flush`) were no-op stubs from the same dead-dispatch pattern as `PlayerSession.write()`. |
| `net/BotPlayerSession.ts` | A second, near-duplicate, fully unreferenced bot-session class - an earlier abandoned bot-session approach superseded by the plugin-based bots in `plugins/bots/`. |
| `net/channel/ChannelPipelineHandler.ts` | A full Netty/TCP-pipeline-style login state machine predating the WebSocket rewrite; `Server.ts` only wires up `NetworkBuilder` (the live WebSocket path). Included a ~50-line dead first-draft commented out at the top of the file. |
| `net/channel/ChannelFilter.ts` | Only consumer was the dead `ChannelPipelineHandler.ts`. Also had its own commented-out first draft at the top. |
| `net/codec/LoginDecoder.ts`, `net/codec/LoginEncoder.ts` | Only consumer of both was the dead `ChannelPipelineHandler.ts`. |
| `net/login/LoginResponsePacket.ts` | Only consumer was the dead `LoginEncoder.ts`. |
| `net/SessionState.ts` | 4-line enum (`LOGGING_IN`/`LOGGED_IN`/`REQUESTED_LOG_OUT`), zero references anywhere. |
| `net/login/LoginDetailsMessage.ts` | Only consumer was `PlayerSession.finalizeLogin()` (see below) and the dead `LoginResponses.evaluate()`/`getDiscordResult()`/`getPlayerResult()` methods (also removed - see below). |
| `game/entity/updating/PlayerUpdating.ts`, `game/entity/updating/NPCUpdating.ts` | The dead legacy encoder itself (see "The recurring bug pattern" above). Before deletion, two things were ported out: the skull/prayer overhead-icon values (now real fields on `PlayerAppearance`, read in `PlayerSession.createPlayerView()` and written by `encodePlayerAppearance()` in `net/protocol/ClientProtocol.ts` instead of the old hardcoded `-1, -1`), and the **load-bearing** local-player/local-NPC visibility-list maintenance these files were quietly also responsible for (`player.getLocalPlayers()`/`getLocalNpcs()` - the live per-tick sync path reads these lists directly, so this logic could not simply be deleted along with the dead packet-81 byte encoding). That maintenance now lives in `World.ts` as `updateLocalPlayers()`/`updateLocalNpcs()`, called from the `update_players_npcs` tick phase. NPC overhead-icon transmission (`npc.getHeadIcon()`) has **no live equivalent to port to** - xrsps's own reference server has no per-tick NPC head-icon-override wire mechanism either (checked `NpcPacketEncoder.ts`), so this remains an open gap; `npc.setHeadIcon()`/`getHeadIcon()` are left in place on `NPC.ts` (harmless, just currently write-only) rather than ripped out along with the dead encoder. |

**Not dead - kept:** `net/login/LoginResponses.ts` sits in the same login-codec cluster but has one
genuine live caller outside it, `util/flood/Client.ts` (a load-testing tool wired into `Server.ts`
via `Flooder`), for its `LOGIN_SUCCESSFUL`-style response-code constants. Its dead methods
(`evaluate()`/`getDiscordResult()`/`getPlayerResult()`, only ever reachable via the now-deleted
`PlayerSession.finalizeLogin()`) were removed, but not before checking whether they contained any
logic the live login path was missing - they did: `evaluate()` was the only place
`PlayerPunishment.banned()`/`IPBanned()` were checked. That check is now ported into the live
`login()` handler in `NetworkBuilder.ts` (see "Fixed since the previous version of this doc" above).
`PlayerSession.finalizeLogin()` itself was also removed (dead, `PlayerSession` is constructed from
`NetworkBuilder.ts`, but login is handled inline in `NetworkBuilder.ts`'s `login()`/`enterWorld()`,
bypassing this method entirely).

Also confirmed **still live** (checked because they sit in the same directories and could be
mistaken for legacy remnants): `net/packet/Packet.ts`, `PacketBuilder.ts`, `PacketType.ts`,
`ValueType.ts`, `ByteOrder.ts` (used by the live outbound encoding layer);
`net/InboundPacketProfile.ts`/`OutboundPacketProfile.ts` (used by the live
`net/codec/PacketEncoder.ts`/`PacketDecoder.ts`).

### Still not safe to delete without porting first

| File | What's still needed from it |
| --- | --- |
| `Bank.handleButton()` (`game/model/container/impl/Bank.ts:449-560`) | Dead (keyed on raw old-opcode widget IDs with zero live callers), but contains the only working implementation of bank search (`bankEntered`, line 552), tab collapse (line 482-502), and the note-withdrawal quick-toggle buttons. **Not ported in this pass** - the live widget dispatch (`Bank.handleWidgetAction()`) is keyed on small cache-native childIds (2, 3, 12, 17, 19, ...), and this repo has no reliable source for what childId the search button/tab buttons actually use in the current interface - guessing would risk silently misfiring on an unrelated click. Needs the real childId values (from the cache interface definition or the xrsps client's bank interface script) before this can be ported safely. |

## `PacketSender.ts` cleanup

`net/packet/PacketSender.ts` had the exact same dead-encoder pattern as `PlayerUpdating.ts`/
`NPCUpdating.ts` (see "The recurring bug pattern" above), just spread across ~140 methods instead of
concentrated in two files. Went through every method individually (1785 lines → 1036 lines):

**Zero-caller dead methods, deleted outright** (32 methods, confirmed zero callers anywhere including
optional-chaining call sites like `x?.method?.()`, which a naive grep misses - one of these,
`sendDetails()`, initially looked like it had a caller in `World.ts`, but that caller turned out to
be inside a loop over `World.addPlayerQueue`, a queue nothing anywhere ever pushes to - a second,
pre-existing dead-code island unrelated to this cleanup, discovered only because deleting the method
it called surfaced a compile error): `sendDetails`, `sendRegionReload`, `sendTeleportInterface`,
`sendDungeoneeringTabIcon`, `sendHeight`, `sendIronmanMode`, `sendWeight`, `commandFrame`,
`sendInterfaceReset`, `sendWidgetModel`, `sendFlashingSidebar`, `sendMapState`, `sendCameraAngle`,
`sendCameraShake`, `sendCameraSpin`, `sendCameraNeutrality`, `sendInterfaceScrollReset`,
`sendScrollbarHeight`, `sendCurrentBankTab`, `sendSmithingData`, `clearInterfaceItems`, `sendRights`,
`sendAnimationReset`, `deleteRegionalSpawns`, `sendInterfaceSpriteChange`, `sendHideCombatBox`,
`sendObjectsRemoval`, `sendItemContainers` (a zero-caller alias of the live `sendItemContainer`),
`sendTabs`, `sendItemContainerInterface`, `sendItemOnWidget`, `sendItemOnEquipment`, `sendVarpBatch`.

**Dead position-write cluster, deleted** (`writeLocalPosition`/`resolveLocalPosition`/
`sendPositionIfVisible`/`sendPosition`): called from inside otherwise-live methods
(`sendProjectile`, `alterGroundItem`, `deleteGroundItem`, `createGroundItem`), but only from the
unreachable dead-tail half of an `if (sendClientPacket(...)) return this;` branch - see next
paragraph. Once those dead tails were stripped, this whole cluster had zero remaining callers.

**Dead-tail stripping, ~31 methods** (the file's single biggest source of redundant code):
`PlayerSession.sendClientPacket()` (`net/PlayerSession.ts:80-90`) unconditionally returns `true` on
every code path, including the early-return branches for a closed channel or backpressure. That
means every method shaped like `if (this.player.getSession().sendClientPacket(encodeX(...))) return
this; <old raw-opcode PacketBuilder + write() call>` had a provably unreachable second half - not a
bug exactly (nothing was broken, since the live encoder call above it always ran and always
returned first), but real, measurable dead/duplicated code sitting in the most heavily-used file in
the networking layer. Removed the unreachable tail from all ~31 methods that had one (`sendSpecialAttackState`, `sendSoundEffect`, `sendSong`, `sendJingle`, `sendSpecialMessage`, `sendConfig`,
`sendToggle`, `sendRunEnergy`, `sendQuickPrayersState`, `updateSpecialAttackOrb`, `sendRunStatus`,
`sendInterface`, `sendWalkableInterface`, `sendInterfaceDisplayState`, `sendPlayerHeadOnInterface`,
`sendNpcHeadOnInterface`, `sendInterfaceAnimation`, `sendInterfaceModel`, `sendSidebarInterface`,
`sendChatboxInterface`, `sendItemOnInterfaces`, `sendItemOnInterface`, `clearItemOnInterface`,
`sendString`, `sendMessage`, `sendInterfaceRemoval`, `sendProjectile`, `alterGroundItem`,
`deleteGroundItem`, `createGroundItem`, `sendSkill`).

**Dead commented-out code, deleted**: the file had ~250 lines of commented-out old-draft method
bodies scattered throughout - earlier attempts at methods that were later properly implemented
elsewhere in the same file (old drafts of `sendGraphic`, `sendObject`, `sendObjectRemoval`,
`sendObjectAnimation`, `alterGroundItem`, `createGroundItem`, `deleteGroundItem`, `sendProjectile`,
`sendItemContainer(s)`, `sendPrivateMessage`, `sendEffectTimer`, `sendInterfaceItems`, `sendTabs`,
`sendSkill`, `sendExpDrop`), plus a handful of commented-out imports and a stale duplicated
constructor. Also removed two now-misleading header comments (`// Stubs to satisfy gameplay code;
implement client opcodes as needed.` and `// Additional stubs for gameplay code.`) sitting directly
above methods that are actually live.

**Duplicate live method merged**: `sendConsoleMessage()` was dead (old opcode 123, `.write()` only),
but tracing its 6 callers (`plugins/commands/AdminCommands.plugin.js`) showed every single one was
plain admin-command feedback text ("Noclip enabled.", "Reloaded", etc.) - functionally identical to
the already-live `sendMessage()` (`encodeChatMessage("game", ...)`). Replaced all 6 call sites with
`sendMessage()` and deleted `sendConsoleMessage()`, rather than write a redundant second live
encoder for the same thing.

**False positive, no change needed**: `sendInterfaceSet()` looked dead by a naive "does the method
call `sendClientPacket`" scan, but it actually delegates to two already-live methods
(`sendInterface()` + `sendSidebarInterface()`) - it just doesn't call `sendClientPacket` *directly*.
Confirmed correct as-is.

### Dead methods with real callers - actual broken features, not yet fixable from elvarg alone

These still call the dead `.write()` sink and have live callers (so they're broken today), but unlike
the overhead-icon/login-ban fixes earlier in this doc, none of these had a confirmable live
counterpart to port to - xrsps-typescript's own server has no reference implementation for most of
them either. Fixing these means adding new protocol support (new message types, new client-side CS2
script wiring, or both) in xrsps-typescript first, the same category as "Missing subsystems" above.
Listed here with what was actually checked, not guessed:

| Method (callers) | What it's for | What was checked |
| --- | --- | --- |
| `sendInteractionOption` (16) | Relabeling the right-click menu on other players ("Attack"/"Trade With"/"Challenge"/"null" during duels, wilderness, Castle Wars) | Checked the client's own menu-building code (`client/render/render/interact/check.ts`): "Attack" on other players is **not server-driven at all** - it's gated by `canAttackPlayers = isInWilderness(x, y)`, computed purely from the local player's own coordinates, which the client already has. For wilderness PvP specifically, these calls are provably unnecessary (the client already shows/hides Attack correctly with zero server input). For Castle Wars/Duel Arena, there is **no** server override for the wilderness-only gate - matches the already-documented "Bot Status right-click option" gap in kind: a client-side hardcoded rule, not a missing wire-up. `ClientState.playerAttackOption` (attack-option priority 0-4) *is* server-settable via a varp (`client/network/serverConnection/handlers/inboundWorld.ts:227`) if finer control over prioritization is ever needed, but that's a secondary concern, not what these calls are trying to do. |
| `sendPositionalHint` (3), `sendEntityHint` (3), `sendEntityHintRemoval` (6), `sendMultiIcon` (1) | Hint-arrows pointing at a tile or entity | Searched xrsps's `messages.ts` and `network/encoding/` for any hint-arrow message type or encoder - none exists. Not a wiring gap, a feature xrsps's own protocol doesn't have at all. |
| `sendFriend` (4), `sendDeleteFriend` (2), `sendFriendStatus` (1), `sendAddIgnore` (3), `sendDeleteIgnore` (2) | Populating/updating the friends and ignore list UI (server → client direction) | Extends the already-documented friends/ignore-list gap: not only can the client not *send* add/remove friend (documented earlier), xrsps's `messages.ts` has no friend/ignore-related type in *either* direction - the server can't even push a friends-list snapshot to display. The feature doesn't exist in this protocol at all, not just the write path. |
| `sendPoisonType`, `sendEffectTimer`, `sendGraphic`, `sendGlobalGraphic` | Poison/freeze/venom status indicators, tile-anchored graphics | Already covered above under "Confirmed live-gameplay bugs" - poison/freeze/venom need the `colorOverride` subsystem (missing entirely), tile graphics need a new server→client message (no `GRAPHIC`-family opcode exists in the current 160-packet table at all, only per-actor `SPOT_ANIM`). |
| `sendChatOptions`, `sendShowClanChatOptions`, `sendInterfaceActions`, `clearInterfaceText`, `sendURL`, `sendSystemUpdate`, `sendEnableNoclip`, `sendExit`, `sendInterfaceComponentMoval`, `sendTab`, `sendTotalExp`, `sendExpDrop`, `sendCreationMenu`, `sendInterfaceItems` | Misc: clan chat member-list detail rendering, admin/debug tooling (noclip toggle, force-disconnect, scheduled-restart countdown, open a URL), sidebar tab highlight sync, exp-drop popups, the Fletching creation menu, and the duel offer/scoreboard item-list widget (`Duelling.ts`, 5 call sites) | Checked xrsps's `messages.ts` for each - no matching message type for any of them. `sendInterfaceItems` is the one partial exception: the underlying mechanism (`encodeWidgetSetItem`, already live) is right there and the calling convention for a multi-item container is already established elsewhere in this codebase (`Presets.plugin.js` loops `sendItemOnInterfaces(baseId + i, itemId, amount)` per slot rather than sending a batch) - but converting `Duelling.ts` to that pattern safely also requires clearing any slots beyond the new item count (the old opcode-53 packet was a full-replace snapshot; per-slot `encodeWidgetSetItem` calls are not), which needs the duel container's real max-slot count. Not guessed in this pass - flagged as the most tractable one to pick up next given the live building block already exists.

From the previous cleanup pass, already removed: the obsolete `PacketExecutor` adapter, the
command-packet shim, several dead `*PacketListener.ts` files, and the raw-container bank decoder in
`BankBooths.plugin.js` (bank actions moved to the live cache-native `Bank.handleWidgetAction` path).
