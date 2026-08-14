import fs from "fs";

import { CacheInfo } from "../../rs/cache/CacheInfo";
import { CacheSystem } from "../../rs/cache/CacheSystem";
import { detectCacheType } from "../../rs/cache/CacheType";
import { ConfigType } from "../../rs/cache/ConfigType";
import { IndexType } from "../../rs/cache/IndexType";
import { getCacheLoaderFactory } from "../../rs/cache/loader/CacheLoaderFactory";
import { ObjTypeLoader } from "../../rs/config/objtype/ObjTypeLoader";
import { EquipmentSlot, deriveEquipSlotFromParams } from "../../rs/config/player/Equipment";
import { ArchiveStructTypeLoader } from "../../rs/config/structtype/StructTypeLoader";
import { ByteBuffer } from "../../rs/io/ByteBuffer";
import { loadCache, loadCacheInfos, loadCacheList } from "./load-util";

type ExportedItem = Record<string, any>;

// Minimal opcode skipper mirroring ObjType.decodeOpcode to safely scan for opcode 3 (examine/desc)
function skipObjOpcode(buf: ByteBuffer, opcode: number, cacheInfo: CacheInfo) {
    // local helper for model ids
    const readModelId = () => {
        const isLarge = cacheInfo.game === "runescape" && cacheInfo.revision >= 670;
        return isLarge ? buf.readBigSmart() : buf.readUnsignedShort();
    };
    switch (opcode) {
        case 1:
            readModelId();
            return;
        case 2: {
            // name
            const endVal = detectCacheType(cacheInfo) !== "dat2" ? 0x0a : 0x00;
            while (buf.getByte(buf.offset) !== endVal) buf.readUnsignedByte();
            buf.readByte();
            return;
        }
        case 3: {
            // handled by caller
            return;
        }
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
            buf.readUnsignedShort();
            return;
        case 9: {
            const endVal = detectCacheType(cacheInfo) !== "dat2" ? 0x0a : 0x00;
            while (buf.getByte(buf.offset) !== endVal) buf.readUnsignedByte();
            buf.readByte();
            return;
        }
        case 10:
            buf.readUnsignedShort();
            return;
        case 11:
            // stackability ALWAYS flag
            return;
        case 12:
            buf.readInt();
            return;
        case 13:
        case 14:
            buf.readUnsignedByte();
            return;
        case 16:
            // members flag
            return;
        case 23:
            readModelId();
            if (cacheInfo.revision < 503) buf.readUnsignedByte();
            return;
        case 24:
            readModelId();
            return;
        case 25:
            readModelId();
            if (cacheInfo.revision < 503) buf.readUnsignedByte();
            return;
        case 26:
            readModelId();
            return;
        case 27:
            buf.readUnsignedByte();
            return;
        default:
            break;
    }
    if (opcode >= 30 && opcode < 35) {
        const endVal = detectCacheType(cacheInfo) !== "dat2" ? 0x0a : 0x00;
        while (buf.getByte(buf.offset) !== endVal) buf.readUnsignedByte();
        buf.readByte();
        return;
    }
    if (opcode >= 35 && opcode < 40) {
        const endVal = detectCacheType(cacheInfo) !== "dat2" ? 0x0a : 0x00;
        while (buf.getByte(buf.offset) !== endVal) buf.readUnsignedByte();
        buf.readByte();
        return;
    }
    switch (opcode) {
        case 40: {
            const c = buf.readUnsignedByte();
            for (let i = 0; i < c; i++) {
                buf.readUnsignedShort();
                buf.readUnsignedShort();
            }
            return;
        }
        case 41: {
            const c = buf.readUnsignedByte();
            for (let i = 0; i < c; i++) {
                buf.readUnsignedShort();
                buf.readUnsignedShort();
            }
            return;
        }
        case 42:
            buf.readByte();
            return;
        case 44:
        case 45:
            buf.readUnsignedShort();
            return;
        case 65:
            return; // tradable flag
        case 75:
            buf.readShort();
            return;
        case 78:
        case 79:
            readModelId();
            return;
        case 90:
        case 91:
        case 92:
        case 93:
            readModelId();
            return;
        case 94:
            buf.readUnsignedShort();
            return;
        case 95:
            buf.readUnsignedShort();
            return;
        case 96:
            buf.readUnsignedByte();
            return;
        case 97:
        case 98:
            buf.readUnsignedShort();
            return;
        default:
            break;
    }
    if (opcode >= 100 && opcode < 110) {
        buf.readUnsignedShort();
        buf.readUnsignedShort();
        return;
    }
    switch (opcode) {
        case 110:
        case 111:
        case 112:
            buf.readUnsignedShort();
            return;
        case 113:
            buf.readByte();
            return;
        case 114:
            buf.readByte();
            return;
        case 115:
            buf.readUnsignedByte();
            return;
        case 121:
        case 122:
            buf.readUnsignedShort();
            return;
        case 125:
        case 126:
            buf.readByte();
            buf.readByte();
            buf.readByte();
            return;
        case 127:
        case 128:
        case 129:
        case 130:
            buf.readUnsignedByte();
            buf.readUnsignedShort();
            return;
        case 132: {
            const c = buf.readUnsignedByte();
            for (let i = 0; i < c; i++) buf.readUnsignedShort();
            return;
        }
        case 139:
        case 140:
            buf.readUnsignedShort();
            return;
        case 148:
        case 149:
            buf.readUnsignedShort();
            return;
        default:
            break;
    }
    if (opcode >= 142 && opcode < 147) {
        buf.readUnsignedShort();
        return;
    }
    if (opcode >= 150 && opcode < 155) {
        buf.readUnsignedShort();
        return;
    }
    if (opcode === 249) {
        // read params map
        const count = buf.readUnsignedByte();
        for (let i = 0; i < count; i++) {
            const isStringValue = buf.readUnsignedByte() === 1;
            buf.readMedium(); // key
            if (isStringValue) {
                // string value
                const endVal = detectCacheType(cacheInfo) !== "dat2" ? 0x0a : 0x00;
                while (buf.getByte(buf.offset) !== endVal) buf.readUnsignedByte();
                buf.readByte();
            } else {
                buf.readInt();
            }
        }
        return;
    }
    // Unknown opcode (should not happen for supported revisions)
    throw new Error("ObjType: Opcode " + opcode + " not implemented in scanner.");
}

