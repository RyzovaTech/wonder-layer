import {test} from "node:test";
import assert from "node:assert/strict";
import {detectCapabilities,inspectCapabilities} from "../src/capabilities.js";
test("detection never calls hardware permissions",()=>{
  const env={isSecureContext:true,WebAssembly:{},Worker:class{},indexedDB:{},
    navigator:{gpu:{requestAdapter:async()=>({})},mediaDevices:{getUserMedia(){throw Error("do not request camera");}},
      storage:{estimate:async()=>({quota:1024,usage:20}),persisted:async()=>false,getDirectory(){}}}};
  const caps=detectCapabilities(env);
  assert.equal(caps.camera,true);
  assert.equal(caps.opfs,true);
  assert.equal(caps.webGPU,true);
});
test("GPU API exposure is not a GPU adapter",async()=>{
  const env={navigator:{gpu:{requestAdapter:async()=>null}}};
  const report=await inspectCapabilities(env);
  assert.equal(report.available.webGPU,true);
  assert.equal(report.checks.webGPU.state,"unavailable");
  assert.equal(report.policy.permissionBypass,false);
});
test("storage quota and persistence states are distinguished",async()=>{
  const env={navigator:{storage:{estimate:async()=>({quota:1024,usage:30}),persisted:async()=>true}}};
  const result=await inspectCapabilities(env);
  assert.equal(result.checks.storage.quota,1024);
  assert.equal(result.checks.persistence.state,"granted");
});

