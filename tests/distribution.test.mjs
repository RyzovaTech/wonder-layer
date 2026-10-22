import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {execFileSync} from "node:child_process";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const pkg=JSON.parse(readFileSync(resolve(root,"package.json"),"utf8"));
const dist=resolve(root,"dist");
test("versioned ESM export map points only to actual bundled artifacts",()=>{
  assert.equal(pkg.type,"module");
  assert.equal(pkg.private,true); // publishing must await explicit license decision
  assert.equal(pkg.sideEffects,false);
  for(const [name,entry] of Object.entries(pkg.exports)){
    if(name==="./package.json")continue;
    assert.ok(existsSync(resolve(root,entry.default)),"missing JS: "+name);
    assert.ok(existsSync(resolve(root,entry.types)),"missing type declaration: "+name);
  }
  for(const name of ["compute-worker.js","compute.wasm","scheduler.js","recovery.js"])
    assert.ok(existsSync(resolve(dist,name)),name);
});
test("built SDK imports through Node ESM without eagerly accessing browser",async()=>{
  const module=await import(pathToFileURL(resolve(dist,"wonder.js")).href);
  assert.equal(typeof module.createWonderLayer,"function");
  const client=await import(pathToFileURL(resolve(dist,"client.js")).href);
  assert.equal(typeof client.createWonderClient,"function");
  assert.equal(client.createWonderClient().status,"idle");
});
test("distribution preserves actual compiled WASM binary",async()=>{
  const wasm=readFileSync(resolve(dist,"compute.wasm"));
  assert.ok(wasm.byteLength>8);
  assert.equal(wasm.subarray(0,4).toString("hex"),"0061736d");
  await WebAssembly.compile(wasm);
});
test("package archive includes worker and wasm, but excludes sources/tests",()=>{
  const stdout=execFileSync("npm",["pack","--dry-run","--ignore-scripts","--json"],{
    cwd:root,encoding:"utf8",timeout:20000
  });
  const output=JSON.parse(stdout);
  assert.equal(output.length,1);
  const files=output[0].files.map(f=>f.path);
  for(const name of ["dist/wonder.js","dist/compute-worker.js","dist/compute.wasm","dist/index.d.ts",
    "dist/client.d.ts","dist/react.js","dist/vue.js"])
    assert.ok(files.includes(name),"missing npm archive asset: "+name);
  assert.ok(!files.some(f=>f.startsWith("tests/")||f.startsWith("src/")));
});

