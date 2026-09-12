import { Player } from "../../../entity/impl/player/Player";
import { Item } from "../../Item";
import { ItemContainer } from "../ItemContainer";
import { PlayerStatus } from "../../PlayerStatus";
import { ItemDefinition } from "../../../definition/ItemDefinition";
import { StackType } from "../StackType";
import { Equipment } from "./Equipment";
import { GameConstants } from "../../../GameConstants";
import { WeaponInterfaceManager } from "../../../content/combat/WeaponInterfaceManager";
import { Inventory } from "./Inventory";
import { Flag } from "../../Flag";
import { BonusManager } from "../../equipment/BonusManager";
import { EnteredSyntaxAction } from "../../EnteredSyntaxAction";
import { Sound } from "../../../Sound";
import { Sounds } from "../../../Sounds";
const getPluginManager = () =>
    require("../../../../plugins/PluginManager").PluginManager as typeof import("../../../../plugins/PluginManager").PluginManager;

export class Bank extends ItemContainer {
    full(): ItemContainer;
    full(itemId: number): boolean;
    full(itemId?: unknown): boolean | ItemContainer {
        throw new Error("Method not implemented.");
    }
    public static readonly TOTAL_BANK_TABS = 11;
    public static readonly CONTAINER_START = 50300;
    public static readonly BANK_SEARCH_TAB_INDEX = Bank.TOTAL_BANK_TABS - 1;
    public static readonly INVENTORY_INTERFACE_ID = 5064;
    public static readonly MAIN_INTERFACE_ID = 12;
    public static readonly SIDE_INTERFACE_ID = 15;

    constructor(public player: Player) {
        super(player);
    }

    public static isOpen(player: Player): boolean {
        return player.getStatus() === PlayerStatus.BANKING &&
            player.getInterfaceId() === Bank.MAIN_INTERFACE_ID;
    }

    public static withdraw(player: Player, item: number, slot: number, amount: number, fromBankTab: number) {
        if (Bank.isOpen(player)) {

            // The item's real tab
            const itemTab = Bank.getTabForItem(player, item);

            // Check if we're withdrawing the item from the proper tab, but only if we
            // aren't bank searching.
            if (itemTab !== fromBankTab) {
                if (!player.isSearchingBank()) {
                    return;
                }
            }

            // Make sure we're only withdrawing what we have.
            let maxAmount = player.getBank(itemTab).getAmount(item);
            if (amount === -1 || amount > maxAmount) {
                amount = maxAmount;
            }

            if (player.isSearchingBank()) {
                if (!player.getBank(itemTab).contains(item) || !player.getBank(Bank.BANK_SEARCH_TAB_INDEX).contains(item)
                        || amount <= 0) {
                    return;
                }
                if (fromBankTab !== Bank.BANK_SEARCH_TAB_INDEX) {
                    return;
                }

                slot = player.getBank(itemTab).getSlotForItemId(item);

                player.getBank(itemTab).switchsItem(
                    player.getInventory(),
                    new Item(item, amount),
                    slot,
                    false,
                    false
                );

                if (slot === 0) {
                    Bank.reconfigureTabs(player);
                }

                player.getBank(Bank.BANK_SEARCH_TAB_INDEX).refreshItems();

            } else {

                // Withdrawing an item which belongs in another tab from the main tab.
                if (player.getCurrentBankTab() === 0 && fromBankTab !== 0) {
                    slot = player.getBank(itemTab).getSlotForItemId(item);
                }

                // Make sure the item is in the slot we've found.
                if (player.getBank(itemTab).getItems()[slot].getId() !== item) {
                    return;
                }

                // Delete placeholder.
                if (amount <= 0) {
                    player.getBank(itemTab).getItems()[slot].setId(-1);
                    player.getBank(player.getCurrentBankTab()).sortItems().refreshItems();
                    return;
                }

                // Perform the switch.
                player.getBank(itemTab).switchsItem(
                    player.getInventory(),
                    new Item(item, amount),
                    slot,
                    false,
                    false
                );

                // Update all tabs if we removed an item from the first item slot.
                if (slot === 0) {
                    Bank.reconfigureTabs(player);
                }

                // Refresh items in our current tab.
                player.getBank(player.getCurrentBankTab()).refreshItems();

            }

            Sounds.sendSound(player, Sound.PICK_UP_ITEM);

            // Refresh inventory.
            player.getInventory().refreshItems();
        }
    }

