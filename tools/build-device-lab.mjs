/**
 * Export a strict static HTTPS device-lab bundle for protected preview testing.
 * Only committed PWA assets, browser SDK JS/WASM, and the two sample icons.
 * No environment variables, private files, reports or npm tarballs are copied.
 */
import {cp,mkdir,rm,readdir,stat} from "node:fs/promises";
import {resolve,relative,isAbsolute,sep} from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const target=resolve(root,"public");
const inputs=[
  "examples/device-lab/index.html",
  "examples/device-lab/lab.js",
  "examples/device-lab/styles.css",
  "examples/device-lab/sw.js",
  "examples/device-lab/manifest.webmanifest",
  "examples/developer-site/index.html",
  "examples/developer-site/styles.css",
  "examples/developer-site/site.js",
  "docs/product/phase8a-capabilities.json",
  "examples/basic-pwa/icons/icon-192.png",
  "examples/basic-pwa/icons/icon-512.png"
];
// Native path.relative avoids POSIX-only slash checks that fail on Windows paths.
export function isStrictSubpath(parent,child,pathApi={relative,isAbsolute,sep}){
  const rel=pathApi.relative(parent,child);
  return rel!==""&&rel!==".."&&!rel.startsWith(".."+pathApi.sep)&&
    !pathApi.isAbsolute(rel);
}
export async function buildDeviceLab({sourceRoot=root,targetRoot=target}={}){
  // fileURLToPath(new URL("../", import.meta.url)) ends in a slash;
  // canonicalize before checking strict output containment.
  sourceRoot=resolve(sourceRoot);
  targetRoot=resolve(targetRoot);
  // Validate destination BEFORE touching source files or preparing output.
  if(!isStrictSubpath(sourceRoot,targetRoot))
    throw Error("Device lab output must be isolated under repository");
  const allowed=[...inputs];
  const sources=await readdir(resolve(sourceRoot,"src"),{withFileTypes:true});
  for(const entry of sources){
    if(entry.isFile()&&/\.(js|wasm)$/.test(entry.name) &&
       /^[a-z0-9.-]+$/i.test(entry.name)){
      allowed.push("src/"+entry.name);
    }
  }
  await rm(targetRoot,{recursive:true,force:true});
  let bytes=0;
  for(const rel of allowed){
    const from=resolve(sourceRoot,rel),to=resolve(targetRoot,rel);
    if(!isStrictSubpath(sourceRoot,from)||!isStrictSubpath(targetRoot,to))
      throw Error("Unsafe deployment asset path");
    await mkdir(resolve(to,".."),{recursive:true});
    await cp(from,to);
    bytes+=(await stat(to)).size;
  }
  return {type:"restricted-device-lab-static-bundle",fileCount:allowed.length,bytes,
    output:targetRoot};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(await buildDeviceLab(),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
