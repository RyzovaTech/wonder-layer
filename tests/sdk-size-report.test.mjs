import {test} from "node:test";
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {SDK_REQUIRED_ASSETS,SDK_SIZE_LIMITS,summarizeSdkAssets,inspectSdkDistribution} from "../tools/sdk-size-report.mjs";

const projectRoot=fileURLToPath(new URL("../",import.meta.url));
const baseline=()=>SDK_REQUIRED_ASSETS.map(path=>({path,bytes:256}));

test("Phase 8B reports honest uncompressed asset sizes and required SDK files",()=>{
  const report=summarizeSdkAssets([...baseline(),{path:"BUILD-MANIFEST.json",bytes:100}]);
  assert.equal(report.status,"PASS_INTERNAL_BUDGET");
  assert.equal(report.measurement,"uncompressed-dist-file-bytes-not-consumer-bundle");
  assert.equal(report.totalBytes,SDK_REQUIRED_ASSETS.length*256+100);
  assert.equal(report.publicReleaseApproved,false);
  assert.equal(report.wasmBytes,256);
  assert.equal(report.javaScriptBytes,5*256);
  assert.equal(report.declarationBytes,4*256);
});

test("Phase 8B blocks missing, duplicate, invalid-path and oversized assets",()=>{
  const missing=summarizeSdkAssets(baseline().filter(x=>x.path!=="compute.wasm"));
  assert.equal(missing.status,"FAIL");
  assert.match(missing.problems.join(" "),/compute\.wasm/);
  const oversized=summarizeSdkAssets(baseline().map(x=>x.path==="wonder.js"?
    {...x,bytes:SDK_SIZE_LIMITS.maxSingleJavaScriptBytes+1}:x));
  assert.equal(oversized.status,"FAIL");
  assert.match(oversized.problems.join(" "),/Oversized JS asset/);
  assert.throws(()=>summarizeSdkAssets([...baseline(),baseline()[0]]),/Duplicate/);
  for(const path of ["../secret",".","nested/evil.js","nested\\evil.js"]){
    assert.throws(()=>summarizeSdkAssets([{path,bytes:7}]),/Invalid/);
  }
  assert.throws(()=>summarizeSdkAssets([{path:"a.js",bytes:Infinity}]),/Invalid/);
  assert.throws(()=>summarizeSdkAssets([{path:"a.js",bytes:-1}]),/Invalid/);
  const overTotal=summarizeSdkAssets(baseline().map(x=>({
    ...x,bytes:SDK_SIZE_LIMITS.maxTotalBytes
  })));
  assert.match(overTotal.problems.join(" "),/uncompressed budget/);
});

test("Phase 8B checks actual built SDK distribution while remaining private",async()=>{
  const report=await inspectSdkDistribution({projectRoot:resolve(projectRoot)});
  assert.equal(report.status,"PASS_INTERNAL_BUDGET",report.problems.join("; "));
  assert(report.totalBytes>0);
  for(const path of SDK_REQUIRED_ASSETS){
    assert(report.assets.some(x=>x.path===path),"Missing "+path);
  }
  assert.equal(report.publicReleaseApproved,false);
});