    public static deposits(player: Player, item: number, slot: number, amount: number) {
        this.deposit(player, item, slot, amount, false);
    }

    /**
     * Deposits an item to the bank.
     *
     * @param player
     * @param item
     * @param slot
     * @param amount
     */

    public static deposit(player: Player, item: number, slot: number, amount: number, ignore: boolean) {
        if (ignore || Bank.isOpen(player)) {
            const inventoryItem = player.getInventory().getItems()[slot];
            if (!inventoryItem || inventoryItem.getId() !== item) {
                return;
            }

            if (getPluginManager().emitCanBankItem(player, inventoryItem) === false) {
                return;
            }

            if (amount === -1 || amount > player.getInventory().getAmount(item)) {
                amount = player.getInventory().getAmount(item);
            }

            if (amount <= 0) {
                return;
            }

            const tab = Bank.getTabForItem(player, item);
            if (!player.isSearchingBank()) {
                player.setCurrentBankTab(tab);
            }

            player.getInventory().switchItem(player.getBank(tab), new Item(item, amount),false , slot, !player.isSearchingBank());
            if (player.isSearchingBank()) {
                player.getBank(this.BANK_SEARCH_TAB_INDEX).refreshItems();
            }

            Sounds.sendSound(player, Sound.DROP_ITEM);

            // Refresh inventory
            player.getInventory().refreshItems();
        }
    }

    public static search(player: Player, syntax: string) {
        if (Bank.isOpen(player)) {

            // Set search fields
            player.setSearchSyntax(syntax);
            player.setSearchingBank(true);

            // Clear search bank tab
            player.getBank(this.BANK_SEARCH_TAB_INDEX).resetItems();

            // Refill search bank tab
            for (let i = 0; i < this.TOTAL_BANK_TABS; i++) {
                if (i === this.BANK_SEARCH_TAB_INDEX) {
                    continue;
                }
                const b = player.getBank(i);
                if (b !== null) {
                    b.sortItems();
                    for (let item of b.getValidItems()) {
                        if (item.getAmount() > 0) {
                            this.addToBankSearch(player, item.clone(), false);
                        }
                    }
                }
            }

            player.setCurrentBankTab(0);

            // Open the search bank tab
            player.getBank(this.BANK_SEARCH_TAB_INDEX).open();
        }
    }

    public static exitSearch(player: Player, openBank: boolean) {
        if (Bank.isOpen(player)) {

            // Set search fields
            player.setSearchSyntax("");
            player.setSearchingBank(false);

            // Clear search bank tab
            player.getBank(this.BANK_SEARCH_TAB_INDEX).resetItems();

            // Open last tab we had
            if (player.getCurrentBankTab() === this.BANK_SEARCH_TAB_INDEX) {
                player.setCurrentBankTab(0);
            }

            if (openBank) {
                player.getBank(player.getCurrentBankTab()).open();
            }
        }
    }

    public static addToBankSearch(player: Player, item: Item, refresh: boolean) {

        if (player.getBank(this.BANK_SEARCH_TAB_INDEX).getFreeSlots() === 0) {
            return;
        }

        if (item.getDefinition().getName().toLowerCase().includes(player.getSearchSyntax())) {
            player.getBank(this.BANK_SEARCH_TAB_INDEX).add(item, refresh);
        }
    }