function readString(buf: ByteBuffer, cacheInfo: CacheInfo): string {
    const endVal = detectCacheType(cacheInfo) !== "dat2" ? 0x0a : 0x00;
    let str = "";
    while (buf.getByte(buf.offset) !== endVal) str += String.fromCharCode(buf.readUnsignedByte());
    buf.readByte();
    return str;
}

function readExamine(loader: ObjTypeLoader, id: number, cacheInfo: CacheInfo): string | undefined {
    const anyLoader = loader as any;
    const buf: ByteBuffer | undefined = anyLoader.getDataBuffer
        ? anyLoader.getDataBuffer(id)
        : undefined;
    if (!buf) return undefined;
    const start = buf.offset;
    try {
        while (true) {
            if (buf.offset > buf.length - 1) break;
            const opcode = buf.readUnsignedByte();
            if (opcode === 0) break;
            if (opcode === 3) {
                // description/examine
                return readString(buf, cacheInfo);
            }
            skipObjOpcode(buf, opcode, cacheInfo);
        }
    } catch {
        // ignore, just return undefined
    } finally {
        // reset in case the loader reuses buffers
        buf.offset = start;
    }
    return undefined;
}

function slotName(slot: EquipmentSlot | undefined): string {
    switch (slot) {
        case EquipmentSlot.HEAD:
            return "HEAD";
        case EquipmentSlot.CAPE:
            return "CAPE";
        case EquipmentSlot.AMULET:
            return "AMULET";
        case EquipmentSlot.WEAPON:
            return "WEAPON";
        case EquipmentSlot.BODY:
            return "BODY";
        case EquipmentSlot.SHIELD:
            return "SHIELD";
        case EquipmentSlot.LEGS:
            return "LEGS";
        case EquipmentSlot.GLOVES:
            return "GLOVES";
        case EquipmentSlot.BOOTS:
            return "BOOTS";
        case EquipmentSlot.RING:
            return "RING";
        case EquipmentSlot.AMMO:
            return "AMMO";
        case EquipmentSlot.HEAD2:
            return "HEAD2";
        default:
            return "NONE";
    }
}

