import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const root=join(dirname(fileURLToPath(import.meta.url)), "..");
const json=JSON.parse(readFileSync(join(root, "docs/product/phase8a-capabilities.json"), "utf8"));
const pkg=JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const types=readFileSync(join(root, "types/index.d.ts"), "utf8");
const position=readFileSync(join(root, "docs/PHASE8A_PRODUCT_DEFINITION.md"), "utf8");

test("Phase 8A product metadata stays aligned with the private SDK package", ()=>{
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.product.stage, "engineering-beta");
  assert.equal(json.product.packageName, pkg.name);
  assert.equal(json.product.version, pkg.version);
  assert.equal(pkg.private, true, "The release safety gate must remain enabled");
  assert.equal(json.distribution.npmPrivate, pkg.private);
  assert.equal(json.distribution.publicNpmApproved, false);
  assert.equal(json.distribution.licenseApproved, false);
  assert.equal(json.distribution.independentSecurityApproved, false);
  assert.equal(json.distribution.physicalMobileApproved, false);
});

test("Phase 8A product entrypoints are real shipped package exports", ()=>{
  const declared=new Set();
  for(const item of json.entrypoints){
    assert.equal(typeof item.name, "string");
    assert.equal(typeof item.packageExport, "string");
    assert(!declared.has(item.packageExport), "duplicate entrypoint");
    declared.add(item.packageExport);
    assert(pkg.exports[item.packageExport], `Missing package export: ${item.packageExport}`);
    assert(pkg.exports[item.packageExport].types, "Entrypoint requires public types");
    assert(pkg.exports[item.packageExport].default, "Entrypoint requires a JS implementation");
  }
  assert.deepEqual([...declared].sort(), [".","./client","./react","./vue"].sort());
});

test("Phase 8A claims refer only to declared SDK capability roots", ()=>{
  assert(json.capabilities.length>=8, "Must document all initial product surfaces");
  const ids=new Set();
  for(const capability of json.capabilities){
    assert.match(capability.id, /^[a-z][a-z0-9-]+$/);
    assert(!ids.has(capability.id), "duplicate capability ID");
    ids.add(capability.id);
    assert(["implemented","implemented-client-only"].includes(capability.implementation));
    assert(["yes","partial","no"].includes(capability.hostedAutomatedEvidence));
    assert.equal(capability.physicalDeviceEvidence,"not-verified", "Physical verification needs signed real-device evidence");
    assert.equal(typeof capability.scope,"string");
    assert(capability.scope.length>25);
    const root=capability.sdkRoot;
    assert.match(root, /^[A-Za-z][A-Za-z0-9]*$/);
    assert(
      types.includes(`${root}:`) || types.includes(`${root}(`),
      `Product capability ${capability.id} references undeclared SDK root ${root}`
    );
  }
});

test("Phase 8A explicitly excludes prohibited native/security/AI/performance promises", ()=>{
  const exclusions=[
    "nativeApiParity","unrestrictedBackgroundTasks","permissionBypass",
    "guaranteedOfflineDataPersistence","includedAiModel","includedProductionSyncServer",
    "physicalDeviceCertification","comparativePerformanceProof"
  ];
  for(const key of exclusions)assert.equal(json.notProvided[key],false,`Unverified promise: ${key}`);
  assert.match(position,/independently measured/i);
  assert.match(position,/license decision/i);
  assert.match(position,/physical Android Chrome and iPhone Safari/i);
  assert.match(position,/5–10 consenting external developers/);
  assert.match(position,/Phase 8B handoff/);
});

test("Phase 8A baseline links and release blockers remain auditable", ()=>{
  assert.match(json.validatedBaseline.mergeSha,/^[a-f0-9]{40}$/);
  for(const key of ["sdk","consumer","browser","security"]){
    assert.match(json.validatedBaseline.workflows[key], /^https:\/\/github\.com\/RyzovaTech\/wonder-layer\/actions\/runs\/\d+$/);
  }
  assert(json.releaseBlockers.length>=5);
  for(const blocker of json.releaseBlockers){
    assert.equal(typeof blocker.name,"string");
    assert(Number.isInteger(blocker.issue)&&blocker.issue>0);
  }
  assert(position.includes("phase8a-capabilities.json"));
});