    public static resolveDisplaySlot(player: Player, clientSlot: number): { tab: number; slot: number; item: Item } | null {
        if (!Number.isInteger(clientSlot) || clientSlot < 0) return null;
        let current = 0;
        for (let tab = 0; tab < 10; tab++) {
            const bank = player.getBank(tab);
            for (const item of bank.getValidItems()) {
                if (current++ === clientSlot) {
                    return { tab, slot: bank.getSlotForItemId(item.getId()), item };
                }
            }
        }
        return null;
    }

    public static actionAmount(
        kind: "withdraw" | "deposit",
        button: number,
        option: string | undefined,
        available: number,
        custom = 0,
        defaultMode = 0,
    ): number {
        const total = Math.max(0, Math.trunc(available));
        const named = option?.trim().toLowerCase();
        if (named) {
            if (named.endsWith("-all-but-1")) return Math.max(0, total - 1);
            if (named.endsWith("-1")) return Math.min(total, 1);
            if (named.endsWith("-5")) return Math.min(total, 5);
            if (named.endsWith("-10")) return Math.min(total, 10);
            if (named.endsWith("-all")) return total;
            if (named.endsWith("-x")) return Math.min(total, custom);
        }

        const defaultAmounts = [1, 5, 10, custom, total];
        if (kind === "withdraw") {
            if (button === 1) return Math.min(total, defaultAmounts[defaultMode] ?? 1);
            return Math.max(0, Math.min(total, ({ 2: 1, 3: 5, 4: 10, 5: custom, 6: custom, 7: total, 8: total - 1 } as Record<number, number>)[button] ?? 0));
        }
        if (button === 2) return Math.min(total, defaultAmounts[defaultMode] ?? 1);
        return Math.min(total, ({ 1: 1, 3: 1, 4: 5, 5: 10, 6: custom, 7: custom, 8: total } as Record<number, number>)[button] ?? 0);
    }

    public static handleWidgetAction(player: Player, packet: {
        groupId: number;
        childId: number;
        buttonNum: number;
        option?: string;
        slot?: number;
        itemId?: number;
    }): boolean {
        if (!Bank.isOpen(player)) return false;

        if (packet.groupId === Bank.MAIN_INTERFACE_ID && packet.childId === 12 && packet.slot != null) {
            const entry = Bank.resolveDisplaySlot(player, packet.slot);
            if (!entry || (packet.itemId != null && packet.itemId !== entry.item.getId())) return true;
            const amount = Bank.actionAmount(
                "withdraw", packet.buttonNum, packet.option, entry.item.getAmount(),
                player.getBankCustomQuantity(), player.getBankQuantityMode(),
            );
            if (amount > 0) Bank.withdraw(player, entry.item.getId(), entry.slot, amount, entry.tab);
            return true;
        }

        if (packet.groupId === Bank.SIDE_INTERFACE_ID &&
            (packet.childId === 3 || packet.childId >= 0x8000) && packet.slot != null) {
            const item = player.getInventory().getItems()[packet.slot];
            if (!item || item.getId() < 0 || (packet.itemId != null && packet.itemId !== item.getId())) return true;
            const amount = Bank.actionAmount(
                "deposit", packet.buttonNum, packet.option, item.getAmount(),
                player.getBankCustomQuantity(), player.getBankQuantityMode(),
            );
            if (amount > 0) Bank.deposits(player, item.getId(), packet.slot, amount);
            return true;
        }

        if (packet.groupId !== Bank.MAIN_INTERFACE_ID) return false;
        const sender = player.getPacketSender();
        if (packet.childId === 2) sender.sendInterfaceRemoval();
        else if (packet.childId === 17) {
            player.setInsertMode(!player.insertModeReturn());
            sender.sendVarbit(3959, player.insertModeReturn() ? 1 : 0);
        } else if (packet.childId === 19) {
            player.setNoteWithdrawal(!player.withdrawAsNote());
            sender.sendVarbit(3958, player.withdrawAsNote() ? 1 : 0);
        } else if ([23, 25, 27, 29, 31].includes(packet.childId)) {
            player.setBankQuantityMode([23, 25, 27, 29, 31].indexOf(packet.childId));
            sender.sendVarbit(6590, player.getBankQuantityMode());
        } else if (packet.childId === 34) {
            player.setPlaceholders(!player.isPlaceholders());
            sender.sendVarbit(3755, player.isPlaceholders() ? 1 : 0);
        } else if (packet.childId === 41) Bank.depositItems(player, player.getInventory(), false);
        else if (packet.childId === 43) Bank.depositItems(player, player.getEquipment(), false);
        else return false;
        return true;
    }

