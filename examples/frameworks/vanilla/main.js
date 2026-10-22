import {createWonderClient} from "@ryzova/wonder-layer/client";

const client=createWonderClient({dbName:"wonder-vanilla-example"});
const status=document.querySelector("#status");
const button=document.querySelector("#save");
const editor=document.querySelector("#note");

const unsubscribe=client.subscribe(({status:phase,error})=>{
  status.textContent=error?String(error.message??error):phase;
  button.disabled=phase!=="ready";
});
button.addEventListener("click",async()=>{
  const layer=client.layer;
  if(!layer)return;
  await layer.store.save("note",editor.value);
  status.textContent="Saved locally; upload is disabled by default.";
});
client.start().then(async layer=>{
  const record=(await layer.store.listRecords()).find(r=>r.id==="note");
  if(record)editor.value=record.content;
}).catch(error=>{status.textContent=error.message;});
window.addEventListener("pagehide",()=>{
  unsubscribe();
  client.dispose();
},{once:true});

