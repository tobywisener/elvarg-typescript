import assert from "node:assert/strict";

import { CacheSystem } from "../rs/cache/CacheSystem";
import { WidgetLoader } from "../widgets/WidgetLoader";
import { loadCache, loadCacheInfos, loadCacheList } from "../scripts/cache/load-util";

const cacheInfo = loadCacheList(loadCacheInfos()).latest;
const cache = CacheSystem.fromFiles(cacheInfo, loadCache(cacheInfo).files);
const bank = new WidgetLoader(cache).loadWidgetGroup(12);
const model = bank?.widgets.get((12 << 16) | 55);

assert.ok(model, "bank widget 12:55 should decode");
assert.equal(model.type, 6);
assert.equal(model.parentUid, (12 << 16) | 54);
assert.equal(model.modelId, -1);
console.log("Widget loader regression test passed");