    /**
     * Removes an item from the bank search tab
     *
     * @param player
     * @param item
     */
    public static removeFromBankSearch(player: Player, item: Item, refresh: boolean) {

        if (item.getDefinition().isNoted()) {
            item.setId(item.getDefinition().unNote());
        }

        player.getBank(this.BANK_SEARCH_TAB_INDEX).deleteBoolean(item, refresh);
    }

    /**
     * Moves an item from one slot to another using the insert method. It will shift
     * all other items to the right.
     *
     * @param player
     * @param fromSlot
     * @param toSlot
     */
    public static rearrange(player: Player, bank: Bank, fromSlot: number, toSlot: number) {
        if (player.insertModeReturn()) {

            let tempFrom = fromSlot;

            for (let tempTo = toSlot; tempFrom !== tempTo; ) {
                if (tempFrom > tempTo) {
                    bank.swap(tempFrom, tempFrom - 1);
                    tempFrom--;
                } else if (tempFrom < tempTo) {
                    bank.swap(tempFrom, tempFrom + 1);
                    tempFrom++;
                }
            }

        } else {
            bank.swap(fromSlot, toSlot);
        }

        if (player.getCurrentBankTab() === 0 && !player.isSearchingBank()) {
            player.getBank(0).refreshItems();
        } else {
            bank.refreshItems();
        }

        // Update all tabs if we moved an item from/to the first item slot
        if (fromSlot === 0 || toSlot === 0) {
            Bank.reconfigureTabs(player);
        }
    }

