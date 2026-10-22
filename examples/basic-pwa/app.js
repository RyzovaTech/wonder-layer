import {createWonderLayer,createPWALifecycle} from "../../src/wonder.js";

const $=id=>document.getElementById(id);
let layer=null;
const pwa=createPWALifecycle({onState:state=>{
  status("pwa-status",JSON.stringify(state));
  if(state.state==="install-available")$("install").hidden=false;
}});
function status(id,msg){$(id).textContent=String(msg);}
function net(){
  $("net").textContent=navigator.onLine?"● Browser reports online":"○ Browser reports offline";
  $("net").dataset.online=navigator.onLine?"yes":"no";
}
window.addEventListener("online",net);window.addEventListener("offline",net);net();
$("install").addEventListener("click",async()=>{
  try{
    const outcome=await pwa.requestInstall();
    $("install").hidden=!outcome.available;
  }catch(error){status("pwa-status","Install request: "+error.message);}
});
async function init(){
  if("serviceWorker" in navigator){
    try{await pwa.register("./sw.js",{scope:"./"});}
    catch(error){status("storage-status","Service worker unavailable: "+error.message);}
  }
  layer=await createWonderLayer({dbName:"wonder-existing-pwa-example"});
  const record=(await layer.store.listRecords()).find(record=>record.id==="local-note");
  if(record)$("note").value=record.content;
  status("storage-status","Ready. Local records: "+(await layer.store.listRecords()).length);
}
$("save").addEventListener("click",async()=>{
  if(!layer)return status("storage-status","Storage is not available.");
  try{
    await layer.store.save("local-note",$("note").value);
    status("storage-status","Saved on this device. Pending sync operations: "+(await layer.store.pending()).length+".");
  }catch(error){status("storage-status","Save failed: "+error.message);}
});
$("load").addEventListener("click",async()=>{
  if(!layer)return;
  try{
    const r=(await layer.store.listRecords()).find(x=>x.id==="local-note");
    $("note").value=r?.content??"";
    status("storage-status",r?"Loaded from local database.":"No local note yet.");
  }catch(error){status("storage-status","Load failed: "+error.message);}
});
$("export").addEventListener("click",async()=>{
  if(!layer)return;
  try{
    const data=await layer.backup();
    const url=URL.createObjectURL(new Blob([data],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="wonder-backup.json";a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),5000);
    status("storage-status","Backup exported. Keep it safe.");
  }catch(error){status("storage-status","Backup failed: "+error.message);}
});
$("import").addEventListener("change",async()=>{
  const file=$("import").files?.[0];if(!file || !layer)return;
  try{
    if(file.size>12_000_000)throw new Error("Backup too large");
    const result=await layer.restore(await file.text());
    status("storage-status",JSON.stringify(result)+" · Existing IDs are not overwritten.");
  }catch(error){status("storage-status","Import rejected: "+error.message);}
  $("import").value="";
});
$("compute").addEventListener("click",async()=>{
  if(!layer)return status("compute-status","SDK unavailable");
  const count=Number($("count").value);
  const input=Float32Array.from({length:count},(_,i)=>(i%101)/4);
  status("compute-status","Computing "+count+" elements…");
  const start=performance.now();
  try{
    const result=await layer.compute(input,{policy:$("policy").value});
    status("compute-status",JSON.stringify({
      backend:result.backend,policy:$("policy").value,elapsedMs:Number((performance.now()-start).toFixed(2)),
      attempted:result.attempted,stats:layer.scheduler.stats(),
      firstValues:Array.from(result.data.slice(0,5)),failedAttempts:result.failures
    },null,2));
  }catch(error){status("compute-status","Compute failed: "+error.message);}
});
$("inspect").addEventListener("click",async()=>{
  if(!layer)return status("compute-status","SDK unavailable");
  try{status("compute-status",JSON.stringify(await layer.inspect(),null,2));}
  catch(error){status("compute-status","Inspection error: "+error.message);}
});
init().catch(error=>{
  status("storage-status","Initialization failed: "+error.message);
  status("compute-status","SDK initialization failed: "+error.message);
});


$("calibrate").addEventListener("click",async()=>{
  if(!layer)return status("compute-status","SDK unavailable");
  const input=Float32Array.from({length:Number($("count").value)},(_,i)=>(i%101)/4);
  status("compute-status","Benchmarking eligible backends on this device…");
  try{
    const result=await layer.scheduler.calibrate(input,{samples:2,policy:"throughput"});
    status("compute-status",JSON.stringify({
      calibration:result, nextPlan:layer.scheduler.plan(input.length,{policy:"throughput"}),
      stats:layer.scheduler.stats()
    },null,2));
  }catch(error){status("compute-status","Calibration failed: "+error.message);}
});
$("hardware-inspect").addEventListener("click",()=>{
  if(!layer)return status("hardware-status","SDK not initialized");
  status("hardware-status",JSON.stringify(layer.hardware.capabilities(),null,2));
});
$("camera-test").addEventListener("click",async()=>{
  if(!layer)return status("hardware-status","SDK not initialized");
  status("hardware-status","Camera permission may be requested by your browser.");
  try{
    const stream=await layer.hardware.request("camera",{video:true,audio:false});
    const count=stream.getTracks().length;
    // This proof-of-concept never stores or transmits any camera frames.
    stream.getTracks().forEach(track=>track.stop());
    status("hardware-status","Camera access successful; "+count+" track(s) stopped immediately.");
  }catch(error){status("hardware-status",error.code?error.code+": "+error.message:error.message);}
});
$("geo-test").addEventListener("click",async()=>{
  if(!layer)return status("hardware-status","SDK not initialized");
  status("hardware-status","Location permission may be requested by your browser.");
  try{
    const position=await layer.hardware.request("geolocation",{timeout:8000});
    // Do not display, log, transmit or store latitude/longitude in this demo.
    status("hardware-status","Location obtained; reported accuracy: "+Math.round(position.coords.accuracy)+" meters. No coordinates retained.");
  }catch(error){status("hardware-status",error.code?error.code+": "+error.message:error.message);}
});

$("storage-check").addEventListener("click",async()=>{
  if(!layer)return;
  try{status("storage-status",JSON.stringify(await layer.recovery.storageStatus()));}
  catch(error){status("storage-status","Storage inspection failed: "+error.message);}
});
$("storage-persist").addEventListener("click",async()=>{
  if(!layer)return;
  try{
    const result=await layer.recovery.requestPersistence();
    status("storage-status",JSON.stringify(result)+" · Grant does not prevent user-clearing.");
  }catch(error){status("storage-status","Persistence request failed: "+error.message);}
});
$("check-update").addEventListener("click",async()=>{
  try{
    const info=await pwa.checkForUpdate();
    status("pwa-status",JSON.stringify(info));
  }catch(error){status("pwa-status","Update check failed: "+error.message);}
});
$("apply-update").addEventListener("click",()=>{
  // The host app must preserve its edits before activating a new version.
  status("pwa-status",pwa.activateWaiting()?
    "Update activation requested. Existing tabs may need reload.":"No waiting service worker.");
});
