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
function exactKeys(item,allowed){
  return item&&typeof item==="object"&&!Array.isArray(item)&&
    Object.keys(item).every(key=>allowed.includes(key));
}
export function validateDeviceEvidence(data,{maxBytes=MAX_EVIDENCE_BYTES}={}){
  const json=JSON.stringify(data);
  if(!json||new TextEncoder().encode(json).byteLength>maxBytes)
    throw new Error("Evidence exceeds size budget");
  if(!exactKeys(data,["format","operatingSystem","browser","browserVersion",
      "secureContext","measuredAtUtc","noRawDeviceMediaOrCoordinates","results"])||
    data.format!=="ryzova-device-acceptance-v1"||
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
  const verifiedCapabilities=[...new Set(data.results.filter(r=>r.status==="pass").map(r=>r.capability))];
  const unavailableCapabilities=[...new Set(data.results.filter(r=>r.status==="unsupported").map(r=>r.capability))];
  return Object.freeze({
    state:"SELF_REPORTED_DEVICE_EVIDENCE",
    attestedPhysicalDevice:false,
    independentSecurityApproval:false,
    os:data.operatingSystem,browser:data.browser,version:data.browserVersion,
    numberOfChecks:data.results.length,
    verifiedCapabilities,unavailableCapabilities,
    reviewRequired:true
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const input=process.argv[2];
  if(!input){
    console.error("Usage: node tools/verify-device-evidence.mjs ./wonder-device-acceptance.json");
    process.exitCode=2;
  }else{
    try{
      const bytes=readFileSync(resolve(input));
      if(bytes.length>MAX_EVIDENCE_BYTES)throw Error("Evidence file too large");
      const summary=validateDeviceEvidence(JSON.parse(bytes.toString("utf8")));
      console.log(JSON.stringify(summary,null,2));
    }catch(error){console.error(error.message);process.exitCode=1;}
  }
}
