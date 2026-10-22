/**
 * Phase 6 integration: install the actual npm-packed SDK into an external
 * temporary consumer project, strict-typecheck it, and produce 3 Vite bundles.
 * Nothing is published to a registry. Do not equate builds with device tests.
 */
import {mkdtemp,cp,mkdir,writeFile,readFile,readdir,rm} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),"wonder-consumer-"));
const result={schema:"ryzova-phase6-consumers-v1",dateUtc:new Date().toISOString(),
  sdkPackage:"local npm tarball",projects:[],strictTypes:"unverified"};
function command(file,args,cwd){
  console.log("> "+file+" "+args.join(" "));
  return execFileSync(file,args,{cwd,encoding:"utf8",stdio:["ignore","pipe","inherit"],
    timeout:4*60*1000,env:{...process.env,CI:"true"}});
}
try{
  command("npm",["run","build"],root);
  const stdout=command("npm",["pack","--json","--pack-destination",tmp],root);
  const pack=JSON.parse(stdout)[0];
  const tarball=join(tmp,pack.filename);
  result.tarball=pack.filename;
  result.sizeBytes=pack.size;
  const project=join(tmp,"consumer");
  await mkdir(project);
  await writeFile(join(project,"package.json"),JSON.stringify({
    name:"wonder-external-consumer",version:"0.0.0",private:true,type:"module",
    scripts:{}
  },null,2)+"\n");
  command("npm",["install","--no-audit","--no-fund","--save-exact",tarball,
    "vite@^7.0.0","typescript@^5.9.0","react@^19.0.0","react-dom@^19.0.0",
    "@types/react@^19.0.0","@types/react-dom@^19.0.0","vue@^3.5.0","@vitejs/plugin-vue@^6.0.0"],project);

  const frameworkRoot=resolve(root,"examples/frameworks");
  for(const kind of ["vanilla","react","vue"]){
    const dest=join(project,kind);await mkdir(dest);
    const from=join(frameworkRoot,kind);
    for(const file of await readdir(from)){
      await cp(join(from,file),join(dest,file));
    }
    if(kind==="react"){
      await writeFile(join(dest,"index.html"),
        '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/main.jsx"></script></body></html>');
      await writeFile(join(dest,"main.jsx"),`import * as React from "react";
import {createRoot} from "react-dom/client";
import App from "./App.jsx";
createRoot(document.getElementById("root")).render(React.createElement(App));
`);
    }
    if(kind==="vue"){
      await writeFile(join(dest,"index.html"),
        '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
      await writeFile(join(dest,"vite.config.mjs"),`import {defineConfig} from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({plugins:[vue()]});
`);
    }
    command(join(project,"node_modules",".bin","vite"),["build",dest,"--outDir",join(project,"built-"+kind),"--emptyOutDir"],project);
    const output=await readdir(join(project,"built-"+kind));
    if(!output.includes("index.html")||!output.includes("assets"))throw Error(kind+" Vite bundle missing expected assets");
    result.projects.push({framework:kind,status:"built",files:output.length});
  }

  await writeFile(join(project,"consumer.ts"),`import {createWonderLayer, type ComputeBackend, type WonderLayer} from "@ryzova/wonder-layer";
import {createWonderClient} from "@ryzova/wonder-layer/client";
import {createReactWonderBindings} from "@ryzova/wonder-layer/react";
import {createVueWonderBindings} from "@ryzova/wonder-layer/vue";
const client = createWonderClient({dbName:"typed-pwa"});
const validBackend: ComputeBackend = "wasm";
// @ts-expect-error invalid compute backend must fail TypeScript
const invalidBackend: ComputeBackend = "native";
void invalidBackend;
async function demo(): Promise<void> {
  const wonder: WonderLayer = await createWonderLayer({dbName:"typed-pwa"});
  const result = await wonder.compute(new Float32Array([1,2]), {policy:"responsive"});
  const backend: ComputeBackend = result.backend;
  await wonder.store.save("draft",backend);
  wonder.close();
}
void demo;
void client;void createReactWonderBindings;void createVueWonderBindings;
`);
  await writeFile(join(project,"tsconfig.json"),JSON.stringify({
    compilerOptions:{
      target:"ES2022",module:"ESNext",moduleResolution:"Bundler",
      strict:true,noEmit:true,skipLibCheck:false,
      types:[],lib:["DOM","ES2022"]
    },files:["consumer.ts"]
  },null,2));
  command(join(project,"node_modules",".bin","tsc"),["--project","tsconfig.json"],project);
  result.strictTypes="pass";
  result.status="pass";
  console.log("Phase 6 external tarball consumer checks:",JSON.stringify(result,null,2));
}catch(error){
  result.status="fail";result.error=String(error?.message??error);
  console.error("Phase 6 consumer validation failed:",result.error);
  process.exitCode=1;
}finally{
  await mkdir(resolve(root,"results"),{recursive:true});
  await writeFile(resolve(root,"results/phase6-consumers.json"),JSON.stringify(result,null,2)+"\n");
  await rm(tmp,{recursive:true,force:true});
}