function resolveWeaponSeqsStrict(
    loaderFactory: ReturnType<typeof getCacheLoaderFactory>,
    cacheInfo: CacheInfo,
    obj: any,
): { idle?: number; walk?: number; run?: number } | undefined {
    try {
        if (!obj || !obj.params) return undefined;
        const cacheSystem = (loaderFactory as any).cacheSystem || undefined;
        if (!cacheSystem) return undefined;
        const configIndex = cacheSystem.getIndex(IndexType.DAT2.configs);
        const structArchive = configIndex.getArchive(ConfigType.OSRS.struct);
        const structLoader = new ArchiveStructTypeLoader(cacheInfo, structArchive);
        let idle: number | undefined;
        let walk: number | undefined;
        let run: number | undefined;
        for (const [, val] of (obj.params as Map<number, any>).entries()) {
            if (typeof val !== "number") continue;
            const structId = val | 0;
            if (structId < 0 || structId >= structLoader.getCount()) continue;
            try {
                const st = structLoader.load(structId);
                const params = st.params;
                if (!params) continue;
                if (idle === undefined) {
                    const v = params.get(569);
                    if (typeof v === "number" && v >= 0) idle = v | 0;
                }
                if (walk === undefined) {
                    const v = params.get(570);
                    if (typeof v === "number" && v >= 0) walk = v | 0;
                }
                if (run === undefined) {
                    const v = params.get(571);
                    if (typeof v === "number" && v >= 0) run = v | 0;
                }
            } catch {}
        }
        if (idle !== undefined || walk !== undefined || run !== undefined)
            return { idle, walk, run };
    } catch {}
    return undefined;
}

