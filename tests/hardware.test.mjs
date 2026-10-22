import {test} from "node:test";
import assert from "node:assert/strict";
import {createHardwareBridge,WonderHardwareError} from "../src/hardware.js";

test("capability inspection never invokes device permissions",()=>{
  let calls=0;
  const env={isSecureContext:true,navigator:{
    mediaDevices:{getUserMedia:async()=>{calls++;return {};}},
    bluetooth:{requestDevice:async()=>{calls++;return {};}},
    storage:{},usb:{requestDevice:async()=>{calls++;return {};}}
  }};
  const hardware=createHardwareBridge({env});
  const caps=hardware.capabilities();
  assert.equal(caps.camera,true);
  assert.equal(caps.bluetooth,true);
  assert.equal(caps.usb,true);
  assert.equal(caps.serial,false);
  assert.equal(calls,0);
});
test("request camera only through explicit API call",async()=>{
  let passed;
  const stream={getTracks:()=>[]};
  const bridge=createHardwareBridge({env:{isSecureContext:true,navigator:{
    mediaDevices:{getUserMedia:async opts=>{passed=opts;return stream;}}
  }}});
  assert.strictEqual(await bridge.request("camera",{video:{width:640}}),stream);
  assert.deepEqual(passed,{video:{width:640},audio:false});
});
test("bluetooth filters required; no silent acceptAllDevices",async()=>{
  let calls=0;
  const bridge=createHardwareBridge({env:{isSecureContext:true,navigator:{
    bluetooth:{requestDevice:async opts=>{calls++;return opts;}}
  }}});
  await assert.rejects(bridge.request("bluetooth"),e=>e instanceof WonderHardwareError && e.code==="INVALID_OPTIONS");
  assert.equal(calls,0);
  assert.deepEqual(await bridge.request("bluetooth",{filters:[{services:["battery_service"]}]}),
    {filters:[{services:["battery_service"]}]});
  assert.equal(calls,1);
});
test("unsupported, insecure and permission-denied states remain distinct",async()=>{
  const unavailable=createHardwareBridge({env:{isSecureContext:true,navigator:{}}});
  await assert.rejects(unavailable.request("usb"),e=>e.code==="UNSUPPORTED");
  const insecure=createHardwareBridge({env:{isSecureContext:false,navigator:{
    mediaDevices:{getUserMedia:async()=>({})}
  }}});
  await assert.rejects(insecure.request("camera"),e=>e.code==="INSECURE_CONTEXT");
  const denied=createHardwareBridge({env:{isSecureContext:true,navigator:{
    mediaDevices:{getUserMedia:async()=>{const e=new Error("Not allowed");e.name="NotAllowedError";throw e;}}
  }}});
  await assert.rejects(denied.request("camera"),e=>e.code==="PERMISSION_DENIED");
});
test("geolocation and clipboard require actual on-demand calls",async()=>{
  let count=0;
  const bridge=createHardwareBridge({env:{isSecureContext:true,navigator:{
    geolocation:{getCurrentPosition(success,failure,options){count++;assert.equal(options.timeout,3000);success({coords:{accuracy:6}});}},
    clipboard:{readText:async()=>{count++;return "example";},writeText:async t=>{count++;assert.equal(t,"safe");}}
  }}});
  assert.equal((await bridge.request("geolocation",{timeout:3000})).coords.accuracy,6);
  assert.equal(await bridge.request("clipboard-read"),"example");
  assert.equal(await bridge.request("clipboard-write",{text:"safe"}),true);
  await assert.rejects(bridge.request("clipboard-write",{text:42}),e=>e.code==="INVALID_OPTIONS");
  assert.equal(count,3);
});
test("unknown devices are rejected without probing permissions",async()=>{
  const bridge=createHardwareBridge({env:{isSecureContext:true,navigator:{}}});
  await assert.rejects(bridge.request("native-shell"),e=>e.code==="UNKNOWN_DEVICE");
});

