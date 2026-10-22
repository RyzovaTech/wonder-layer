/**
 * Phase 7 safety gate: current experimental SDK must remain private.
 * Exit nonzero if someone accidentally makes the package publicly publishable.
 */
import {readFileSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const pkg=JSON.parse(readFileSync(resolve(root,"package.json"),"utf8"));
const required=[
 "docs/PHASE7_RELEASE_CHECKLIST.md","docs/PHASE7_DEVICE_VALIDATION.md",
 "SECURITY.md","src/sync-security.js"
];
const problems=[];
if(pkg.private!==true)problems.push("Unapproved public package (private must be true)");
if(!pkg.version.startsWith("0.0.0-poc."))problems.push("Version changed without release authorization");
for(const name of required)if(!existsSync(resolve(root,name)))problems.push("Missing release guard asset "+name);
const result={schema:"wonder-phase7-release-gate-v1",
  status:problems.length?"FAIL":"PASS_PRIVATE_PRE_RELEASE",
  publicReleaseApproved:false,
  physicalMobileHardwareCertified:false,
  version:pkg.version,problems};
console.log(JSON.stringify(result,null,2));
if(problems.length)process.exitCode=1;

