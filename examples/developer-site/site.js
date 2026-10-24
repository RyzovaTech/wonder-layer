import {createAdaptiveEngine,createWonderLayer,inspectCapabilities} from "../../src/wonder.js";

const byId=id=>document.getElementById(id);
const status=byId("playground-output");
const capabilities=byId("capability-grid");
const claimStatus=byId("capability-status");
const SYNTHETIC_ID="wonder-phase8c-synthetic";
const SYNTHETIC_VALUE="wonder-demo-value-only";
const DB_NAME="wonder-phase8c-developer-site-v1";
const capabilitiesPath="../../docs/product/phase8a-capabilities.json";

function describeCapability(capability,index){
  const article=document.createElement("article");
  article.className="capability";
  const top=document.createElement("div");
  top.className="capability-top";
  const number=document.createElement("span");
  number.className="capability-index";
  number.textContent=String(index+1).padStart(2,"0");
  const proof=document.createElement("span");
  proof.className="capability-proof";
  proof.textContent=capability.hostedAutomatedEvidence==="yes"?"Hosted CI":capability.hostedAutomatedEvidence==="partial"?"Partial CI":"Unverified";
  top.append(number,proof);
  const title=document.createElement("h3");
  title.textContent=capability.id.split("-").map(part=>part[0].toUpperCase()+part.slice(1)).join(" ");
  const description=document.createElement("p");
  description.textContent=capability.scope;
  const caveat=document.createElement("p");
  caveat.className="capability-caveat";
  caveat.textContent="Physical mobile: "+capability.physicalDeviceEvidence;
  article.append(top,title,description,caveat);
  return article;
}

async function loadCapabilityManifest(){
  try{
    const response=await fetch(capabilitiesPath,{cache:"no-store",credentials:"same-origin"});
    if(!response.ok)throw Error("Manifest unavailable: HTTP "+response.status);
    const manifest=await response.json();
    if(manifest.schemaVersion!==1 || !Array.isArray(manifest.capabilities) ||
       manifest.capabilities.length!==8 || manifest.distribution?.publicNpmApproved!==false)
      throw Error("Product claim contract is not a verified engineering preview");
    for(const entry of manifest.capabilities){
      if(typeof entry.id!=="string" || typeof entry.scope!=="string" ||
         !["yes","partial","no"].includes(entry.hostedAutomatedEvidence) ||
         entry.physicalDeviceEvidence!=="not-verified")
        throw Error("Malformed or unsupported capability claim");
    }
    capabilities.replaceChildren(...manifest.capabilities.map(describeCapability));
    claimStatus.textContent="8 implemented client-facing capability areas · Hosted CI evidence varies · Physical mobile not verified.";
    claimStatus.dataset.status="ready";
  }catch{
    claimStatus.textContent="Capability evidence could not be loaded. Check the repository contract before relying on claims.";
    claimStatus.dataset.status="error";
  }
}

const snippets={
  vanilla:[
    'import {createWonderLayer} from "@ryzova/wonder-layer";',
    '',
    '// Browser-only; install an authorized local SDK tarball first.',
    'const wonder = await createWonderLayer({dbName:"my-pwa"});',
    'try {',
    '  await wonder.store.save("draft", "Local-only text");',
    '  const saved = await wonder.store.listRecords();',
    '  console.log(saved);',
    '  const result = await wonder.compute(new Float32Array([1,2,3]));',
    '  console.log(result.backend, result.data);',
    '} finally {',
    '  wonder.close();',
    '}'
  ].join("\n"),
  react:[
    'import * as React from "react";',
    'import {createReactWonderBindings} from "@ryzova/wonder-layer/react";',
    '',
    'const {WonderProvider,useWonderLayer} = createReactWonderBindings(React);',
    'function NoteButton() {',
    '  const {status,layer} = useWonderLayer();',
    '  return <button disabled={status !== "ready"}',
    '    onClick={() => layer.store.save("draft", "Local-only text")}>',
    '    Save locally',
    '  </button>;',
    '}',
    'export default function App() {',
    '  return <WonderProvider options={{dbName:"my-pwa"}}>',
    '    <NoteButton />',
    '  </WonderProvider>;',
    '}'
  ].join("\n"),
  vue:[
    'import * as Vue from "vue";',
    'import {createVueWonderBindings} from "@ryzova/wonder-layer/vue";',
    '',
    'const {createWonderPlugin,useWonderLayer} = createVueWonderBindings(Vue);',
    'const plugin = createWonderPlugin({dbName:"my-pwa"});',
    'const app = Vue.createApp(MyApp);',
    'app.use(plugin);',
    'app.mount("#app");',
    '',
    '// In component setup():',
    '// const {state} = useWonderLayer();',
    '// state.status becomes "ready" after browser initialization.',
    '// On app teardown: plugin.dispose();'
  ].join("\n")
};
let activeSnippet="vanilla";
const snippetCode=byId("snippet-code");
function chooseSnippet(name){
  if(!Object.hasOwn(snippets,name))return;
  activeSnippet=name;
  snippetCode.textContent=snippets[name];
  for(const button of document.querySelectorAll("button[data-snippet]"))
    button.setAttribute("aria-pressed",String(button.dataset.snippet===name));
  byId("copy-status").textContent="Run in a browser after hydration; no registry publication has been approved.";
}
for(const button of document.querySelectorAll("button[data-snippet]"))
  button.addEventListener("click",()=>chooseSnippet(button.dataset.snippet));

