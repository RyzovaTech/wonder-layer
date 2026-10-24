import {test} from "node:test";
import assert from "node:assert/strict";
import {createBetaManifest} from "../tools/beta-candidate.mjs";
const names=["wonder.js","client.js","react.js","vue.js","compute.wasm",
  "compute-worker.js","index.d.ts","client.d.ts","react.d.ts","vue.d.ts"];
const fixture=()=>names.map(path=>({path,bytes:42,sha256:"a".repeat(64)}));
const pkg={name:"@ryzova/wonder-layer",version:"0.0.0-poc.1",private:true};
test("private beta candidate never asserts registry publication or release certification",()=>{
  const report=createBetaManifest(pkg,fixture(),{commit:"b".repeat(40)});
  assert.equal(report.candidateStatus,"ENGINEERING_BUILD_ONLY_NOT_RELEASE_APPROVED");
  assert.equal(report.registryPublished,false);
  assert.equal(report.physicalDeviceCertification,false);
  assert.equal(report.independentHumanSecurityReviewApproved,false);
  assert.equal(report.publicReleaseApproved,false);
  assert.equal(report.gitCommit,"b".repeat(40));
});
test("reject unapproved public npm publication metadata",()=>{
  assert.throws(()=>createBetaManifest({...pkg,private:false},fixture()),/prerelease/);
  assert.throws(()=>createBetaManifest({...pkg,version:"1.0.0"},fixture()),/prerelease/);
});
test("reject missing packaged browser resources",()=>{
  assert.throws(()=>createBetaManifest(pkg,fixture().filter(x=>x.path!=="compute.wasm")),/Incomplete/);
  assert.throws(()=>createBetaManifest(pkg,fixture().filter(x=>x.path!=="index.d.ts")),/Incomplete/);
});
test("commit SHA is null unless exact 40-character hex",()=>{
  const report=createBetaManifest(pkg,fixture(),{commit:"unknown"});
  assert.equal(report.gitCommit,null);
});

