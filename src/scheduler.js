import {detectCapabilities,inspectCapabilities} from "./capabilities.js";
import {selectComputeOrder,gpuTransform,wasmTransform,workerTransform,jsTransform} from "./compute.js";

const ENGINES=["gpu","wasm","worker","js"];
const DEFAULT_THRESHOLDS=Object.freeze({wasm:8192,worker:32768,gpu:65536});
const bucket=n=>n<8192?"small":n<65536?"medium":n<262144?"large":"very-large";
const now=()=>globalThis.performance?.now?.()??Date.now();
const failureText=error=>String(error?.message??error);
function validateOptions(input,options,limit){
  if(!(input instanceof Float32Array))throw new TypeError("Expected Float32Array");
  if(input.length>limit)throw new RangeError("Input exceeds configured compute limit");
  if(!["auto",...ENGINES].includes(options.prefer??"auto"))throw new Error("Invalid backend preference");
  if(!["throughput","responsive"].includes(options.policy??"throughput"))throw new Error("Invalid compute policy");
  for(const n of [options.gain??1.5,options.bias??2]){
    if(typeof n!=="number"||!Number.isFinite(n))throw new TypeError("gain/bias must be finite numbers");
  }
  for(let i=0;i<input.length;i++)if(!Number.isFinite(input[i]))throw new TypeError("Input contains nonfinite values");
}
function validateOutput(input,result,{gain=1.5,bias=2}){
  if(!(result instanceof Float32Array)||result.length!==input.length)throw new Error("Invalid compute result shape");
  for(let i=0;i<input.length;i++){
    // WGSL, WASM and JS may round a multiply at slightly different points.
    const expected=Math.fround(Math.fround(input[i]*gain)+bias);
    const epsilon=0.001+0.00001*Math.abs(expected);
    if(!Number.isFinite(result[i])||Math.abs(result[i]-expected)>epsilon)
      throw new Error("Incorrect compute result at element "+i);
  }
}
function aborted(signal){
  if(signal?.aborted){
    const error=new Error("Compute operation aborted");
    error.name="AbortError";
    throw error;
  }
}
export function createAdaptiveEngine({
  env=globalThis,
  clock=now,
  backends,
  maxElements=4_000_000,
  failureCooldownMs=30_000,
  thresholds=DEFAULT_THRESHOLDS
}={}){
  if(!Number.isSafeInteger(maxElements)||maxElements<1)throw new Error("Invalid maxElements");
  const workers=backends??{
    gpu:(input,opts)=>gpuTransform(input,opts,env),
    wasm:wasmTransform,worker:workerTransform,js:jsTransform
  };
  const metrics=new Map();
  const cooled=new Map();
  let inspected=null;
  async function inspect({refresh=false}={}){
    if(!inspected||refresh)inspected=await inspectCapabilities(env);
    return inspected;
  }
  function plan(length,{prefer="auto",policy="throughput",capabilities}={}){
    if(!Number.isSafeInteger(length)||length<0||length>maxElements)throw new RangeError("Invalid vector size");
    if(prefer!=="auto"){
      if(!ENGINES.includes(prefer))throw new Error("Invalid backend preference");
      return [prefer];
    }
    const caps={...(capabilities??inspected?.available??detectCapabilities(env))};
    if(inspected?.checks?.webGPU && inspected.checks.webGPU.state!=="adapter-ready")
      caps.webGPU=false;
    const ordered=selectComputeOrder(length,caps,"auto");
    if(length>0&&length>=thresholds.gpu&&caps.webGPU&&!ordered.includes("gpu"))ordered.unshift("gpu");
    if(length>=thresholds.wasm&&caps.webAssembly&&!ordered.includes("wasm"))ordered.splice(ordered.indexOf("js"),0,"wasm");
    if(length>=thresholds.worker&&caps.webWorkers&&!ordered.includes("worker"))ordered.splice(ordered.indexOf("js"),0,"worker");
    if(policy==="responsive"&&length>=thresholds.worker&&ordered.includes("worker")){
      ordered.splice(ordered.indexOf("worker"),1);
      ordered.unshift("worker");
    }
    // A backend repeatedly failing is skipped until its cooldown expires.
    const current=clock();
    const viable=ordered.filter(id=>id==="js"||(cooled.get(id)??0)<=current);
    if(policy==="throughput" && viable.length>=2 && viable.every(id=>(metrics.get(id+":"+bucket(length))?.successes??0)>0))
      viable.sort((a,b)=>(metrics.get(a+":"+bucket(length)).emaMs??Infinity)-
                        (metrics.get(b+":"+bucket(length)).emaMs??Infinity));
    return viable.length?viable:["js"];
  }
  async function calibrate(input,{samples=2,...options}={}){
    validateOptions(input,options,maxElements);
    if(!Number.isSafeInteger(samples)||samples<1||samples>5)
      throw new RangeError("Calibration samples must be between 1 and 5");
    const choices=plan(input.length,{...options,policy:"throughput"});
    const report={size:input.length,samples,results:[],failures:[]};
    for(const backend of choices){
      if(typeof workers[backend]!=="function")continue;
      const durations=[];
      for(let attempt=0;attempt<samples;attempt++){
        aborted(options.signal);
        const since=clock();
        const key=backend+":"+bucket(input.length);
        const prev=metrics.get(key)??{attempts:0,successes:0,failures:0,lastMs:null,emaMs:null};
        try{
          const output=await workers[backend](input,{
            gain:options.gain??1.5,bias:options.bias??2,signal:options.signal
          });
          aborted(options.signal);
          validateOutput(input,output,{gain:options.gain??1.5,bias:options.bias??2});
          const ms=Math.max(0,clock()-since);
          metrics.set(key,{...prev,attempts:prev.attempts+1,successes:prev.successes+1,
            lastMs:ms,emaMs:prev.emaMs==null?ms:prev.emaMs*0.75+ms*0.25});
          cooled.delete(backend);durations.push(ms);
        }catch(error){
          if(error?.name==="AbortError")throw error;
          report.failures.push({backend,error:failureText(error)});
          metrics.set(key,{...prev,attempts:prev.attempts+1,failures:prev.failures+1,
            lastMs:Math.max(0,clock()-since)});
          if(backend!=="js")cooled.set(backend,clock()+failureCooldownMs);
          break;
        }
      }
      if(durations.length){
        durations.sort((a,b)=>a-b);
        report.results.push({backend,successfulSamples:durations.length,
          medianMs:durations[Math.floor(durations.length/2)]});
      }
    }
    return report;
  }
  async function run(input,options={}){
    validateOptions(input,options,maxElements);
    aborted(options.signal);
    const choices=plan(input.length,options);
    const failures=[];
    const started=clock();
    for(const backend of choices){
      aborted(options.signal);
      const since=clock();
      const b=bucket(input.length);
      const key=backend+":"+b;
      const previous=metrics.get(key)??{attempts:0,successes:0,failures:0,lastMs:null,emaMs:null};
      try{
        if(typeof workers[backend]!=="function")throw new Error("Backend implementation unavailable");
        const result=await workers[backend](input,{gain:options.gain??1.5,bias:options.bias??2,signal:options.signal});
        aborted(options.signal);
        validateOutput(input,result,{gain:options.gain??1.5,bias:options.bias??2});
        const durationMs=Math.max(0,clock()-since);
        metrics.set(key,{...previous,attempts:previous.attempts+1,successes:previous.successes+1,lastMs:durationMs,
          emaMs:previous.emaMs==null?durationMs:previous.emaMs*0.75+durationMs*0.25});
        cooled.delete(backend);
        return {backend,data:result,failures,attempted:[...failures.map(x=>x.backend),backend],durationMs:Math.max(0,clock()-started)};
      }catch(error){
        if(error?.name==="AbortError")throw error;
        const elapsed=Math.max(0,clock()-since);
        failures.push({backend,error:failureText(error)});
        metrics.set(key,{...previous,attempts:previous.attempts+1,failures:previous.failures+1,lastMs:elapsed});
        if(backend!=="js")cooled.set(backend,clock()+failureCooldownMs);
      }
    }
    throw new AggregateError(failures.map(x=>new Error(x.error)),"All compute backends failed");
  }
  return Object.freeze({
    runtime:"pure-pwa",
    inspect,plan,run,calibrate,
    stats:()=>Object.fromEntries([...metrics].map(([name,values])=>[name,{...values}])),
    health:()=>Object.fromEntries([...cooled].map(([name,until])=>[name,{state:clock()<until?"cooldown":"ready",cooldownUntil:until}])),
    reset:()=>{metrics.clear();cooled.clear();inspected=null;}
  });
}

