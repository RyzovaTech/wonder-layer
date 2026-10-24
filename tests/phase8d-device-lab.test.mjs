import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const read=rel=>readFileSync(new URL("../"+rel,import.meta.url),"utf8");
test("Phase 8D protected lab includes manual offline sequence and no automatic hardware verification",()=>{
  const html=read("examples/device-lab/index.html");
  const script=read("examples/device-lab/lab.js");
  for(const id of ["check-sw-control","sw-control-status","network-offline-confirmed",
    "offline-reload-result","cold-restart-result","download","offline-status"])
    assert(html.includes('id="'+id+'"'),"Missing Phase 8D field "+id);
  assert.match(html,/self-reported observations/i);
  assert.match(html,/Fully close the physical browser/i);
  assert.match(script,/ryzova-device-acceptance-v2/);
  assert.match(script,/navigator\.serviceWorker\.controller/);
  assert.match(script,/validateManualOfflineChecks\(offlineChecks\)/);
  assert.match(script,/offlineChecks/);
  assert.match(script,/networkDisconnection/);
  assert.match(script,/coldRestart/);
  assert.match(script,/serviceWorkerObservation="not-tested"/);
  assert.doesNotMatch(script,/physicalDeviceCertified:\s*true|independentSecurityApproval:\s*true/);
  assert.doesNotMatch(script,/\b(?:sendBeacon|navigator\.geolocation\.watchPosition)\b/);
  execFileSync(process.execPath,["--check",fileURLToPath(new URL("../examples/device-lab/lab.js",import.meta.url))]);
});
test("Phase 8D Service Worker cache is bumped and remains strictly same origin",()=>{
  const sw=read("examples/device-lab/sw.js");
  assert.match(sw,/const CACHE="ryzova-wonder-device-lab-v2"/);
  assert.match(sw,/cache\.addAll\(SHELL\)/);
  assert.match(sw,/url\.origin!==self\.location\.origin/);
  assert.match(sw,/req\.method!=="GET"/);
  assert.match(sw,/startsWith\("\/api\/"\)/);
});
test("Phase 8D evidence and review still explicitly require signed physical provenance",()=>{
  const tool=read("tools/verify-device-evidence.mjs");
  const policy=read("docs/PHASE8D_PHYSICAL_VALIDATION.md");
  assert.match(tool,/SELF_REPORTED_AGGREGATE_REQUIRES_INDEPENDENT_ATTESTATION/);
  assert.match(tool,/attestedPhysicalDevice:false/);
  assert.match(tool,/physicalDevicesCertified:0/);
  assert.match(policy,/NOT TESTED/);
  assert.match(policy,/independent.*security/i);
  assert.match(policy,/real phone/i);
  assert.match(policy,/restricted evidence store/i);
});
