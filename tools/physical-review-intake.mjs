/**
 * Human-review intake report, NOT a release-support compatibility matrix.
 * Only coarse, self-reported data is accepted. This tool never consumes
 * personal identifiers, produces signed attestations or marks a device verified.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {summarizeDeviceEvidence} from "./verify-device-evidence.mjs";

const MAX_FILE_BYTES=32768;
const MAX_REPORTS=25;
export const BASELINE_PLATFORMS=Object.freeze([
  "Android / Chrome",
  "iOS / Safari",
  "iOS / Chrome",
  "Windows / Edge",
  "Windows / Chrome",
  "macOS / Safari",
  "macOS / Chrome",
  "Linux / Chrome",
  "Linux / Firefox"
]);
const escapeCell=value=>String(value).replaceAll("|","\\|").replaceAll("\n"," ");

export function createReviewIntakeMatrix(evidence=[]){
  if(!Array.isArray(evidence)||evidence.length>MAX_REPORTS)
    throw new TypeError("Expected up to 25 local evidence reports");
  const aggregate=summarizeDeviceEvidence(evidence);
  const entries=new Map(aggregate.platforms.map(x=>[x.platform,x]));
  const names=[...new Set([...BASELINE_PLATFORMS,...entries.keys()])].sort((a,b)=>a.localeCompare(b));
  const rows=names.map(platform=>{
    const evidenceRow=entries.get(platform);
    return {
      platform,
      reportCount:evidenceRow?.reports??0,
      claimedOfflineReloadCount:evidenceRow?.manualOfflineReloadPassReports??0,
      claimedColdRestartCount:evidenceRow?.manualColdRestartPassReports??0,
      status:evidenceRow?"SELF_REPORTED_ONLY":"NOT_TESTED",
      physicalVerification:"NOT_ATTESTED",
      independentSecurityApproval:"PENDING"
    };
  });
  return Object.freeze({
    schema:"ryzova-phase8d-review-intake-v1",
    status:"INDEPENDENT_REVIEW_REQUIRED",
    reportedSessions:evidence.length,
    physicalDevicesCertified:0,
    releaseApproved:false,
    rows
  });
}
export function renderReviewIntakeMarkdown(evidence=[]){
  const matrix=createReviewIntakeMatrix(evidence);
  const lines=[
    "# Wonder Layer — Physical Compatibility Review Intake",
    "",
    "**Status: UNVERIFIED. NOT A PUBLIC COMPATIBILITY OR SUPPORT CLAIM.**",
    "",
    "Counts below come from local, privacy-minimized, **self-reported sessions** only; they are not distinct physical devices. A reported offline pass is not proof that a phone was physically offline.",
    "",
    "| Platform / browser | Self-reported sessions | Claimed offline reload passes | Claimed cold restart passes | Intake status | Physical evidence |",
    "| --- | ---: | ---: | ---: | --- | --- |"
  ];
  for(const row of matrix.rows){
    lines.push("| "+[
      row.platform,row.reportCount,row.claimedOfflineReloadCount,row.claimedColdRestartCount,
      row.status,row.physicalVerification
    ].map(escapeCell).join(" | ")+" |");
  }
  lines.push("",
    "Independent security review: **PENDING**. Certified physical devices: **0**. Release approved: **NO**.",
    "",
    "A qualified, non-implementing reviewer must verify actual hardware provenance, exact deployed SHA, browser and OS version, physical airplane-mode/cold-restart procedure, private evidence checksum, and unresolved issues. Reviewer signoff and an authorized release-owner decision are separate, restricted records. Do not upload raw evidence or identifiable data to public GitHub.",
    "");
  return lines.join("\n");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const paths=process.argv.slice(2);
    if(paths.length>MAX_REPORTS)throw new Error("Too many reports; process at most 25");
    const inputs=paths.map(path=>{
      const bytes=readFileSync(resolve(path));
      if(bytes.length>MAX_FILE_BYTES)throw new Error("Evidence file exceeds size limit");
      return JSON.parse(bytes.toString("utf8"));
    });
    process.stdout.write(renderReviewIntakeMarkdown(inputs));
  }catch(error){
    console.error("Review intake rejected: "+error.message);
    process.exitCode=1;
  }
}
