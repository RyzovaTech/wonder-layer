import {test} from "node:test";
import assert from "node:assert/strict";
import {createAdaptiveEngine} from "../src/scheduler.js";

function env({gpu=true,wasm=true,worker=true,adapter=true}={}){
  const obj={isSecureContext:true,navigator:{gpu:gpu?{requestAdapter:async()=>(adapter?{}:null)}:undefined}};
  if(!gpu)delete obj.navigator.gpu;
  if(wasm)obj.WebAssembly={};
  if(worker)obj.Worker=class {};
  return obj;
}
test("plan honors size bands with GPU WASM Worker and JS fallback",()=>{
  const engine=createAdaptiveEngine({env:env()});
  assert.deepEqual(engine.plan(100),["js"]);
  assert.deepEqual(engine.plan(65536),["gpu","wasm","worker","js"]);
  assert.deepEqual(engine.plan(65536,{policy:"responsive"}),["worker","gpu","wasm","js"]);
});
test("explicit preferred backend is not silently switched",async()=>{
  const engine=createAdaptiveEngine({env:env(),backends:{
    gpu:()=>{throw new Error("device failed");},js:()=>new Float32Array([5])
  }});
  await assert.rejects(engine.run(new Float32Array([2]),{prefer:"gpu"}),/All compute backends failed/);
});
test("invalid GPU results trigger deterministic WASM fallback and cooldown",async()=>{
  let current=1000,gpuCalls=0;
  const engine=createAdaptiveEngine({env:env(),clock:()=>current,failureCooldownMs:5000,backends:{
    gpu:()=>{gpuCalls++;return new Float32Array(65536).fill(NaN);},
    wasm:input=>new Float32Array(input.length).fill(5),
    worker:()=>{throw new Error("unexpected worker");},
    js:()=>{throw new Error("unexpected JS");}
  }});
  const input=new Float32Array(65536).fill(2);
  const first=await engine.run(input);
  assert.equal(first.backend,"wasm");
  assert.equal(first.failures.length,1);
  const second=await engine.run(input);
  assert.equal(second.backend,"wasm");
  assert.equal(gpuCalls,1);
  assert.equal(engine.stats()["gpu:large"].failures,1);
  assert.equal(engine.health().gpu.state,"cooldown");
  current=6001;
  assert.equal(engine.plan(input.length)[0],"gpu");
});
test("GPU adapter absence is distinguished from API existence",async()=>{
  const engine=createAdaptiveEngine({env:env({adapter:false})});
  const report=await engine.inspect();
  assert.equal(report.checks.webGPU.state,"unavailable");
  assert.deepEqual(engine.plan(65536),["wasm","worker","js"]);
});
test("worker priority keeps responsive large workloads off UI thread",async()=>{
  const engine=createAdaptiveEngine({env:env(),backends:{
    worker:input=>new Float32Array(input.length).fill(5),
    gpu:()=>{throw new Error("gpu should not run");},
    wasm:()=>{throw new Error("wasm should not run");}
  }});
  const result=await engine.run(new Float32Array(65536).fill(2),{policy:"responsive"});
  assert.equal(result.backend,"worker");
  assert.equal(result.attempted.length,1);
});
test("rejects invalid options or nonfinite input and size violations",async()=>{
  const engine=createAdaptiveEngine({env:env(),maxElements:100});
  await assert.rejects(engine.run(new Float32Array([NaN])),/nonfinite/);
  await assert.rejects(engine.run(new Float32Array(101)),/compute limit/);
  await assert.rejects(engine.run(new Float32Array([2]),{gain:Infinity}),/finite/);
  await assert.rejects(engine.run(new Float32Array([2]),{prefer:"native"}),/Invalid backend/);
});
test("AbortSignal stops scheduled tasks without running backend",async()=>{
  const controller=new AbortController();controller.abort();let calls=0;
  const engine=createAdaptiveEngine({env:env(),backends:{js:()=>{calls++;return new Float32Array([5]);}}});
  await assert.rejects(engine.run(new Float32Array([2]),{signal:controller.signal}),{name:"AbortError"});
  assert.equal(calls,0);
});
test("metrics reset removes cooldown and statistics",async()=>{
  const engine=createAdaptiveEngine({env:env(),backends:{js:input=>new Float32Array(input.length).fill(5)}});
  const value=await engine.run(new Float32Array([2]));
  assert.equal(value.backend,"js");
  assert.equal(engine.stats()["js:small"].successes,1);
  engine.reset();
  assert.deepEqual(engine.stats(),{});
  assert.deepEqual(engine.health(),{});
});


test("opt-in calibration measures engines and selects fastest verified backend",async()=>{
  let clock=1000;
  const envv=env();
  const costs={gpu:9,wasm:2,worker:4,js:6};
  const backends=Object.fromEntries(Object.entries(costs).map(([id,cost])=>
    [id,input=>{clock+=cost;return new Float32Array(input.length).fill(5);}]
  ));
  const engine=createAdaptiveEngine({env:envv,clock:()=>clock,backends});
  const input=new Float32Array(65536).fill(2);
  assert.equal(engine.plan(65536)[0],"gpu");
  const calibration=await engine.calibrate(input,{samples:2});
  assert.equal(calibration.results.length,4);
  assert.equal(calibration.failures.length,0);
  assert.equal(engine.plan(65536)[0],"wasm");
  const result=await engine.run(input);
  assert.equal(result.backend,"wasm");
  assert.equal(engine.plan(65536,{policy:"responsive"})[0],"worker");
});
test("calibration does not silently grant or request hardware permissions",async()=>{
  let requestPermissions=0;
  const engine=createAdaptiveEngine({
    env:{isSecureContext:true,navigator:{},Worker:undefined},
    backends:{js:input=>new Float32Array(input.length).fill(5)}
  });
  const report=await engine.calibrate(new Float32Array([2]),{samples:1});
  assert.equal(report.results.length,1);
  assert.equal(requestPermissions,0);
  await assert.rejects(engine.calibrate(new Float32Array([2]),{samples:200}),/samples/);
});
