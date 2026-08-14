import { CacheSystem } from "../../rs/cache/CacheSystem";
import { IndexType } from "../../rs/cache/IndexType";
import { parseScriptFromBytes } from "../../rs/cs2/Script";
import { loadCache, loadCacheInfos, loadCacheList } from "./load-util";

const caches = loadCacheInfos();
const cacheInfo = loadCacheList(caches).latest;
const loaded = loadCache(cacheInfo);
const cacheSystem = CacheSystem.fromFiles(cacheInfo, loaded.files);
const index = cacheSystem.getIndex(IndexType.DAT2.clientScript);

const scriptId = parseInt(process.argv[2] || "4125", 10);
const arch = index.getArchive(scriptId);
const file = arch.getFile(0);
const script = parseScriptFromBytes(scriptId, file!.data, cacheSystem.decodeProfile);

console.log(`Script ${scriptId}:`);
console.log(`  intArgCount: ${script.intArgCount}`);
console.log(`  objArgCount: ${script.objArgCount}`);
console.log(`  localIntCount: ${script.localIntCount}`);
console.log(`  localObjCount: ${script.localObjCount}`);
console.log(`  Instructions (${script.instructions.length}):`);

for (let i = 0; i < script.instructions.length; i++) {
    const op = script.instructions[i];
    const intOp = script.intOperands[i];
    const strOp = script.stringOperands[i];
    console.log(`    [${i}] opcode=${op} intOp=${intOp} strOp=${strOp || ""}`);
}
