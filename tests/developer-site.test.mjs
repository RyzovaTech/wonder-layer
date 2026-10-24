import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const site=resolve(root,"examples/developer-site");
const read=filename=>readFileSync(resolve(site,filename),"utf8");
const claims=JSON.parse(readFileSync(resolve(root,"docs/product/phase8a-capabilities.json"),"utf8"));

test("Phase 8C ships a discoverable, responsive developer site with local dependencies",()=>{
  const html=read("index.html"),css=read("styles.css");
  assert.match(html,/<!doctype html>/i);
  assert.match(html,/<html lang="en">/);
  assert.match(html,/<meta name="viewport"/);
  for(const id of ["capabilities","capability-grid","capability-status","playground",
    "playground-output","get-started","snippet-code","release"])
    assert(html.includes('id="'+id+'"'),"Missing developer page target "+id);
  assert.match(html,/role="status"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/href="#content"/);
  for(const name of ["styles.css","site.js"])
    assert(existsSync(resolve(site,name)),name);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(html,/<script(?![^>]*\btype="module"[^>]*\bsrc="\.\/site\.js")[^>]*>/i);
  assert.doesNotMatch(html,/(?:https?:)?\/\/(?:www\.)?(?:google-analytics|googletagmanager|segment|mixpanel|hotjar)/i);
});

test("Phase 8C source dynamically renders the checked claims manifest without untrusted HTML",()=>{
  const js=read("site.js");
  assert.match(js,/docs\/product\/phase8a-capabilities\.json/);
  assert.match(js,/manifest\.capabilities\.length!==8/);
  assert.match(js,/physicalDeviceEvidence!=="not-verified"/);
  assert.match(js,/capabilities\.replaceChildren/);
  assert.match(js,/\.textContent=/);
  assert.doesNotMatch(js,/\binnerHTML\b|\binsertAdjacentHTML\b|\beval\s*\(/);
  assert.equal(claims.capabilities.length,8);
  assert.equal(claims.distribution.publicNpmApproved,false);
  assert(claims.capabilities.every(item=>item.physicalDeviceEvidence==="not-verified"));
  execFileSync(process.execPath,["--check",resolve(site,"site.js")],{encoding:"utf8"});
});

test("Phase 8C browser playground only uses explicit actions, synthetic records and opt-in compute",()=>{
  const html=read("index.html"),js=read("site.js");
  for(const action of ["inspect","compute","save","read"])
    assert(html.includes('data-action="'+action+'"'),"Missing opt-in action "+action);
  for(const name of ["vanilla","react","vue"])
    assert(html.includes('data-snippet="'+name+'"'),"Missing framework example "+name);
  assert.match(js,/SYNTHETIC_VALUE="wonder-demo-value-only"/);
  assert.match(js,/createWonderLayer\(\{dbName:DB_NAME\}\)/);
  assert.match(js,/await engine\.run\(input,\{prefer:"auto"\}\)/);
  assert.match(js,/return await task\(layer\.store\)/);
  assert.match(js,/finally\{layer\.close\(\);\}/);
  assert.doesNotMatch(js,/\b\.sync\s*\(|\.hardware\.request\s*\(|navigator\.serviceWorker\.register\s*\(/);
  assert.doesNotMatch(js,/\b(?:sendBeacon|localStorage)\b/);
});

test("Phase 8C stays protected, unreleased and cache-policy compliant",()=>{
  const pkg=JSON.parse(readFileSync(resolve(root,"package.json"),"utf8"));
  assert.equal(pkg.private,true);
  assert.match(pkg.version,/^0\.0\.0-poc\./);
  const config=JSON.parse(readFileSync(resolve(root,"vercel.json"),"utf8"));
  const defaults=config.headers.find(rule=>rule.source==="/(.*)")?.headers??[];
  const csp=defaults.find(header=>header.key==="Content-Security-Policy")?.value;
  assert.match(csp,/default-src 'self'/);
  assert(!csp.includes("unsafe-inline"));
  const rule=config.headers.find(item=>item.source==="/examples/developer-site/(.*)");
  assert.equal(rule.headers.find(x=>x.key==="Cache-Control").value,"no-cache");
  const device=config.headers.findIndex(item=>item.source==="/examples/device-lab/(.*)");
  const worker=config.headers.findIndex(item=>item.source==="/examples/device-lab/sw.js");
  assert(worker>device);
  assert.equal(config.headers[worker].headers.find(x=>x.key==="Cache-Control").value,"no-store");
  assert.doesNotMatch(read("index.html"),/\$\s*\d+|Buy now|Pricing plans/i);
});
