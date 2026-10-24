/**
 * Emits an internal-only manifest of real packaged SDK build files.
 * No archive is uploaded, no registry publishing, and no security approval inferred.
 */
import {createHash} from "node:crypto";
import {readFile, readdir, mkdir, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const mandatory=["wonder.js","client.js","react.js","vue.js","compute.wasm",
  "compute-worker.js","index.d.ts","client.d.ts","react.d.ts","vue.d.ts"];
export function createBetaManifest(pkg,assets,{commit=null}={}){
  if(pkg?.private!==true||typeof pkg.version!=="string"||
     !pkg.version.startsWith("0.0.0-poc."))
    throw new Error("Private prerelease package invariant violated");
  if(!Array.isArray(assets)||!mandatory.every(name=>assets.some(x=>x.path===name)))
    throw new Error("Incomplete SDK asset manifest");
  const result={
    format:"ryzova-wonder-internal-beta-candidate-v1",
    package:pkg.name,
    version:pkg.version,
    gitCommit:typeof commit==="string"&&/^[a-f0-9]{40}$/.test(commit)?commit:null,
    distribution:"local-build-only",
    registryPublished:false,
    publicReleaseApproved:false,
    physicalDeviceCertification:false,
    independentHumanSecurityReviewApproved:false,
    candidateStatus:"ENGINEERING_BUILD_ONLY_NOT_RELEASE_APPROVED",
    assets:assets.map(x=>({path:x.path,bytes:x.bytes,sha256:x.sha256}))
  };
  return Object.freeze(result);
}
export async function generateBetaCandidate({projectRoot=root,commit=process.env.GITHUB_SHA}={}){
  const pkg=JSON.parse(await readFile(resolve(projectRoot,"package.json"),"utf8"));
  const dist=resolve(projectRoot,"dist");
  const names=(await readdir(dist)).filter(name=>/^[a-zA-Z0-9._-]+$/.test(name)).sort();
  const assets=await Promise.all(names.map(async path=>{
    const bytes=await readFile(resolve(dist,path));
    return {path,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
  }));
  return createBetaManifest(pkg,assets,{commit});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const manifest=await generateBetaCandidate();
    await mkdir(resolve(root,"results"),{recursive:true});
    const dest=resolve(root,"results/private-beta-build-manifest.json");
    await writeFile(dest,JSON.stringify(manifest,null,2)+"\n");
    console.log("Private beta manifest written:",dest);
    console.log("Release status:",manifest.candidateStatus,"assets:",manifest.assets.length);
  }catch(error){console.error("Private beta manifest blocked:",error.message);process.exitCode=1;}
}

