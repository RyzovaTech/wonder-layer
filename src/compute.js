const shader=[
  "struct Settings { length: u32, gain: f32, bias: f32, pad: f32 };",
  "@group(0) @binding(0) var<storage, read> inputData: array<f32>;",
  "@group(0) @binding(1) var<storage, read_write> outputData: array<f32>;",
  "@group(0) @binding(2) var<uniform> settings: Settings;",
  "@compute @workgroup_size(64)",
  "fn main(@builtin(global_invocation_id) id: vec3<u32>) {",
  "  if (id.x < settings.length) { outputData[id.x] = inputData[id.x] * settings.gain + settings.bias; }",
  "}"
].join("\n");

export function jsTransform(input,{gain=1.5,bias=2}={}){
  if(!(input instanceof Float32Array))throw new TypeError("Expected Float32Array");
  return Float32Array.from(input,x=>x*gain+bias);
}

let wasmPromise;
async function moduleWasm(){
  if(!wasmPromise){
    wasmPromise=(async()=>{
      const response=await fetch(new URL("./compute.wasm",import.meta.url));
      if(!response.ok)throw new Error("WASM fetch failed: "+response.status);
      return WebAssembly.compile(await response.arrayBuffer());
    })().catch(error=>{wasmPromise=undefined;throw error;});
  }
  return wasmPromise;
}
export async function wasmTransform(input,options={}){
  if(!(input instanceof Float32Array))throw new TypeError("Expected Float32Array");
  const {gain=1.5,bias=2}=options;
  const instance=await WebAssembly.instantiate(await moduleWasm());
  const {memory,transform}=instance.exports;
  if(!memory || typeof transform!=="function")throw new Error("Invalid WASM exports");
  const a=65536,b=a+input.byteLength,bytes=b+input.byteLength;
  const pages=Math.ceil(bytes/65536);
  if(pages>memory.buffer.byteLength/65536)memory.grow(pages-memory.buffer.byteLength/65536);
  new Float32Array(memory.buffer,a,input.length).set(input);
  transform(a,b,input.length,gain,bias);
  return new Float32Array(new Float32Array(memory.buffer,b,input.length));
}
export async function workerTransform(input,options={}){
  if(typeof Worker!=="function")throw new Error("Workers unavailable");
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL("./compute-worker.js",import.meta.url),{type:"module"});
    let settled=false;
    const done=(fn,value)=>{
      if(settled)return;
      settled=true;clearTimeout(timer);
      options.signal?.removeEventListener?.("abort",onAbort);
      worker.terminate();fn(value);
    };
    const onAbort=()=>{const error=new Error("Worker operation aborted");error.name="AbortError";done(reject,error);};
    const timer=setTimeout(()=>done(reject,new Error("Worker timeout")),20000);
    options.signal?.addEventListener?.("abort",onAbort,{once:true});
    if(options.signal?.aborted)return onAbort();
    worker.onmessage=e=>done(resolve,new Float32Array(e.data));
    worker.onerror=e=>done(reject,new Error(e.message||"Worker failed"));
    worker.postMessage({values:input,gain:options.gain??1.5,bias:options.bias??2});
  });
}
export async function gpuTransform(input,options={},env=globalThis){
  if(!env.navigator?.gpu)throw new Error("WebGPU unavailable");
  const adapter=await env.navigator.gpu.requestAdapter();
  if(!adapter)throw new Error("No WebGPU adapter");
  const device=await adapter.requestDevice();
  const U=env.GPUBufferUsage,M=env.GPUMapMode;
  if(!U || !M)throw new Error("WebGPU constants unavailable");
  if(!input.length)return new Float32Array(0);
  if(input.byteLength>device.limits.maxStorageBufferBindingSize)throw new Error("GPU binding too large");
  if(Math.ceil(input.length/64)>device.limits.maxComputeWorkgroupsPerDimension)
    throw new Error("GPU dispatch exceeds device limits");
  const buffers=[];
  const make=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};
  const inBuf=make(input.byteLength,U.STORAGE|U.COPY_DST);
  const outBuf=make(input.byteLength,U.STORAGE|U.COPY_SRC);
  const readBuf=make(input.byteLength,U.COPY_DST|U.MAP_READ);
  const params=make(16,U.UNIFORM|U.COPY_DST);
  try{
    device.queue.writeBuffer(inBuf,0,input);
    const settings=new ArrayBuffer(16),view=new DataView(settings);
    view.setUint32(0,input.length,true);
    view.setFloat32(4,options.gain??1.5,true);
    view.setFloat32(8,options.bias??2,true);
    device.queue.writeBuffer(params,0,settings);
    const pipeline=device.createComputePipeline({layout:"auto",compute:{module:device.createShaderModule({code:shader}),entryPoint:"main"}});
    const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:inBuf}},
      {binding:1,resource:{buffer:outBuf}},
      {binding:2,resource:{buffer:params}}
    ]});
    const command=device.createCommandEncoder();
    const pass=command.beginComputePass();
    pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(input.length/64));pass.end();
    command.copyBufferToBuffer(outBuf,0,readBuf,0,input.byteLength);
    device.queue.submit([command.finish()]);
    await readBuf.mapAsync(M.READ);
    return new Float32Array(new Float32Array(readBuf.getMappedRange().slice(0)));
  }finally{
    try{readBuf.unmap();}catch{}
    for(const buffer of buffers)buffer.destroy();
  }
}
export function selectComputeOrder(count,capabilities,prefer="auto"){
  if(!Number.isSafeInteger(count)||count<0)throw new Error("Invalid element count");
  if(prefer!=="auto"){
    if(!["gpu","wasm","worker","js"].includes(prefer))throw new Error("Invalid backend");
    return [prefer];
  }
  const order=[];
  if(count>=65536 && capabilities.webGPU)order.push("gpu");
  if(count>=8192 && capabilities.webAssembly)order.push("wasm");
  if(count>=32768 && capabilities.webWorkers)order.push("worker");
  order.push("js");
  return order;
}
export async function adaptiveCompute(input,{prefer="auto",gain=1.5,bias=2,capabilities,backends}={}){
  if(!(input instanceof Float32Array))throw new TypeError("Expected Float32Array");
  const caps=capabilities??{
    webGPU:!!globalThis.navigator?.gpu,
    webAssembly:typeof WebAssembly!=="undefined",
    webWorkers:typeof Worker!=="undefined"
  };
  const engines=backends??{gpu:gpuTransform,wasm:wasmTransform,worker:workerTransform,js:jsTransform};
  const order=selectComputeOrder(input.length,caps,prefer),failures=[];
  for(const backend of order){
    try{
      const result=await engines[backend](input,{gain,bias});
      if(!(result instanceof Float32Array)||result.length!==input.length)throw new Error("Invalid result shape");
      for(let i=0;i<input.length;i++){
        const expected=Math.fround(Math.fround(input[i]*gain)+bias);
        if(!Number.isFinite(result[i])||Math.abs(result[i]-expected)>0.001+Math.abs(expected)*0.00001)
          throw new Error("Invalid result at index "+i);
      }
      return {backend,data:result,failures};
    }catch(error){failures.push({backend,error:String(error?.message??error)});}
  }
  throw new AggregateError(failures.map(x=>new Error(x.error)),"All compute backends failed");
}

