// Node CPU/WASM benchmark only. Do not describe this as browser GPU evidence.
import {readFileSync} from "node:fs";
import {cpus,platform,arch} from "node:os";
import {performance} from "node:perf_hooks";
import {fileURLToPath} from "node:url";
import {jsTransform} from "../src/compute.js";

const size=Number(process.argv[2]??65536);
const rounds=Number(process.argv[3]??9);
if(!Number.isSafeInteger(size)||size<64||size>1_000_000||
   !Number.isSafeInteger(rounds)||rounds<3||rounds>30)
  throw new Error("Expected size 64..1000000 and rounds 3..30");
const wasm=readFileSync(fileURLToPath(new URL("../src/compute.wasm",import.meta.url)));
const module=await WebAssembly.compile(wasm);
const {exports}=new WebAssembly.Instance(module);
const {memory,transform}=exports;
const input=Float32Array.from({length:size},(_,i)=>(i%101)/4);
const offset=65536,outputOffset=offset+input.byteLength;
const needed=Math.ceil((outputOffset+input.byteLength)/65536);
if(needed>memory.buffer.byteLength/65536)memory.grow(needed-memory.buffer.byteLength/65536);
new Float32Array(memory.buffer,offset,size).set(input);
const js=()=>jsTransform(input,{gain:1.5,bias:2});
const wasmRun=()=>{transform(offset,outputOffset,size,1.5,2);
  return new Float32Array(memory.buffer,outputOffset,size);};
const a=js(),b=wasmRun();
for(let i=0;i<size;i++)if(Math.abs(a[i]-b[i])>0.001)
  throw new Error("WASM numerical parity failed at index "+i);
function measure(fn){
  for(let i=0;i<3;i++)fn();
  const samples=[];
  for(let i=0;i<rounds;i++){
    const start=performance.now();fn();samples.push(performance.now()-start);
  }
  samples.sort((x,y)=>x-y);
  return {medianMs:Number(samples[Math.floor(samples.length/2)].toFixed(3)),
          samplesMs:samples.map(x=>Number(x.toFixed(3)))};
}
console.log(JSON.stringify({
  schema:"wonder-phase2-node-benchmark-v1",
  measuredAt:new Date().toISOString(),
  environment:{node:process.version,os:platform(),arch:arch(),cpu:cpus()[0]?.model??"unknown"},
  workload:{elements:size,rounds,operation:"float32 *1.5 +2"},
  wasmBinaryVerified:true,
  result:{javascript:measure(js),wasm:measure(wasmRun)},
  notMeasured:["WebGPU hardware","browser WASM startup","Web Workers","installability"],
  note:"CPU-only Node experiment: no native parity or GPU claim"
},null,2));