byId("copy-snippet").addEventListener("click",async()=>{
  try{
    if(!navigator.clipboard?.writeText)throw Error("Clipboard not supported");
    await navigator.clipboard.writeText(snippets[activeSnippet]);
    byId("copy-status").textContent="Code copied. Install the authorized local tarball before importing.";
  }catch{
    byId("copy-status").textContent="Clipboard unavailable; select and copy the visible code manually.";
  }
});

function output(value){
  status.textContent=JSON.stringify(value,null,2);
}
function errorCategory(error){
  const message=String(error?.message??error??"unknown error");
  if(/IndexedDB unavailable|secure|unsupported|unavailable/i.test(message))return "unsupported";
  return "failed";
}
async function withSyntheticStore(task){
  const layer=await createWonderLayer({dbName:DB_NAME});
  try{return await task(layer.store);}finally{layer.close();}
}
const actions={
  async inspect(){
    const report=await inspectCapabilities();
    return {
      action:"capability-inspection",checkedAt:report.checkedAt,
      availability:report.available,
      note:"Availability is not permission or physical hardware certification. No device permission was requested."
    };
  },
  async compute(){
    const engine=createAdaptiveEngine();
    const input=new Float32Array([0,1,2,3]);
    const result=await engine.run(input,{prefer:"auto"});
    return {
      action:"adaptive-compute",backend:result.backend,
      input:[...input],output:[...result.data],attempted:result.attempted,
      numericalExampleOnly:true,performanceBenchmark:false
    };
  },
  async save(){
    await withSyntheticStore(store=>store.save(SYNTHETIC_ID,SYNTHETIC_VALUE));
    return {
      action:"local-save",state:"saved",value:SYNTHETIC_VALUE,
      location:"Origin-scoped IndexedDB, no sync call",recoveryGuarantee:false
    };
  },
  async read(){
    const entries=await withSyntheticStore(store=>store.listRecords());
    const found=entries.find(item=>item.id===SYNTHETIC_ID);
    return {
      action:"local-reopen",state:found?.content===SYNTHETIC_VALUE?"verified":"not-found",
      value:found?.content===SYNTHETIC_VALUE?SYNTHETIC_VALUE:null,
      note:"This is a local reload/read check, not physical-device offline certification."
    };
  }
};
for(const button of document.querySelectorAll("button[data-action]")){
  button.addEventListener("click",async()=>{
    if(button.disabled)return;
    const action=button.dataset.action;
    if(!Object.hasOwn(actions,action))return;
    button.disabled=true;
    status.textContent="Running "+action+" on this browser…";
    try{
      const result=await actions[action]();
      output(result);
    }catch(error){
      output({action,state:errorCategory(error),reason:String(error?.message??error).slice(0,180),
        note:"No capability was claimed successful. No external upload attempted."});
    }finally{
      button.disabled=false;
    }
  });
}
chooseSnippet("vanilla");
void loadCapabilityManifest();
