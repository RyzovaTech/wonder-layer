import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {jsTransform,selectComputeOrder,adaptiveCompute,gpuTransform} from "../src/compute.js";
test("JS transform produces expected values",()=>{
  assert.deepEqual(Array.from(jsTransform(new Float32Array([1,2,3]))),[3.5,5,6.5]);
});
test("small vectors skip acceleration overhead",()=>{
  assert.deepEqual(selectComputeOrder(32,{webGPU:true,webAssembly:true,webWorkers:true}),["js"]);
});
test("large vectors select GPU WASM worker JS order",()=>{
  assert.deepEqual(selectComputeOrder(65536,{webGPU:true,webAssembly:true,webWorkers:true}),["gpu","wasm","worker","js"]);
});
test("invalid compute engine preference rejected",()=>{
  assert.throws(()=>selectComputeOrder(1,{},"native"),/Invalid backend/);
});
test("GPU fails transparently if browser lacks API",async()=>{
  await assert.rejects(gpuTransform(new Float32Array([1])),/WebGPU unavailable/);
});
test("fallback rejects wrong numerical output",async()=>{
  const input=new Float32Array(65536).fill(2);
  const result=await adaptiveCompute(input,{
    capabilities:{webGPU:true,webAssembly:true,webWorkers:true},
    backends:{
      gpu:()=>new Float32Array(input.length).fill(Number.NaN),
      wasm:()=>new Float32Array(input.length).fill(5),
      worker:()=>{throw Error("not reached");},
      js:()=>{throw Error("not reached");}
    }
  });
  assert.equal(result.backend,"wasm");
  assert.equal(result.failures.length,1);
});
test("real compiled WASM module computes float transform",async()=>{
  const wasm=readFileSync(new URL("../src/compute.wasm",import.meta.url));
  const {instance}=await WebAssembly.instantiate(wasm);
  const input=Float32Array.from({length:100000},(_,i)=>i%100);
  const first=65536,second=first+input.byteLength;
  const total=second+input.byteLength;
  const grow=Math.ceil(total/65536)-instance.exports.memory.buffer.byteLength/65536;
  if(grow>0)instance.exports.memory.grow(grow);
  new Float32Array(instance.exports.memory.buffer,first,input.length).set(input);
  instance.exports.transform(first,second,input.length,1.5,2);
  const result=new Float32Array(instance.exports.memory.buffer,second,input.length);
  for(let i=0;i<result.length;i++)assert.ok(Math.abs(result[i]-(input[i]*1.5+2))<1e-4);
});

