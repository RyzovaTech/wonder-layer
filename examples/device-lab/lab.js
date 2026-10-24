import {createHardwareBridge,createAdaptiveEngine,createWonderLayer} from "../../src/wonder.js";
const byId=id=>document.getElementById(id);
const bridge=createHardwareBridge();
const engine=createAdaptiveEngine();
const outcomes=[];
const ALLOWED=new Set(["camera","microphone","geolocation","bluetooth","usb","hid","serial","gpu"]);
const display=text=>{byId("status").textContent=text;};
byId("context").textContent=isSecureContext?
  "Secure browser context detected. Hardware availability still depends on your browser/device and permissions.":
  "Insecure context: use HTTPS (or localhost on this device) before testing hardware APIs.";
function classify(error){
  const code=error?.code;
  if(code==="UNSUPPORTED"||code==="INSECURE_CONTEXT")return "unsupported";
  if(code==="PERMISSION_DENIED")return "denied";
  if(code==="CANCELLED"||code==="NOT_FOUND")return "cancelled";
  return "error";
}
async function runTest(kind){
  if(!ALLOWED.has(kind))throw Error("Unsupported lab action");
  const started=performance.now();
  let status="pass",detail="none";
  try{
    if(kind==="gpu"){
      const adapter=typeof navigator.gpu?.requestAdapter==="function"
        ? await navigator.gpu.requestAdapter() : null;
      if(!adapter){
        status="unsupported";
        detail="No browser-accessible WebGPU adapter";
      }else{
        const values=Float32Array.from({length:65536},(_,i)=>(i%101)/4);
        const result=await engine.run(values,{prefer:"gpu",policy:"throughput"});
        if(result.backend!=="gpu")throw Error("GPU did not execute");
        detail="verified numeric shader output";
      }
    }else if(kind==="camera"||kind==="microphone"){
      const stream=await bridge.request(kind);
      // Never retain raw media data, even transiently.
      try{detail="stream granted; tracks stopped";}
      finally{stream.getTracks().forEach(track=>track.stop());}
    }else if(kind==="geolocation"){
      const position=await bridge.request(kind,{timeout:15000});
      // Deliberately discard latitude/longitude immediately.
      const accuracy=position.coords?.accuracy;
      detail=Number.isFinite(accuracy)?"accuracy band "+(
        accuracy<20?"<20m":accuracy<100?"20–99m":"100m+"):"position granted";
    }else{
      const options=kind==="bluetooth"?{acceptAllDevices:true}:{filters:[]};
      const result=await bridge.request(kind,options);
      // Do not retain device objects, IDs, addresses, manufacturer or model.
      void result;
      detail="browser chooser returned a selection";
    }
  }catch(error){
    status=classify(error);
    // GPU may be unavailable without throwing a typed WonderHardwareError.
    if(kind==="gpu"){
      status="error";
      detail="WebGPU adapter present but compute dispatch or numerical validation failed";
    }else{
      detail=error?.code??"unverified capability";
    }
  }
  const evidence={capability:kind,status,detail,elapsedBand:
    performance.now()-started<1000?"<1s":performance.now()-started<10000?"1–10s":">10s"};
  outcomes.push(evidence);
  display(JSON.stringify(evidence,null,2));
}
byId("tests").addEventListener("click",event=>{
  const button=event.target.closest("button[data-test]");
  if(!button||button.disabled)return;
  const kind=button.dataset.test;
  button.disabled=true;
  display("Requesting "+kind+" — browser permission/chooser may appear.");
  void runTest(kind).finally(()=>{button.disabled=false;});
});

