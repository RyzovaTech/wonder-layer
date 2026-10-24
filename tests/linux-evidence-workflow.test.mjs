import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=new URL("../.github/workflows/linux-evidence.yml",import.meta.url);
const workflow=readFileSync(file,"utf8");

test("Linux evidence CI actually schedules Ubuntu runners and both active Node LTS lines",()=>{
  assert.match(workflow,/name: Linux SDK and browser evidence/);
  assert.match(workflow,/runs-on: ubuntu-latest/g);
  assert.equal((workflow.match(/runs-on: ubuntu-latest/g)||[]).length,2);
  assert.match(workflow,/node: \['20', '22'\]/);
  assert.match(workflow,/run: npm test/);
  assert.match(workflow,/node tools\/release-gate\.mjs/);
  assert.match(workflow,/npm pack --dry-run --ignore-scripts/);
});
test("Linux browser acceptance covers real engines not emulated phone hardware",()=>{
  assert.match(workflow,/browser: \[chromium, firefox, webkit\]/);
  assert.match(workflow,/python -m playwright install --with-deps/);
  assert.match(workflow,/--profile desktop/);
  assert.doesNotMatch(workflow,/--profile mobile/);
  assert.match(workflow,/if: always\(\)/);
  assert.match(workflow,/actions\/upload-artifact@v4/);
});
test("Linux evidence requires PR and main workflows while retaining minimal permissions",()=>{
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/push:/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/contents: read/);
  assert.doesNotMatch(workflow,/permissions:\s*\n\s*contents: write/);
  assert.doesNotMatch(workflow,/continue-on-error:\s*true/);
  assert.doesNotMatch(workflow,/npm publish/);
});
