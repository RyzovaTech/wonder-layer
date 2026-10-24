/**
 * Phase 8B developer-distribution budget for the copied SDK assets.
 * This is NOT a minified/gzipped consumer bundle or a measured browser payload.
 * Keeping explicit source asset measurements prevents unreviewed growth while
 * retaining the required Worker and WebAssembly modules.
 */
import {readdir,stat,readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
export const SDK_SIZE_LIMITS=Object.freeze({
  maxTotalBytes:512*1024,
  maxSingleJavaScriptBytes:96*1024
});
export const SDK_REQUIRED_ASSETS=Object.freeze([
  "wonder.js","client.js","react.js","vue.js",
  "compute-worker.js","compute.wasm",
  "index.d.ts","client.d.ts","react.d.ts","vue.d.ts"
]);

export function summarizeSdkAssets(assets,{limits=SDK_SIZE_LIMITS}={}){
  if(!Array.isArray(assets)||!assets.length)throw new TypeError("Expected SDK distribution assets");
  const seen=new Set();
  const items=[];
  let totalBytes=0,javaScriptBytes=0,wasmBytes=0,declarationBytes=0;
  const problems=[];
  for(const asset of assets){
    if(typeof asset?.path!=="string"||!(/^[A-Za-z0-9._-]+$/.test(asset.path))||
       asset.path==="."||asset.path===".."||
       !Number.isSafeInteger(asset.bytes)||asset.bytes<0)
      throw new TypeError("Invalid SDK distribution asset path or byte size");
    if(seen.has(asset.path))throw new Error("Duplicate SDK distribution asset "+asset.path);
    seen.add(asset.path);
    items.push({path:asset.path,bytes:asset.bytes});
    totalBytes+=asset.bytes;
    if(asset.path.endsWith(".d.ts"))declarationBytes+=asset.bytes;
    else if(asset.path.endsWith(".js")){
      javaScriptBytes+=asset.bytes;
      if(asset.bytes>limits.maxSingleJavaScriptBytes)
        problems.push("Oversized JS asset: "+asset.path);
    }else if(asset.path.endsWith(".wasm"))wasmBytes+=asset.bytes;
  }
  for(const required of SDK_REQUIRED_ASSETS)
    if(!seen.has(required))problems.push("Missing required SDK asset: "+required);
  if(totalBytes>limits.maxTotalBytes)
    problems.push("SDK distribution exceeds uncompressed budget");
  return {
    schema:"wonder-phase8b-sdk-size-v1",
    status:problems.length?"FAIL":"PASS_INTERNAL_BUDGET",
    measurement:"uncompressed-dist-file-bytes-not-consumer-bundle",
    totalBytes,javaScriptBytes,wasmBytes,declarationBytes,
    limits:{...limits},assets:items.sort((a,b)=>a.path.localeCompare(b.path)),
    problems,
    publicReleaseApproved:false
  };
}
export async function inspectSdkDistribution({projectRoot=root,limits=SDK_SIZE_LIMITS}={}){
  const pkg=JSON.parse(await readFile(resolve(projectRoot,"package.json"),"utf8"));
  if(pkg.private!==true)throw new Error("SDK is not approved for public package distribution");
  const dist=resolve(projectRoot,"dist");
  const entries=await readdir(dist,{withFileTypes:true});
  if(entries.some(x=>!x.isFile()))throw new Error("SDK dist must not contain nested directories or symlinks");
  const assets=await Promise.all(entries.map(async entry=>({
    path:entry.name,bytes:(await stat(resolve(dist,entry.name))).size
  })));
  return summarizeSdkAssets(assets,{limits});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const report=await inspectSdkDistribution();
    console.log(JSON.stringify(report,null,2));
    if(report.problems.length)process.exitCode=1;
  }catch(error){
    console.error("SDK size check blocked:",error.message);
    process.exitCode=1;
  }
}
