import {test} from "node:test";
import assert from "node:assert/strict";
import {parseBackup,exportBackup} from "../src/backup.js";
test("round-trip backup",()=>{
  const rows=[{id:"demo",content:"offline"}];
  assert.deepEqual(parseBackup(exportBackup(rows)),rows);
});
test("rejects duplicate records",()=>{
  assert.throws(()=>parseBackup(JSON.stringify({format:"ryzova-wonder-backup",version:1,records:[{id:"x",content:"1"},{id:"x",content:"2"}]})),/duplicate/);
});
test("rejects unsupported version",()=>{
  assert.throws(()=>parseBackup('{"format":"ryzova-wonder-backup","version":2,"records":[]}'),/Unsupported/);
});

