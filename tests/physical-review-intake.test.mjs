import {test} from "node:test";
import assert from "node:assert/strict";
import {createReviewIntakeMatrix,renderReviewIntakeMarkdown,BASELINE_PLATFORMS} from "../tools/physical-review-intake.mjs";

const sample=(format="ryzova-device-acceptance-v2")=>({
  format,operatingSystem:"Android",browser:"Chrome",browserVersion:"137.0",
  secureContext:true,measuredAtUtc:"2026-10-24T07:00:00.000Z",
  noRawDeviceMediaOrCoordinates:true,
  results:[{capability:"camera",status:"denied",detail:"PERMISSION_DENIED",elapsedBand:"<1s"}],
  ...(format.endsWith("v2")?{offlineChecks:{
    networkDisconnection:"manually-confirmed",serviceWorkerControl:"observed-pass",
    offlineReload:"observed-pass",coldRestart:"observed-pass"
  }}:{})
});
test("Phase 8D intake starts at NOT_TESTED for Android and iPhone without any reports",()=>{
  const report=createReviewIntakeMatrix();
  assert.equal(report.schema,"ryzova-phase8d-review-intake-v1");
  assert.equal(report.reportedSessions,0);
  assert.equal(report.physicalDevicesCertified,0);
  assert.equal(report.releaseApproved,false);
  assert.equal(report.status,"INDEPENDENT_REVIEW_REQUIRED");
  assert(BASELINE_PLATFORMS.every(platform=>report.rows.some(x=>x.platform===platform&&x.status==="NOT_TESTED")));
  assert(report.rows.every(x=>x.physicalVerification==="NOT_ATTESTED"&&x.independentSecurityApproval==="PENDING"));
});
test("Phase 8D intake reports counts but refuses to certify claimed physical phone pass",()=>{
  const report=createReviewIntakeMatrix([sample(),sample()]);
  const android=report.rows.find(x=>x.platform==="Android / Chrome");
  assert.equal(android.reportCount,2);
  assert.equal(android.claimedOfflineReloadCount,2);
  assert.equal(android.claimedColdRestartCount,2);
  assert.equal(android.status,"SELF_REPORTED_ONLY");
  assert.equal(android.physicalVerification,"NOT_ATTESTED");
  assert.equal(report.physicalDevicesCertified,0);
  assert.equal(report.releaseApproved,false);
  const md=renderReviewIntakeMarkdown([sample()]);
  assert.match(md,/UNVERIFIED\. NOT A PUBLIC COMPATIBILITY/);
  assert.match(md,/Android \/ Chrome \| 1 \| 1 \| 1 \| SELF_REPORTED_ONLY \| NOT_ATTESTED/);
  assert.match(md,/iOS \/ Safari \| 0 \| 0 \| 0 \| NOT_TESTED \| NOT_ATTESTED/);
  assert.match(md,/Certified physical devices: \*\*0\*\*/);
});
test("Phase 8D intake keeps legacy v1 reports distinct from tested offline claims",()=>{
  const report=createReviewIntakeMatrix([sample("ryzova-device-acceptance-v1")]);
  const row=report.rows.find(x=>x.platform==="Android / Chrome");
  assert.equal(row.reportCount,1);
  assert.equal(row.claimedOfflineReloadCount,0);
  assert.equal(row.claimedColdRestartCount,0);
});
test("Phase 8D intake rejects unknown fields, compromised data and too many reports",()=>{
  const withPII=sample();withPII.serialNumber="private";
  assert.throws(()=>createReviewIntakeMatrix([withPII]),/privacy-unsafe/);
  assert.throws(()=>createReviewIntakeMatrix([sample(),{broken:true}]),/privacy-unsafe/);
  assert.throws(()=>createReviewIntakeMatrix(new Array(26).fill(sample())),/up to 25/);
  assert.throws(()=>createReviewIntakeMatrix({}),/up to 25/);
});
