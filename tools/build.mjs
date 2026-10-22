import {cp,mkdir,readdir,rm,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const src=resolve(root,"src"),types=resolve(root,"types"),dist=resolve(root,"dist");
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
const included=[];
for(const entry of await readdir(src,{withFileTypes:true})){
  if(!entry.isFile()||!(/\.(?:js|wasm)$/.test(entry.name)))continue;
  await cp(resolve(src,entry.name),resolve(dist,entry.name));
  included.push(entry.name);
}
for(const entry of await readdir(types,{withFileTypes:true})){
  if(!entry.isFile()||!entry.name.endsWith(".d.ts"))continue;
  await cp(resolve(types,entry.name),resolve(dist,entry.name));
  included.push(entry.name);
}
for(const file of ["wonder.js","client.js","react.js","vue.js","compute.js","compute-worker.js","compute.wasm","index.d.ts","client.d.ts","react.d.ts","vue.d.ts"]){
  if(!included.includes(file))throw new Error("Missing distribution asset: "+file);
}
await writeFile(resolve(dist,"BUILD-MANIFEST.json"),JSON.stringify({
  format:"ryzova-wonder-sdk-build-v1",entries:included.sort()
},null,2)+"\n");
console.log("Wonder Layer SDK distribution built:",included.length,"assets");

