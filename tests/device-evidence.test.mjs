import {test} from "node:test";
import assert from "node:assert/strict";
import {validateDeviceEvidence,summarizeDeviceEvidence} from "../tools/verify-device-evidence.mjs";
const sample=()=>({
  format:"ryzova-device-acceptance-v1",
  operatingSystem:"Android",browser:"Chrome",browserVersion:"126.0",
  secureContext:true,measuredAtUtc:"2026-10-22T15:00:00.000Z",
  noRawDeviceMediaOrCoordinates:true,
  results:[
    {capability:"camera",status:"pass",detail:"stream granted; tracks stopped",elapsedBand:"1–10s"},
    {capability:"gpu",status:"unsupported",detail:"No browser-accessible WebGPU adapter",elapsedBand:"<1s"}
  ]
});
test("accepts privacy-minimized sample but never certifies physical device origin",()=>{
  const report=validateDeviceEvidence(sample());
  assert.equal(report.state,"SELF_REPORTED_DEVICE_EVIDENCE");
  assert.equal(report.attestedPhysicalDevice,false);
  assert.equal(report.independentSecurityApproval,false);
  assert.deepEqual(report.verifiedCapabilities,["camera"]);
  assert.deepEqual(report.unavailableCapabilities,["gpu"]);
});
test("rejects device identifiers, coordinates, raw audio and arbitrary metadata",()=>{
  const attempted=[
    {latitude:6.5},{deviceId:"abc"},{media:"base64"},{serialNumber:"123"}
  ];
  for(const extra of attempted){
    const data={...sample(),...extra};
    assert.throws(()=>validateDeviceEvidence(data),/privacy-unsafe/);
  }
  const media=sample();media.results[0].detail="recording data:secret";
  assert.throws(()=>validateDeviceEvidence(media),/do not include identifiers/);
});
test("rejects unsupported OS/browser values and non-secure origin reports",()=>{
  for(const update of [{operatingSystem:"Test Device"},{browser:"Unknown Browser"},{secureContext:false}]){
    assert.throws(()=>validateDeviceEvidence({...sample(),...update}));
  }
});
test("rejects claims that a result came from a physical device reviewer",()=>{
  const data=sample();
  data.physicalDeviceCertified=true;
  assert.throws(()=>validateDeviceEvidence(data));
});
test("rejects oversized device evidence and malformed outcomes",()=>{
  const data=sample();data.results[0].status="certified";
  assert.throws(()=>validateDeviceEvidence(data));
  assert.throws(()=>validateDeviceEvidence(sample(),{maxBytes:20}),/size budget/);
});

const sampleV2=()=>({
  ...sample(),
  format:"ryzova-device-acceptance-v2",
  offlineChecks:{
    networkDisconnection:"not-confirmed",
    serviceWorkerControl:"not-tested",
    offlineReload:"not-tested",
    coldRestart:"not-tested"
  }
});
test("Phase 8D default v2 evidence stays unverified and fully privacy-minimized",()=>{
  const report=validateDeviceEvidence(sampleV2());
  assert.equal(report.format,"ryzova-device-acceptance-v2");
  assert.equal(report.state,"SELF_REPORTED_DEVICE_EVIDENCE");
  assert.equal(report.attestedPhysicalDevice,false);
  assert.equal(report.independentSecurityApproval,false);
  assert.equal(report.offlineChecks.offlineReload,"not-tested");
});
test("Phase 8D manual offline sequence is accepted only with explicit network confirmation",()=>{
  const report=sampleV2();
  report.offlineChecks={
    networkDisconnection:"manually-confirmed",
    serviceWorkerControl:"observed-pass",
    offlineReload:"observed-pass",
    coldRestart:"observed-pass"
  };
  const summary=validateDeviceEvidence(report);
  assert.equal(summary.offlineChecks.coldRestart,"observed-pass");
  assert.equal(summary.attestedPhysicalDevice,false);
  assert.equal(summary.reviewRequired,true);
  const noNetwork=structuredClone(report);
  noNetwork.offlineChecks.networkDisconnection="not-confirmed";
  assert.throws(()=>validateDeviceEvidence(noNetwork),/network-disconnection/);
  const noSW=structuredClone(report);
  noSW.offlineChecks.serviceWorkerControl="not-tested";
  assert.throws(()=>validateDeviceEvidence(noSW),/service-worker-control/);
  const noReload=structuredClone(report);
  noReload.offlineChecks.offlineReload="observed-fail";
  assert.throws(()=>validateDeviceEvidence(noReload),/offline-reload/);
});
test("Phase 8D rejects invalid enum, missing offline fields and device/privacy additions",()=>{
  const missing=sampleV2();delete missing.offlineChecks.coldRestart;
  assert.throws(()=>validateDeviceEvidence(missing),/offline evidence/);
  const extra=sampleV2();extra.offlineChecks.deviceId="private-serial";
  assert.throws(()=>validateDeviceEvidence(extra),/offline evidence/);
  const identity=sampleV2();identity.reviewerSignature="pretend signature";
  assert.throws(()=>validateDeviceEvidence(identity),/privacy-unsafe/);
  const spoof=sampleV2();spoof.offlineChecks.offlineReload="certified";
  assert.throws(()=>validateDeviceEvidence(spoof),/offline evidence/);
  const untrusted=sampleV2();untrusted.results[0].rawCoordinates="123";
  assert.throws(()=>validateDeviceEvidence(untrusted),/do not include identifiers/);
});
test("Phase 8D aggregates reports without certifying real physical devices",()=>{
  const v1=sample();
  const v2=sampleV2();
  v2.offlineChecks={
    networkDisconnection:"manually-confirmed",serviceWorkerControl:"observed-pass",
    offlineReload:"observed-pass",coldRestart:"observed-pass"
  };
  const report=summarizeDeviceEvidence([v1,v2]);
  assert.equal(report.state,"SELF_REPORTED_AGGREGATE_REQUIRES_INDEPENDENT_ATTESTATION");
  assert.equal(report.physicalDevicesCertified,0);
  assert.equal(report.independentSecurityReviewApproved,false);
  assert.equal(report.releaseApproved,false);
  assert.equal(report.reports,2);
  assert.equal(report.platforms[0].reports,2);
  assert.equal(report.platforms[0].manualOfflineReloadPassReports,1);
  assert.equal(report.platforms[0].manualColdRestartPassReports,1);
  assert.equal(report.platforms[0].reportedCapabilityPasses.camera,2);
  assert.throws(()=>summarizeDeviceEvidence([{...v2,operatingSystem:"unknown"}]),/privacy-unsafe/);
});
