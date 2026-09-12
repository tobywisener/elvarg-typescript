import { Misc } from "./Misc";
import * as fs from "fs";
import * as path from "path";

export class PlayerPunishment {
    private static readonly BAN_DIRECTORY = "./data/saves/";
    private static readonly MUTE_DIRECTORY = "./data/saves/";

    public static IPSBanned: string[] = [];
    public static IPSMuted: string[] = [];
    public static AccountsBanned: string[] = [];
    public static AccountsMuted: string[] = [];

    public static init() {
        // Ensure directories exist.
        fs.mkdirSync(path.dirname(PlayerPunishment.BAN_DIRECTORY + "placeholder"), { recursive: true });
        fs.mkdirSync(path.dirname(PlayerPunishment.MUTE_DIRECTORY + "placeholder"), { recursive: true });

        // In case we're reloading bans, reset lists first.
        PlayerPunishment.IPSBanned = [];
        PlayerPunishment.IPSMuted = [];
        PlayerPunishment.AccountsBanned = [];
        PlayerPunishment.AccountsMuted = [];

        PlayerPunishment.initializeList(PlayerPunishment.BAN_DIRECTORY, "IPBans", PlayerPunishment.IPSBanned);
        PlayerPunishment.initializeList(PlayerPunishment.BAN_DIRECTORY, "Bans", PlayerPunishment.AccountsBanned);
        PlayerPunishment.initializeList(PlayerPunishment.MUTE_DIRECTORY, "IPMutes", PlayerPunishment.IPSMuted);
        PlayerPunishment.initializeList(PlayerPunishment.MUTE_DIRECTORY, "Mutes", PlayerPunishment.AccountsMuted);
    }

    public static initializeList(directory: string, file: string, list: string[]) {
        try {
            const fullPath = `${directory}${file}.txt`;
            if (!fs.existsSync(fullPath)) {
                return;
            }
            const data = fs.readFileSync(fullPath, 'utf8');
            list.push(...data.split('\n'));
        } catch (e) {
            console.error(e);
        }
    }

    public static addBannedIP(IP: string) {
        if (!this.IPSBanned.includes(IP)) {
            this.addToFile(`${this.BAN_DIRECTORY}IPBans.txt`, IP);
        }
        this.IPSBanned.push(IP);
    }
    public static addMutedIP(IP: string) {
        if (!this.IPSMuted.includes(IP)) {
            this.addToFile(`${this.MUTE_DIRECTORY}IPMutes.txt`, IP);
        }
        this.IPSMuted.push(IP);
    }

    public static ban(p: string) {
        p = Misc.formatPlayerName(p.toLowerCase());
        if (!this.AccountsBanned.includes(p)) {
            this.addToFile(`${this.BAN_DIRECTORY}Bans.txt`, p);
        }
        this.AccountsBanned.push(p);
    }

    public static mute(p: string) {
        p = Misc.formatPlayerName(p.toLowerCase());
        if (!this.AccountsMuted.includes(p)) {
            this.addToFile(`${this.MUTE_DIRECTORY}Mutes.txt`, p);
        }
        this.AccountsMuted.push(p);
    }

    public static banned(player: string): boolean {
        player = Misc.formatPlayerName(player.toLowerCase());
        return this.AccountsBanned.includes(player);
    }

    /** Returns whether the player is banned after the change. */
    public static toggleBan(player: string): boolean {
        if (this.banned(player)) {
            this.unban(player);
            return false;
        }
        this.ban(player);
        return true;
    }

    public static muted(player: string): boolean {
        player = Misc.formatPlayerName(player.toLowerCase());
        return this.AccountsMuted.includes(player);
    }

    /** Returns whether the player is muted after the change. */
    public static toggleMute(player: string): boolean {
        if (this.muted(player)) {
            this.unmute(player);
            return false;
        }
        this.mute(player);
        return true;
    }

    public static IPBanned(IP: string): boolean {
        return IP.trim().length > 0 && this.IPSBanned.includes(IP);
    }

    public static IPMuted(IP: string): boolean {
        return IP.trim().length > 0 && this.IPSMuted.includes(IP);
    }

    public static unban(player: string) {
        player = Misc.formatPlayerName(player.toLowerCase());
        this.deleteFromFile(`${this.BAN_DIRECTORY}Bans.txt`, player);
        this.AccountsBanned = this.AccountsBanned.filter(p => p !== player);
    }

    public static unmute(player: string) {
        player = Misc.formatPlayerName(player.toLowerCase());
        this.deleteFromFile(`${this.MUTE_DIRECTORY}Mutes.txt`, player);
        this.AccountsMuted = this.AccountsMuted.filter(p => p !== player);
    }

    public static reloadIPBans() {
        this.IPSBanned = [];
        this.initializeList(this.BAN_DIRECTORY, "IPBans", this.IPSBanned);
    }

    public static reloadIPMutes() {
        this.IPSMuted = [];
        this.initializeList(this.MUTE_DIRECTORY, "IPMutes", this.IPSMuted);
    }

    public static deleteFromFile(file: string, player: string) {
        try {
            let data = fs.readFileSync(file, 'utf8');
            data = data.split('\n').filter(p => p !== player).join('\n');
            fs.writeFileSync(file, data);
        } catch (e) {
            console.error(e);
        }
    }

    public static addToFile(file: string, player: string) {
        try {
            fs.appendFileSync(file, player + '\n');
        } catch (e) {
            console.error(e);
        }
    }
}
