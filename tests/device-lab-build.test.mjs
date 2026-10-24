import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,win32} from "node:path";
import {buildDeviceLab,isStrictSubpath} from "../tools/build-device-lab.mjs";
test("static bundle exports only PWA and browser SDK assets",async()=>{
  const root=await mkdtemp(join(tmpdir(),"wonder-lab-build-"));
  const files=[
    "examples/device-lab/index.html","examples/device-lab/lab.js",
    "examples/device-lab/styles.css","examples/device-lab/sw.js",
    "examples/device-lab/manifest.webmanifest",
    "examples/basic-pwa/icons/icon-192.png","examples/basic-pwa/icons/icon-512.png",
    "src/wonder.js","src/compute.wasm"
  ];
  try{
    for(const rel of files){
      const full=join(root,rel);
      await mkdir(full.slice(0,full.lastIndexOf("/")),{recursive:true});
      await writeFile(full,rel);
    }
    await writeFile(join(root,".env"),"DO_NOT_DEPLOY_SECRET=yes");
    const out=join(root,"public");
    const report=await buildDeviceLab({sourceRoot:root+"/",targetRoot:out+"/"});
    assert.equal(report.fileCount,files.length);
    assert.equal((await readFile(join(out,"src/compute.wasm"),"utf8")),"src/compute.wasm");
    assert.deepEqual((await readdir(out)).sort(),["examples","src"]);
    await assert.rejects(readFile(join(out,".env")),{code:"ENOENT"});
    await assert.rejects(readFile(join(out,"package.json")),{code:"ENOENT"});
  }finally{await rm(root,{recursive:true,force:true});}
});
test("rejects output destination outside project root",async()=>{
  await assert.rejects(buildDeviceLab({sourceRoot:"/project",targetRoot:"/tmp/out"}),/isolated/);
});

test("path containment is portable to Windows and rejects sibling/root paths",()=>{
  assert.equal(isStrictSubpath("C:\\repo","C:\\repo\\public",win32),true);
  assert.equal(isStrictSubpath("C:\\repo","C:\\repo",win32),false);
  assert.equal(isStrictSubpath("C:\\repo","C:\\repo-other\\public",win32),false);
  assert.equal(isStrictSubpath("C:\\repo","D:\\repo\\public",win32),false);
});
