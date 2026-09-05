import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SceneBuffer, getModelFaces } from "../render/buffer/SceneBuffer";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { getCacheLoaderFactory } from "../rs/cache/loader/CacheLoaderFactory";
import { loadCache, loadCacheInfos, loadCacheList } from "../scripts/cache/load-util";

const cacheInfo = loadCacheList(loadCacheInfos()).latest;
const factory = getCacheLoaderFactory(
    cacheInfo,
    CacheSystem.fromFiles(cacheInfo, loadCache(cacheInfo).files),
);
const textureLoader = factory.getTextureLoader();
const cape = factory.getObjTypeLoader().load(6570);
const model = factory.getModelLoader().getModel(cape.maleModel);

assert.ok(model, "Fire cape wearable model should load");
const fireTextureId = 40;
assert.ok(model.faceTextures?.includes(fireTextureId), "Fire cape should use texture 40");

const textureLayer = textureLoader.getTextureIds().indexOf(fireTextureId) + 1;
assert.equal(textureLayer, 41, "Fire cape texture should occupy GPU layer 41");

const litModel = model.light(textureLoader, 64, 850, -30, -50, -30);
const layers = new Map(textureLoader.getTextureIds().map((id, index) => [id, index + 1]));
const buffer = new SceneBuffer(textureLoader, layers, litModel.verticesCount);
buffer.addModel(litModel, getModelFaces(litModel));

const packed = new DataView(buffer.vertexBuf.byteArray().buffer);
let textureLayerFromVertex = -1;
for (let offset = 0; offset < packed.byteLength; offset += 12) {
    const v1 = packed.getUint32(offset + 4, true);
    if ((v1 >>> 31) === 0) continue;
    const hsl = (v1 >>> 15) & 0xffff;
    textureLayerFromVertex = (hsl >>> 7) | ((packed.getUint32(offset + 8, true) >>> 5) & 1) << 9;
    break;
}
assert.equal(textureLayerFromVertex, textureLayer, "Fire cape vertices should retain their GPU layer");

const shader = fs.readFileSync(
    path.resolve(__dirname, "../render/shaders/includes/vertex.glsl"),
    "utf8",
);
assert.doesNotMatch(shader, /\) \+ 1\) \* isTextured/, "Shader must not offset texture layers");

console.log("Fire cape texture regression test passed");
