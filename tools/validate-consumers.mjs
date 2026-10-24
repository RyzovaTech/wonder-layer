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
import {createServer} from "node:http";
import {createRequire} from "node:module";

const root=fileURLToPath(new URL("../",import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),"wonder-consumer-"));
const result={schema:"ryzova-phase6-consumers-v1",dateUtc:new Date().toISOString(),
  sdkPackage:"local npm tarball",projects:[],strictTypes:"unverified",browserRuntime:[]};
function command(file,args,cwd,{timeoutMs=4*60*1000,streamOutput=false}={}){
  console.log("> "+file+" "+args.join(" "));
  return execFileSync(file,args,{cwd,encoding:"utf8",
    stdio:["ignore",streamOutput?"inherit":"pipe","inherit"],
    timeout:timeoutMs,env:{...process.env,CI:"true"}});
}
try{
  command("npm",["run","build"],root);
  const stdout=command("npm",["pack","--ignore-scripts","--json","--pack-destination",tmp],root);
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
    "@types/react@^19.0.0","@types/react-dom@^19.0.0","vue@^3.5.0","@vitejs/plugin-vue@^6.0.0","playwright@^1.56.0"],project);

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
  // Test actual built consumer applications inside a real browser, not only Vite output.
  // Downloading three browser engines and apt dependencies can exceed the
  // default 4-minute command timeout even on a healthy GitHub runner.
  // Keep short timeouts for builds, but allocate bounded time for browser setup
  // and stream installation diagnostics rather than hiding stdout.
  command(join(project,"node_modules",".bin","playwright"),
    process.platform==="linux"?
      ["install","--with-deps","chromium","firefox","webkit"]:
      ["install","chromium","firefox","webkit"],
    project,{timeoutMs:15*60*1000,streamOutput:true});
  const localRequire=createRequire(join(project,"package.json"));
  const {chromium,firefox,webkit}=localRequire("playwright");
  for(const [browserName,browserType] of Object.entries({chromium,firefox,webkit})){
    const browser=await browserType.launch({headless:true});
    try{
      for(const kind of ["vanilla","react","vue"]){
      const publicRoot=join(project,"built-"+kind);
      const server=createServer(async(req,res)=>{
        try{
          const pathname=decodeURIComponent(new URL(req.url??"/","http://localhost").pathname);
          const name=pathname==="/"?"/index.html":pathname;
          const absolute=resolve(publicRoot,"."+name);
          if(!absolute.startsWith(publicRoot+"/") && absolute!==join(publicRoot,"index.html")){
            res.writeHead(403);res.end("Forbidden");return;
          }
          const bytes=await readFile(absolute);
          const ext=absolute.split(".").at(-1);
          const mime=ext==="html"?"text/html":ext==="js"?"application/javascript":
            ext==="css"?"text/css":ext==="wasm"?"application/wasm":"application/octet-stream";
          res.writeHead(200,{"Content-Type":mime});res.end(bytes);
        }catch{res.writeHead(404);res.end("Not found");}
      });
      await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
      const context=await browser.newContext(),page=await context.newPage();
      const errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      const url="http://127.0.0.1:"+server.address().port+"/";
      try{
        const response=await page.goto(url,{waitUntil:"load",timeout:25000});
        if(!response?.ok())throw Error(kind+" consumer failed to load: "+response?.status());
        if(kind==="vanilla"){
          await page.locator("#save").waitFor({state:"visible"});
          await page.waitForFunction(()=>!document.querySelector("#save").disabled,{timeout:20000});
          await page.locator("#note").fill("wonder-"+kind+"-persisted");
          await page.locator("#save").click();
        }else{
          await page.waitForFunction(()=>document.body.textContent.includes("ready"),{timeout:20000});
          await page.locator("textarea").fill("wonder-"+kind+"-persisted");
          await page.locator("button").first().click();
        }
        await page.waitForTimeout(100);
        await page.reload({waitUntil:"load"});
        if(kind==="vanilla")await page.waitForFunction(()=>document.querySelector("#note")?.value==="wonder-vanilla-persisted",{timeout:20000});
        else await page.waitForFunction((name)=>document.querySelector("textarea")?.value===("wonder-"+name+"-persisted"),kind,{timeout:20000});
        if(errors.length)throw Error(kind+" runtime page errors: "+errors.join("; "));
        result.browserRuntime.push({browser:browserName,framework:kind,status:"pass",reloadPersistence:true,
          userAgent:await page.evaluate(()=>navigator.userAgent)});
      }finally{
        await context.close();
        await new Promise(resolve=>server.close(resolve));
      }
    }
    }finally{await browser.close();}
  }
  if(result.browserRuntime.length!==9)throw Error("Expected nine cross-browser consumer runtime validations");
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