    public static handleButton(player: Player, button: number, action: number): boolean {
        if (player.getInterfaceId() == 32500) {
            // Handle bank settings
            switch (button) {
            case 32503:
                Sounds.sendSound(player, Sound.CONTAINER_CLOSE);
                player.getPacketSender().sendInterfaceRemoval();
                break;
            case 32512:
                player.getBank(player.getCurrentBankTab()).open();
                break;
            case 32513:
                player.setPlaceholders(!player.isPlaceholders());
                player.getPacketSender().sendConfig(118, player.isPlaceholders() ? 1 : 0);
                player.getPacketSender().sendMessage(
                        "Placeholders are now " + (player.isPlaceholders() ? "enabled" : "disabled") + ".");
                break;
            }
            return true;
        } else if (Bank.isOpen(player)) {
            if (player.getStatus() == PlayerStatus.BANKING) {
                let tab_select_start = 50070;
                for (let bankId = 0; bankId < this.TOTAL_BANK_TABS; bankId++) {
                    if (button == tab_select_start + (bankId * 4)) {

                        const searching = player.isSearchingBank();
                        if (searching) {
                            this.exitSearch(player, false);
                        }

                        // First, check if empty
                        let empty = bankId > 0 ? Bank.isEmpty(player.getBank(bankId)) : false;

                        if (action === 1) {
                            // Collapse tab!!!
                            if (bankId === 0) {
                                return true;
                            }
                            if (empty) {
                                return true;
                            }
                            let items: Item[] = player.getBank(bankId).getValidItems();
                            if (player.getBank(0).getFreeSlots() < items.length) {
                                player.getPacketSender().sendMessage("You don't have enough free slots in your Main tab to do that.");
                                return true;
                            }
                            let noteWithdrawal: boolean = player.withdrawAsNote();
                            player.setNoteWithdrawal(false);
                            for (let item of items) {
                                player.getBank(bankId).switchsItem(player.getInventory(), item.clone(), player.getBank(bankId).getSlotForItemId(item.getId()), false, false);
                            }
                            player.setNoteWithdrawal(noteWithdrawal);
                            this.reconfigureTabs(player);
                            player.getBank(player.getCurrentBankTab()).refreshItems();
                        } else {
                            if (!empty || bankId === 0) {
                                player.setCurrentBankTab(bankId);
                                player.getBank(bankId).open();
                            } else {
                                player.getPacketSender().sendMessage("To create a new tab, simply drag an item here.");
                                if (searching) {
                                    player.getBank(player.getCurrentBankTab()).open();
                                }
                            }
                        }
                        return true;
                    }
                }

                switch (button) {
                    case 50013:
                        // Show menu
                        player.getPacketSender().sendInterfaceRemoval();
                        player.getPacketSender().sendInterface(32500);
                        break;
                    case 5386:
                        player.setNoteWithdrawal(true);
                        break;
                    case 5387:
                        player.setNoteWithdrawal(false);
                        break;
                    case 8130:
                        player.setInsertMode(false);
                        break;
                    case 8131:
                        player.setInsertMode(true);
                        break;
                    case 50004:
                        this.depositItems(player, player.getInventory(), false);
                        break;
                    case 50007:
                        this.depositItems(player, player.getEquipment(), false);
                        break;
                    case 5384:
                    case 50001:
                        Sounds.sendSound(player, Sound.CONTAINER_CLOSE);
                        player.getPacketSender().sendInterfaceRemoval();
                        break;
                    case 50010:
                        if (player.isSearchingBank()) {
                            this.exitSearch(player, true);
                            return true;
                        }
                        player.setEnteredSyntaxAction(new bankEntered((input) => {Bank.search(player, input)}));
                        player.getPacketSender().sendEnterInputPrompt("What do you wish to search for?");
                        break;
                }
            }
            return true;
        }
        return false;
    }
    public static depositItems(player: Player, from: ItemContainer, ignoreReqs: boolean) {
        if (!ignoreReqs) {
            if (!Bank.isOpen(player)) {
                return;
            }
        }
        let movedAny = false;
        for (let item of from.getValidItems()) {
            if (getPluginManager().emitCanBankItem(player, item) === false) {
                continue;
            }
            from.switchItems(player.getBank(Bank.getTabForItem(player, item.getId())), item.clone(),false, false);
            movedAny = true;
        }
        from.refreshItems();
        if (player.isSearchingBank()) {
            player.getBank(this.BANK_SEARCH_TAB_INDEX).refreshItems();
        } else {
            player.getBank(player.getCurrentBankTab()).refreshItems();
        }
        if (movedAny) {
            Sounds.sendSound(player, from instanceof Equipment ? Sound.EQUIPMENT_OFF : Sound.DROP_ITEM);
        }
        if (from instanceof Equipment) {
            WeaponInterfaceManager.assign(player);
            BonusManager.update(player);
            player.getUpdateFlag().flag(Flag.APPEARANCE);
        }
    }

    /**
     * Is a bank empty?
     *
     * @param bank
     * @return
     */
    public static isEmpty(bank: Bank): boolean {
        return bank.sortItems().getValidItems().length <= 0;
    }

    /**
     * Reconfigures our bank tabs
     *
     * @param player
     */
    public static reconfigureTabs(player: Player): boolean {
        let updateRequired = false;
        for (let k = 1; k < this.BANK_SEARCH_TAB_INDEX - 1; k++) {
            if (this.isEmpty(player.getBank(k)) || updateRequired) {
                player.setBank(k, player.getBank(k + 1));
                player.setBank(k + 1, new Bank(player));
                updateRequired = true;
            }
        }

        // Check if we're in a tab that's empty
        // If so, open the next non-empty tab
        let total_tabs = this.getTabCount(player);
        if (!player.isSearchingBank()) {
            if (player.getCurrentBankTab() > total_tabs) {
                player.setCurrentBankTab(total_tabs);
                player.getBank(total_tabs).open();
                return true;
            }
        }
        return false;
    }