function parseObjType(
    loader: ObjTypeLoader,
    id: number,
    cacheInfo: CacheInfo,
): ExportedItem | undefined {
    const anyLoader = loader as any;
    const buf: ByteBuffer | undefined = anyLoader.getDataBuffer
        ? anyLoader.getDataBuffer(id)
        : undefined;
    if (!buf) return undefined;

    const def: ExportedItem = { id };

    const readModelId = () => {
        const isLarge = cacheInfo.game === "runescape" && cacheInfo.revision >= 670;
        return isLarge ? buf.readBigSmart() : buf.readUnsignedShort();
    };

    const groundActions: Record<string, string | null> = {};
    const inventoryActions: Record<string, string | null> = {};
    const countObj: Record<string, number> = {};
    const countCo: Record<string, number> = {};
    let haveCount = false;
    let haveRecolor = false;
    let haveRetexture = false;
    let recolorFrom: number[] = [];
    let recolorTo: number[] = [];
    let retextureFrom: number[] = [];
    let retextureTo: number[] = [];

    try {
        while (true) {
            if (buf.offset > buf.length - 1) break;
            const opcode = buf.readUnsignedByte();
            if (opcode === 0) break;
            switch (opcode) {
                case 1:
                    def.model = readModelId();
                    break;
                case 2:
                    def.name = readString(buf, cacheInfo);
                    break;
                case 3:
                    def.examine = readString(buf, cacheInfo);
                    break;
                case 4:
                    def.zoom2d = buf.readUnsignedShort();
                    break;
                case 5:
                    def.xan2d = buf.readUnsignedShort();
                    break;
                case 6:
                    def.yan2d = buf.readUnsignedShort();
                    break;
                case 7: {
                    let v = buf.readUnsignedShort();
                    if (v > 32767) v -= 65536;
                    def.offsetX2d = v;
                    break;
                }
                case 8: {
                    let v = buf.readUnsignedShort();
                    if (v > 32767) v -= 65536;
                    def.offsetY2d = v;
                    break;
                }
                case 9:
                    def.op9 = readString(buf, cacheInfo);
                    break;
                case 10:
                    def.opcode10 = buf.readUnsignedShort();
                    break;
                case 11:
                    def.stackability = "ALWAYS";
                    break;
                case 12:
                    def.price = buf.readInt();
                    break;
                case 13:
                    def.op13 = buf.readUnsignedByte();
                    break;
                case 14:
                    def.op14 = buf.readUnsignedByte();
                    break;
                case 16:
                    def.isMembers = true;
                    break;
                case 23:
                    def.maleModel = readModelId();
                    if (cacheInfo.revision < 503) def.maleOffset = buf.readUnsignedByte();
                    break;
                case 24:
                    def.maleModel1 = readModelId();
                    break;
                case 25:
                    def.femaleModel = readModelId();
                    if (cacheInfo.revision < 503) def.femaleOffset = buf.readUnsignedByte();
                    break;
                case 26:
                    def.femaleModel1 = readModelId();
                    break;
                case 27:
                    def.op27 = buf.readUnsignedByte();
                    break;
                default:
                    if (opcode >= 30 && opcode < 35) {
                        const idx = opcode - 30;
                        const s = readString(buf, cacheInfo);
                        groundActions[String(idx)] = s?.toLowerCase() === "hidden" ? null : s;
                        continue;
                    }
                    if (opcode >= 35 && opcode < 40) {
                        const idx = opcode - 35;
                        inventoryActions[String(idx)] = readString(buf, cacheInfo);
                        continue;
                    }
                    switch (opcode) {
                        case 40: {
                            const c = buf.readUnsignedByte();
                            for (let i = 0; i < c; i++) {
                                recolorFrom.push(buf.readUnsignedShort());
                                recolorTo.push(buf.readUnsignedShort());
                            }
                            haveRecolor = haveRecolor || c > 0;
                            break;
                        }
                        case 41: {
                            const c = buf.readUnsignedByte();
                            for (let i = 0; i < c; i++) {
                                retextureFrom.push(buf.readUnsignedShort());
                                retextureTo.push(buf.readUnsignedShort());
                            }
                            haveRetexture = haveRetexture || c > 0;
                            break;
                        }
                        case 42:
                            def.shiftClickIndex = buf.readByte();
                            break;
                        case 44:
                            def.opcode44 = buf.readUnsignedShort();
                            break;
                        case 45:
                            def.opcode45 = buf.readUnsignedShort();
                            break;
                        case 65:
                            def.isTradable = true;
                            break;
                        case 75:
                            def.op75 = buf.readShort();
                            break;
                        case 78:
                            def.maleModel2 = readModelId();
                            break;
                        case 79:
                            def.femaleModel2 = readModelId();
                            break;
                        case 90:
                            def.maleHeadModel = readModelId();
                            break;
                        case 91:
                            def.femaleHeadModel = readModelId();
                            break;
                        case 92:
                            def.maleHeadModel2 = readModelId();
                            break;
                        case 93:
                            def.femaleHeadModel2 = readModelId();
                            break;
                        case 94:
                            def.opcode94 = buf.readUnsignedShort();
                            break;
                        case 95:
                            def.zan2d = buf.readUnsignedShort();
                            break;
                        case 96:
                            def.opcode96 = buf.readUnsignedByte();
                            break;
                        case 97:
                            def.note = buf.readUnsignedShort();
                            break;
                        case 98:
                            def.noteTemplate = buf.readUnsignedShort();
                            break;
                        default:
                            if (opcode >= 100 && opcode < 110) {
                                const idx = opcode - 100;
                                countObj[String(idx)] = buf.readUnsignedShort();
                                countCo[String(idx)] = buf.readUnsignedShort();
                                haveCount = true;
                                continue;
                            }
                            switch (opcode) {
                                case 110:
                                    def.resizeX = buf.readUnsignedShort();
                                    break;
                                case 111:
                                    def.resizeY = buf.readUnsignedShort();
                                    break;
                                case 112:
                                    def.resizeZ = buf.readUnsignedShort();
                                    break;
                                case 113:
                                    def.ambient = buf.readByte();
                                    break;
                                case 114:
                                    def.contrast = buf.readByte() * 5;
                                    break;
                                case 115:
                                    def.team = buf.readUnsignedByte();
                                    break;
                                case 121:
                                    def.lentId = buf.readUnsignedShort();
                                    break;
                                case 122:
                                    def.lentTemplate = buf.readUnsignedShort();
                                    break;
                                case 125:
                                    def.manwearXOff = buf.readByte();
                                    def.manwearYOff = buf.readByte();
                                    def.manwearZOff = buf.readByte();
                                    break;
                                case 126:
                                    def.womanwearXOff = buf.readByte();
                                    def.womanwearYOff = buf.readByte();
                                    def.womanwearZOff = buf.readByte();
                                    break;
                                case 127: {
                                    def.cursor1op = buf.readUnsignedByte();
                                    def.cursor1 = buf.readUnsignedShort();
                                    break;
                                }
                                case 128: {
                                    def.cursor2op = buf.readUnsignedByte();
                                    def.cursor2 = buf.readUnsignedShort();
                                    break;
                                }
                                case 129: {
                                    def.cursor1iop = buf.readUnsignedByte();
                                    def.icursor1 = buf.readUnsignedShort();
                                    break;
                                }
                                case 130: {
                                    def.cursor2iop = buf.readUnsignedByte();
                                    def.icursor2 = buf.readUnsignedShort();
                                    break;
                                }
                                case 132: {
                                    const c = buf.readUnsignedByte();
                                    const arr: number[] = [];
                                    for (let i = 0; i < c; i++) arr.push(buf.readUnsignedShort());
                                    def.opcode132 = arr;
                                    break;
                                }
                                case 139:
                                    def.unnotedId = buf.readUnsignedShort();
                                    break;
                                case 140:
                                    def.notedId = buf.readUnsignedShort();
                                    break;
                                default:
                                    if (opcode >= 142 && opcode < 147) {
                                        def[`opcode${opcode}`] = buf.readUnsignedShort();
                                        continue;
                                    }
                                    if (opcode === 148) {
                                        def.placeholder = buf.readUnsignedShort();
                                        break;
                                    }
                                    if (opcode === 149) {
                                        def.placeholderTemplate = buf.readUnsignedShort();
                                        break;
                                    }
                                    if (opcode >= 150 && opcode < 155) {
                                        def[`opcode${opcode}`] = buf.readUnsignedShort();
                                        continue;
                                    }
                                    if (opcode === 249) {
                                        const count = buf.readUnsignedByte();
                                        const params: Record<string, string | number> = {};
                                        for (let i = 0; i < count; i++) {
                                            const isStringValue = buf.readUnsignedByte() === 1;
                                            const key = buf.readMedium();
                                            if (isStringValue) {
                                                params[String(key)] = readString(buf, cacheInfo);
                                            } else {
                                                params[String(key)] = buf.readInt();
                                            }
                                        }
                                        def.params = params;
                                        break;
                                    }
                                    throw new Error(
                                        "ObjType: Opcode " + opcode + " not implemented in parser.",
                                    );
                            }
                    }
            }
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`parse error on item ${id}:`, e);
    }

    if (Object.keys(groundActions).length > 0) def.groundActions = groundActions;
    if (Object.keys(inventoryActions).length > 0) def.inventoryActions = inventoryActions;
    if (haveRecolor) {
        def.recolorFrom = recolorFrom;
        def.recolorTo = recolorTo;
    }
    if (haveRetexture) {
        def.retextureFrom = retextureFrom;
        def.retextureTo = retextureTo;
    }
    if (haveCount) {
        def.countObj = countObj;
        def.countCo = countCo;
    }

    // Derived-but-cache-backed: equipment slot from params (1564);
    try {
        const obj = loader.load(id) as any;
        const slot = deriveEquipSlotFromParams(obj as any);
        if (slot !== undefined) {
            def.equipmentType = slotName(slot);
        }
        // For weapons only, attach weapon anims if resolvable from struct params; no defaults
        if (slot === EquipmentSlot.WEAPON) {
            // loaderFactory is not available here; we can’t resolve struct without it.
            // Leave resolution for the outer scope below where the factory exists.
            (def as any).__needsWeaponSeqs = true;
        }
    } catch {}

    return def;
}

