import {createWonderLayer} from "../../src/wonder.js";

const $=id=>document.getElementById(id);
let layer=null,deferredInstall=null;
function status(id,msg){$(id).textContent=String(msg);}
function net(){
  $("net").textContent=navigator.onLine?"● Browser reports online":"○ Browser reports offline";
  $("net").dataset.online=navigator.onLine?"yes":"no";
}
window.addEventListener("online",net);window.addEventListener("offline",net);net();
window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();deferredInstall=event;$("install").hidden=false;
});
$("install").addEventListener("click",async()=>{
  if(!deferredInstall)return;
  const prompt=deferredInstall;deferredInstall=null;$("install").hidden=true;
  try{await prompt.prompt();await prompt.userChoice;}
  catch(error){status("storage-status","Installation: "+error.message);}
});
async function init(){
  if("serviceWorker" in navigator){
    try{await navigator.serviceWorker.register("./sw.js",{scope:"./"});}
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
    const result=await layer.compute(input);
    status("compute-status",JSON.stringify({
      backend:result.backend,elapsedMs:Number((performance.now()-start).toFixed(2)),
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