    public static getTabCount(player: Player): number {
        let tabs = 0;
        for (let i = 1; i < this.TOTAL_BANK_TABS; i++) {
            if (i === this.BANK_SEARCH_TAB_INDEX) {
                continue;
            }
            if (!this.isEmpty(player.getBank(i))) {
                tabs++;
            } else
                break;
        }
        return tabs;
    }

    /**
     * Gets the specific tab in which an item is.
     *
     * @param player
     * @param itemID
     * @return
     */
    public static getTabForItem(player: Player, itemID: number): number {
        if (ItemDefinition.forId(itemID).isNoted()) {
            itemID = ItemDefinition.forId(itemID).unNote();
        }
        for (let k = 0; k < this.TOTAL_BANK_TABS; k++) {
            if (k === this.BANK_SEARCH_TAB_INDEX) {
                continue;
            }
            if (player.getBank(k).contains(itemID)) {
                return k;
            }
        }

        // Find empty bank slot
        if (player.getBank(player.getCurrentBankTab()).getFreeSlots() > 0) {
            return player.getCurrentBankTab();
        }
        for (let k = 0; k < this.TOTAL_BANK_TABS; k++) {
            if (k === this.BANK_SEARCH_TAB_INDEX) {
                continue;
            }
            if (player.getBank(k).getFreeSlots() > 0) {
                return k;
            }
        }
        return 0;
    }

    public static contains(player: Player, item: Item): boolean {
        let tab = this.getTabForItem(player, item.getId());
        return player.getBank(tab).getAmount(item.getId()) >= item.getAmount();
    }

    public capacity(): number {
        return 352;
    }

    public stackType(): StackType {
        return StackType.STACKS;
    }

    public open(): Bank {
        const pluginCanBank = getPluginManager().emitCanBank(this.getPlayer());
        if (pluginCanBank === false) {
            return this;
        }
        const opening = !Bank.isOpen(this.getPlayer());

        // Update player status
        this.getPlayer().setStatus(PlayerStatus.BANKING);
        this.getPlayer().setEnteredSyntaxAction(null);

        this.sortItems();

        const player = this.getPlayer();
        const sender = player.getPacketSender();
        const varps = {
            548: 1,
            4611: Math.max(0, 1410 - this.capacity()),
        };
        const varbits: Record<number, number> = {
            3755: player.isPlaceholders() ? 1 : 0,
            3958: player.withdrawAsNote() ? 1 : 0,
            3959: player.insertModeReturn() ? 1 : 0,
            3960: player.getBankCustomQuantity(),
            4150: player.getCurrentBankTab(),
            4170: 0,
            5450: 1,
            6590: player.getBankQuantityMode(),
        };
        for (let tab = 1; tab <= 9; tab++) {
            varbits[4170 + tab] = player.getBank(tab).getValidItems().length;
        }
        player.setInterfaceId(Bank.MAIN_INTERFACE_ID);
        sender.sendInterfaceScript(917, [-1, -2])
            .sendSubInterface((161 << 16) | 16, Bank.MAIN_INTERFACE_ID, 0, { varps, varbits })
            .sendSubInterface((161 << 16) | 74, Bank.SIDE_INTERFACE_ID, 3, { varps, varbits })
            .sendInterfaceFlagsRange((Bank.MAIN_INTERFACE_ID << 16) | 12, 0, 1409, 3409919)
            .sendInterfaceFlagsRange((Bank.SIDE_INTERFACE_ID << 16) | 3, 0, 27, 3278846)
            .sendVarbit(12393, 1)
            .sendString(`Bank of ${GameConstants.NAME}`, (Bank.MAIN_INTERFACE_ID << 16) | 3);
        this.refreshItems();
        if (opening) Sounds.sendSound(this.getPlayer(), Sound.CONTAINER_OPEN);

        return this;
    }

