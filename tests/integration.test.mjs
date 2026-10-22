import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..");
const example=resolve(root,"examples/basic-pwa");
const read=path=>readFileSync(resolve(example,path),"utf8");

test("SDK ESM entry imports without native wrappers",async()=>{
  const sdk=await import("../src/wonder.js");
  assert.equal(typeof sdk.createWonderLayer,"function");
  assert.equal(typeof sdk.adaptiveCompute,"function");
});
test("example is an installable-shape PWA with raster icons",()=>{
  const manifest=JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.display,"standalone");
  assert.equal(manifest.scope,"./");
  for(const i of manifest.icons){
    const path=resolve(example,i.src);
    assert.ok(existsSync(path),i.src);
    const buf=readFileSync(path);
    assert.equal(buf.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(buf.readUInt32BE(16),Number(i.sizes.split("x")[0]));
    assert.equal(buf.readUInt32BE(20),Number(i.sizes.split("x")[1]));
  }
});
test("service-worker asset list maps to real local files",()=>{
  const sw=read("sw.js");
  const assets=[...sw.matchAll(/"((?:\.\.?\/)[^"]+)"/g)].map(m=>m[1]);
  const relevant=assets.filter(s=>s.startsWith("./")||s.startsWith("../../"));
  for(const path of relevant)assert.ok(existsSync(resolve(example,path)),path);
  assert.ok(sw.includes('req.mode==="navigate"'));
  assert.ok(sw.includes("cache.addAll(SHELL)"));
  assert.ok(sw.includes('url.pathname.startsWith("/api/")'));
});
test("example imports SDK rather than duplicating native wrapper",()=>{
  const app=read("app.js");
  assert.match(app,/import\s*\{createWonderLayer\}\s*from\s*"\.\.\/\.\.\/src\/wonder\.js"/);
  assert.match(app,/layer\.store\.save/);
  assert.match(app,/layer\.compute/);
  assert.match(app,/layer\.backup/);
  assert.doesNotMatch(app,/Capacitor|Tauri|Electron/);
});
test("example serves a local-only PWA with no public sync",()=>{
  const html=read("index.html");
  assert.match(html,/manifest\.webmanifest/);
  assert.match(html,/storage-status/);
  assert.match(html,/compute-status/);
  assert.doesNotMatch(html,/https?:\/\/[^" ]+/);
  assert.ok(read("app.js").includes("wonder-existing-pwa-example"));
});

test("Phase 3 SDK is imported by host PWA and offline cached",async()=>{
  const sdk=await import("../src/wonder.js");
  assert.equal(typeof sdk.createAdaptiveEngine,"function");
  assert.equal(typeof sdk.createHardwareBridge,"function");
  const html=read("index.html");
  const app=read("app.js");
  const sw=read("sw.js");
  for(const id of ["hardware-inspect","camera-test","geo-test","policy","calibrate","hardware-status"])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(app,/layer\.hardware\.request/);
  assert.match(app,/layer\.scheduler\.stats/);
  assert.match(app,/layer\.scheduler\.calibrate/);
  assert.ok(sw.includes("../../src/scheduler.js"));
  assert.ok(sw.includes("../../src/hardware.js"));
  assert.ok(sw.includes("ryzova-wonder-integration-v3"));
});

test("Phase 4 PWA lifecycle, recovery, and cache dependencies are wired",async()=>{
  const sdk=await import("../src/wonder.js");
  assert.equal(typeof sdk.createReconnectController,"function");
  assert.equal(typeof sdk.createRecoveryManager,"function");
  assert.equal(typeof sdk.createPWALifecycle,"function");
  const app=read("app.js"),html=read("index.html"),sw=read("sw.js");
  for(const target of ["storage-check","storage-persist","check-update","apply-update","pwa-status"])
    assert.ok(html.includes('id="'+target+'"'));
  assert.match(app,/pwa\.register/);
  assert.match(app,/recovery\.requestPersistence/);
  assert.ok(!sw.includes("await self.skipWaiting()"));
  assert.ok(sw.includes("WONDER_ACTIVATE_UPDATE"));
  for(const path of ["../../src/recovery.js","../../src/reconnect.js","../../src/pwa.js"])
    assert.ok(sw.includes(path));
});
