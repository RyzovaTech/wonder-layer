import {test} from "node:test";
import assert from "node:assert/strict";
import {validateDeviceEvidence} from "../tools/verify-device-evidence.mjs";
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