    public refreshItems(): Bank {
        // Reconfigure bank tabs.
        if (Bank.reconfigureTabs(this.getPlayer())) {
            return this;
        }

        const sender = this.getPlayer().getPacketSender();
        sender.sendVarbit(4150, this.getPlayer().getCurrentBankTab());
        for (let tab = 1; tab <= 9; tab++) {
            sender.sendVarbit(4170 + tab, this.getPlayer().getBank(tab).getValidItems().length);
        }
        sender.sendBankSnapshot().sendItemContainer(this.getPlayer().getInventory(), Bank.INVENTORY_INTERFACE_ID);

        return this;
    }

    public fulls(): ItemContainer | boolean {
        this.getPlayer().getPacketSender().sendMessage("Not enough space in bank.");
        return this;
    }


    public switchsItem(to: ItemContainer, item: Item, slot: number, sort: boolean, refresh: boolean): Bank {
    // Make sure we're actually banking!
    if (!Bank.isOpen(this.getPlayer())) {
    return this;
    }
        // Make sure we have the item!
        if (this.getItems()[slot].getId() != item.getId() || !this.contains(item.getId())) {
            return this;
        }

        const noteId = item.getDefinition().getNoteId();
        const noteDefinition = noteId >= 0 ? ItemDefinition.forId(noteId) : null;
        const canWithdrawAsNote = noteDefinition?.isNoted() === true &&
            noteDefinition.getName().toLowerCase() === item.getDefinition().getName().toLowerCase();

        // Make sure we have enough space in the other container
        if (to.getFreeSlots() <= 0 && (!(to.contains(item.getId()) && item.getDefinition().isStackable()))
                && !(this.getPlayer().withdrawAsNote() && canWithdrawAsNote && to.contains(noteId))) {
            to.full();
            return this;
        }

        // If bank > inventory and item.amount > inventory.freeslots,
        // change the item amount to the free slots we have in inventory.
        if (item.getAmount() > to.getFreeSlots() && !item.getDefinition().isStackable()) {
            if (to instanceof Inventory) {
                if (this.getPlayer().withdrawAsNote()) {
                    if (!canWithdrawAsNote)
                        item.setAmount(to.getFreeSlots());
                } else
                    item.setAmount(to.getFreeSlots());
            }
        }

        // Make sure we aren't taking more than we have.
        if (item.getAmount() > this.getAmount(item.getId())) {
            item.setAmount(this.getAmount(item.getId()));
        }

        if (to instanceof Inventory) {
            const withdrawAsNote = this.getPlayer().withdrawAsNote() && canWithdrawAsNote;
            const checkId = withdrawAsNote ? noteId : item.getId();
            if (to.getAmount(checkId) + item.getAmount() > Number.MAX_SAFE_INTEGER
                    || to.getAmount(checkId) + item.getAmount() <= 0) {
                item.setAmount(Number.MAX_SAFE_INTEGER - (to.getAmount(item.getId())));
                if (item.getAmount() <= 0) {
                    this.getPlayer().getPacketSender()
                    .sendMessage("You cannot withdraw that entire amount into your inventory.");
                        return this;
                }
            }
        }

        // Make sure the item is still valid
        if (item.getAmount() <= 0) {
            return this;
        }

        this.deleteItemContainer(item, slot, refresh, to);


        // Check if we can actually withdraw the item as a note.
        if (this.getPlayer().withdrawAsNote()) {
            if (canWithdrawAsNote)
                item.setId(noteId);
            else
                this.getPlayer().getPacketSender().sendMessage("This item cannot be withdrawn as a note.");
        }

        // Add the item to the other container
        to.add(item, refresh);

        // Sort this container
        if (sort && this.getAmount(item.getId()) <= 0)
            this.sortItems();

        // Refresh containers
        if (refresh) {
            this.refreshItems();
            to.refreshItems();
        }

        if (this.getPlayer().isSearchingBank()) {
            Bank.removeFromBankSearch(this.getPlayer(), item.clone(), true);
        }

        return this;
    }

}

class bankEntered implements EnteredSyntaxAction{
    constructor(private readonly execFunc: Function){}

    execute(syntax: string): void {
        this.execFunc();
    }

}
