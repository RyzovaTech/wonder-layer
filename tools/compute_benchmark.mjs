// Performance evidence: hot kernel ONLY. WASM startup, transfer cost and GPU are excluded.
import {readFileSync} from "node:fs";
import {cpus,platform,arch} from "node:os";
import {performance} from "node:perf_hooks";
import {fileURLToPath} from "node:url";
const sizes=[8192,65536,262144],rounds=13;
const wasm=readFileSync(fileURLToPath(new URL("../src/compute.wasm",import.meta.url)));
const compiled=await WebAssembly.compile(wasm);
const {exports}=new WebAssembly.Instance(compiled);
const {memory,transform}=exports;
const rows=[];
for(const size of sizes){
  const input=Float32Array.from({length:size},(_,i)=>(i%101)/4);
  const output=new Float32Array(size);
  const inPtr=65536,outPtr=inPtr+input.byteLength;
  const pages=Math.ceil((outPtr+input.byteLength)/65536);
  if(pages>memory.buffer.byteLength/65536)memory.grow(pages-memory.buffer.byteLength/65536);
  new Float32Array(memory.buffer,inPtr,size).set(input);
  const outWasm=new Float32Array(memory.buffer,outPtr,size);
  const js=()=>{for(let i=0;i<size;i++)output[i]=input[i]*1.5+2;return output;};
  const hotWasm=()=>{transform(inPtr,outPtr,size,1.5,2);return outWasm;};
  js();hotWasm();
  for(let i=0;i<size;i++)if(Math.abs(output[i]-outWasm[i])>0.001)
    throw new Error("WASM parity mismatch at "+i);
  const measure=fn=>{
    for(let i=0;i<8;i++)fn();
    const times=[];
    for(let i=0;i<rounds;i++){const start=performance.now();fn();times.push(performance.now()-start);}
    times.sort((a,b)=>a-b);
    return Number(times[Math.floor(times.length/2)].toFixed(4));
  };
  rows.push({elements:size,jsInPlaceMedianMs:measure(js),wasmHotMedianMs:measure(hotWasm)});
}
console.log(JSON.stringify({
  schema:"wonder-phase2-hot-cpu-benchmark-v2",date:new Date().toISOString(),
  environment:{node:process.version,os:platform(),arch:arch(),cpu:cpus()[0]?.model??"unknown"},
  rounds,wasmParity:true,results:rows,
  excluded:["WASM compilation/startup","JS-to-WASM input copy","Worker startup/message overhead","physical WebGPU execution","browser execution"],
  note:"CPU hot-kernel comparison; does not prove end-to-end application speed or native parity"
},null,2));