const OFFLINE_PROOF_KEY="wonder-private-beta-offline-test";
const OFFLINE_PROOF_VALUE="wonder-synthetic-only";
async function withLabStorage(operation){
  const wonder=await createWonderLayer({dbName:"wonder-device-lab-synthetic-v1"});
  try{return await operation(wonder.store);}finally{wonder.close();}
}
byId("save-synthetic").addEventListener("click",async()=>{
  const button=byId("save-synthetic");
  button.disabled=true;
  try{
    await withLabStorage(store=>store.save(OFFLINE_PROOF_KEY,OFFLINE_PROOF_VALUE));
    byId("offline-status").textContent="Saved synthetic value locally. Disconnect from the internet, reload, then click Read.";
  }catch{
    byId("offline-status").textContent="Synthetic local save failed; do not mark offline testing passed.";
  }finally{button.disabled=false;}
});
byId("read-synthetic").addEventListener("click",async()=>{
  const button=byId("read-synthetic");
  button.disabled=true;
  try{
    const records=await withLabStorage(store=>store.listRecords());
    const found=records.find(record=>record.id===OFFLINE_PROOF_KEY ||
        record.record_id===OFFLINE_PROOF_KEY);
    byId("offline-status").textContent=found?.content===OFFLINE_PROOF_VALUE?
       "PASS: synthetic value recovered from local IndexedDB. Verify this page was offline when tested.":
       "FAIL: synthetic value not found locally.";
  }catch{
    byId("offline-status").textContent="FAIL: unable to read synthetic local value.";
  }finally{button.disabled=false;}
});
// Auto-registering a Service Worker never requests hardware permissions.
// An isolated scope prevents interference with the existing basic-PWA demo.
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(()=>{
    byId("offline-status").textContent="Offline cache registration failed; HTTPS/localhost is required.";
  });
}

// Phase 8D records manual observations only. A browser API cannot attest real
// physical-device provenance or prove offline status merely from navigator.onLine.
let serviceWorkerObservation="not-tested";
byId("check-sw-control").addEventListener("click",()=>{
  serviceWorkerObservation=!("serviceWorker" in navigator)?"unsupported":
    navigator.serviceWorker.controller?"observed-pass":"observed-fail";
  byId("sw-control-status").textContent=serviceWorkerObservation==="observed-pass"?
    "SW controller observed by this page. This does not prove an offline restart.":
    "SW control: "+serviceWorkerObservation+". If installed, reload the page while online and retry.";
});
function manualOfflineChecks(){
  return {
    networkDisconnection:byId("network-offline-confirmed").checked?
      "manually-confirmed":"not-confirmed",
    serviceWorkerControl:serviceWorkerObservation,
    offlineReload:byId("offline-reload-result").value,
    coldRestart:byId("cold-restart-result").value
  };
}
function validateManualOfflineChecks(checks){
  const passing=step=>checks[step]==="observed-pass";
  if((passing("offlineReload")||passing("coldRestart"))&&
     checks.networkDisconnection!=="manually-confirmed")
    throw Error("Confirm offline networking was manually disconnected before reporting an offline pass.");
  if(passing("offlineReload")&&!passing("serviceWorkerControl"))
    throw Error("Check Service Worker control before marking offline reload passed.");
  if(passing("coldRestart")&&!passing("offlineReload"))
    throw Error("A cold-restart pass requires a successful offline-reload observation first.");
}

byId("download").addEventListener("click",()=>{
  if(byId("os").value==="unspecified"||byId("browser").value==="unspecified"||!isSecureContext){
    display("Select OS/browser and use HTTPS or localhost before exporting evidence.");
    return;
  }
  const offlineChecks=manualOfflineChecks();
  try{validateManualOfflineChecks(offlineChecks);}catch(error){display(error.message);return;}
  const report={
    format:"ryzova-device-acceptance-v2",
    operatingSystem:byId("os").value,
    browser:byId("browser").value,
    browserVersion:byId("version").value.replace(/[^a-zA-Z0-9. -]/g,"").slice(0,24),
    secureContext:isSecureContext,
    measuredAtUtc:new Date().toISOString(),
    noRawDeviceMediaOrCoordinates:true,
    results:outcomes,
    offlineChecks
  };
  const blob=new Blob([JSON.stringify(report,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;anchor.download="wonder-device-acceptance.json";
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
byId("clear").addEventListener("click",()=>{
  outcomes.length=0;
  serviceWorkerObservation="not-tested";
  byId("sw-control-status").textContent="SW control not checked.";
  byId("network-offline-confirmed").checked=false;
  byId("offline-reload-result").value="not-tested";
  byId("cold-restart-result").value="not-tested";
  display("In-memory evidence and manual offline observations cleared. No remote upload was used.");
});