function exportItems() {
    const caches = loadCacheInfos();
    const cacheArg = (process.argv[2] || "").trim();
    let cacheInfo = loadCacheList(caches).latest;

    if (cacheArg) {
        // Accept either bare folder name or a path like caches/<name>
        const name = cacheArg
            .replace(/\\/g, "/")
            .replace(/^\.\/?/, "")
            .replace(/^caches\//, "")
            .replace(/\/$/, "");
        const found = caches.find((c) => c.name === name);
        if (!found) {
            throw new Error(`Cache '${name}' not found in caches/caches.json`);
        }
        cacheInfo = found;
    }
    const loaded = loadCache(cacheInfo);

    const cacheSystem = CacheSystem.fromFiles(cacheInfo, loaded.files);
    const loaderFactory = getCacheLoaderFactory(cacheInfo, cacheSystem);
    const objTypeLoader = loaderFactory.getObjTypeLoader();

    const outDir = "./items";
    fs.mkdirSync(outDir, { recursive: true });

    const items: ExportedItem[] = [];
    for (let id = 0; id < objTypeLoader.getCount(); id++) {
        const parsed = parseObjType(objTypeLoader, id, cacheInfo);
        if (!parsed) continue;
        // If this item is a weapon and we want seqs, resolve strictly via struct params
        if ((parsed as any).__needsWeaponSeqs) {
            delete (parsed as any).__needsWeaponSeqs;
            try {
                const obj = objTypeLoader.load(id) as any;
                const seqs = resolveWeaponSeqsStrict(loaderFactory, cacheInfo, obj);
                if (seqs) {
                    if (typeof seqs.idle === "number") parsed.standAnim = seqs.idle;
                    if (typeof seqs.walk === "number") parsed.walkAnim = seqs.walk;
                    if (typeof seqs.run === "number") parsed.runAnim = seqs.run;
                }
            } catch {}
        }
        items.push(parsed);
    }

    const outPath = `${outDir}/items.json`;
    fs.writeFileSync(outPath, JSON.stringify(items, null, 2) + "\n", "utf8");
    // eslint-disable-next-line no-console
    console.log(`Exported ${items.length} items to ${outPath} using cache '${cacheInfo.name}'`);
}

exportItems();
