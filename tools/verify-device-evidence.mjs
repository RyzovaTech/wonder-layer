import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const MAX_EVIDENCE_BYTES=32_768;
const systems=new Set(["Android","iOS","Windows","macOS","Linux"]);
const browsers=new Set(["Chrome","Edge","Firefox","Safari","Other"]);
const capabilities=new Set(["camera","microphone","geolocation","bluetooth","usb","hid","serial","gpu"]);
const statuses=new Set(["pass","denied","cancelled","unsupported","error"]);
const details=new Set([
  "none","stream granted; tracks stopped","position granted",
  "accuracy band <20m","accuracy band 20–99m","accuracy band 100m+",
  "browser chooser returned a selection",
  "No browser-accessible WebGPU adapter",
  "verified numeric shader output",
  "WebGPU adapter present but compute dispatch or numerical validation failed",
  "unverified capability"
]);
const offlineStates=new Set(["not-tested","observed-pass","observed-fail","unsupported"]);
const offlineKeys=["networkDisconnection","serviceWorkerControl","offlineReload","coldRestart"];
const evidenceKeys=["format","operatingSystem","browser","browserVersion",
  "secureContext","measuredAtUtc","noRawDeviceMediaOrCoordinates","results"];
function exactKeys(item,allowed){
  return item!==null&&typeof item==="object"&&!Array.isArray(item)&&
    Object.keys(item).every(key=>allowed.includes(key))&&
    allowed.every(key=>Object.hasOwn(item,key));
}
function validateOffline(offline){
  if(!exactKeys(offline,offlineKeys) ||
     !["not-confirmed","manually-confirmed"].includes(offline.networkDisconnection))
    throw new Error("Invalid offline evidence fields");
  for(const name of ["serviceWorkerControl","offlineReload","coldRestart"]){
    if(!offlineStates.has(offline[name]))throw new Error("Invalid offline evidence state: "+name);
  }
  if(offline.networkDisconnection!=="manually-confirmed" &&
    (offline.offlineReload==="observed-pass"||offline.coldRestart==="observed-pass"))
    throw new Error("Offline pass requires explicit manual network-disconnection confirmation");
  if(offline.coldRestart==="observed-pass" && offline.offlineReload!=="observed-pass")
    throw new Error("Cold-restart pass requires the offline-reload step to pass first");
  if(offline.offlineReload==="observed-pass"&&offline.serviceWorkerControl!=="observed-pass")
    throw new Error("Offline reload pass requires service-worker-control step to pass first");
  return Object.freeze({...offline});
}
export function validateDeviceEvidence(data,{maxBytes=MAX_EVIDENCE_BYTES}={}){
  const json=JSON.stringify(data);
  if(!json||new TextEncoder().encode(json).byteLength>maxBytes)
    throw new Error("Evidence exceeds size budget");
  const v2=data?.format==="ryzova-device-acceptance-v2";
  if(!exactKeys(data,v2?[...evidenceKeys,"offlineChecks"]:evidenceKeys)||
    !["ryzova-device-acceptance-v1","ryzova-device-acceptance-v2"].includes(data.format)||
    !systems.has(data.operatingSystem)||
    !browsers.has(data.browser)||
    typeof data.browserVersion!=="string"||data.browserVersion.length>24||
    !/^[a-zA-Z0-9. -]*$/.test(data.browserVersion)||
    data.secureContext!==true||
    data.noRawDeviceMediaOrCoordinates!==true||
    typeof data.measuredAtUtc!=="string"||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(data.measuredAtUtc)||
    !Number.isFinite(Date.parse(data.measuredAtUtc))||
    !Array.isArray(data.results)||data.results.length>80)
    throw new Error("Invalid or privacy-unsafe device evidence");
  for(const r of data.results){
    if(!exactKeys(r,["capability","status","detail","elapsedBand"])||
      !capabilities.has(r.capability)||!statuses.has(r.status)||
      typeof r.detail!=="string"||
      !(details.has(r.detail)||/^[A-Z_]{2,40}$/.test(r.detail))||
      !["<1s","1–10s",">10s"].includes(r.elapsedBand))
      throw new Error("Invalid device result; do not include identifiers or raw data");
  }
  const offline=v2?validateOffline(data.offlineChecks):null;
  const verifiedCapabilities=[...new Set(data.results.filter(r=>r.status==="pass").map(r=>r.capability))];
  const unavailableCapabilities=[...new Set(data.results.filter(r=>r.status==="unsupported").map(r=>r.capability))];
  return Object.freeze({
    state:"SELF_REPORTED_DEVICE_EVIDENCE",
    format:data.format,
    attestedPhysicalDevice:false,
    independentSecurityApproval:false,
    os:data.operatingSystem,browser:data.browser,version:data.browserVersion,
    numberOfChecks:data.results.length,
    verifiedCapabilities,unavailableCapabilities,
    offlineChecks:offline,
    reviewRequired:true
  });
}
/**
 * Aggregation deliberately never emits CERTIFIED/SUPPORTED. Accepted JSON is
 * self-reported, even when offline fields say observed-pass.
 */
export function summarizeDeviceEvidence(evidenceArray){
  if(!Array.isArray(evidenceArray))throw new TypeError("Expected evidence reports array");
  const byPlatform=new Map();
  for(const evidence of evidenceArray){
    const parsed=validateDeviceEvidence(evidence);
    const key=parsed.os+" / "+parsed.browser;
    const found=byPlatform.get(key)??{
      platform:key,reports:0,manualOfflineReloadPassReports:0,
      manualColdRestartPassReports:0,reportedCapabilityPasses:{}
    };
    found.reports++;
    if(parsed.offlineChecks?.offlineReload==="observed-pass")found.manualOfflineReloadPassReports++;
    if(parsed.offlineChecks?.coldRestart==="observed-pass")found.manualColdRestartPassReports++;
    for(const cap of parsed.verifiedCapabilities)
      found.reportedCapabilityPasses[cap]=(found.reportedCapabilityPasses[cap]??0)+1;
    byPlatform.set(key,found);
  }
  return Object.freeze({
    state:"SELF_REPORTED_AGGREGATE_REQUIRES_INDEPENDENT_ATTESTATION",
    physicalDevicesCertified:0,
    independentSecurityReviewApproved:false,
    reports:evidenceArray.length,
    platforms:[...byPlatform.values()].sort((a,b)=>a.platform.localeCompare(b.platform)),
    releaseApproved:false
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const paths=process.argv.slice(2);
  if(!paths.length){
    console.error("Usage: node tools/verify-device-evidence.mjs ./wonder-device-acceptance.json [more-evidence.json ...]");
    process.exitCode=2;
  }else{
    try{
      const inputs=paths.map(input=>{
        const bytes=readFileSync(resolve(input));
        if(bytes.length>MAX_EVIDENCE_BYTES)throw Error("Evidence file too large");
        return JSON.parse(bytes.toString("utf8"));
      });
      const report=inputs.length===1?validateDeviceEvidence(inputs[0]):summarizeDeviceEvidence(inputs);
      console.log(JSON.stringify(report,null,2));
    }catch(error){console.error(error.message);process.exitCode=1;}
  }
}
