import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const code=readFileSync(new URL("browser_acceptance.py",import.meta.url),"utf8");

test("SW acceptance waits for actual installed and activated browser registration before navigating",()=>{
  const start=code.indexOf("def controlled():");
  const end=code.indexOf('check("service_worker_control", controlled)',start);
  assert(start>=0&&end>start);
  const controlled=code.slice(start,end);
  const wait=controlled.indexOf('page.wait_for_function("""async () =>');
  const actualRegistration=controlled.indexOf("navigator.serviceWorker.getRegistration()");
  const realActivation=controlled.indexOf('reg?.active?.state === "activated"');
  const reload=controlled.indexOf('page.reload(wait_until="load")');
  const controller=controlled.indexOf('navigator.serviceWorker?.controller');
  assert(wait>=0&&actualRegistration>wait&&realActivation>actualRegistration);
  assert(reload>realActivation);
  assert(controller>reload,"Still require a real controller after reload");
  assert.match(controlled,/timeout=30000/);
  assert.match(controlled,/timeout=15000/);
  assert.doesNotMatch(controlled,/route\(|service_workers="block"|mock\(/);
});
