import {test} from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createRecoveryManager,exportRecovery,parseRecovery} from "../src/recovery.js";

const env={crypto:webcrypto,navigator:{storage:{estimate:async()=>({usage:81,quota:100}),
  persisted:async()=>false,persist:async()=>true}}};
function store(initial=[]){
  let records=[...initial];
  let mutations=0;
  return {get mutations(){return mutations;},
    async listRecords(){return records;},
    async importRecords(items,{overwrite=false}={}){
      mutations++;
      let imported=0,skipped=0;
      for(const item of items){
        const i=records.findIndex(x=>x.id===item.id);
        if(i>=0&&!overwrite){skipped++;continue;}
        if(i>=0)records[i]=item;else records.push(item);
        imported++;
      }
      return {imported,skipped};
    }
  };
}
test("version 2 SHA256 backup roundtrip is deterministic",async()=>{
  const original=[{id:"z",content:"żółw"},{id:"a",content:"offline"}];
  const raw=await exportRecovery(original,{env});
  const parsed=await parseRecovery(raw,{env});
  assert.equal(parsed.version,2);
  assert.equal(parsed.integrity,"sha256");
  assert.deepEqual(parsed.records.map(x=>x.id),["a","z"]);
  assert.equal(raw,await exportRecovery([...original].reverse(),{env}));
});
test("tampered v2 backup never reaches import",async()=>{
  const s=store(),manager=createRecoveryManager(s,{env});
  const valid=await exportRecovery([{id:"n",content:"safe"}],{env});
  const tampered=valid.replace("safe","unsafe");
  await assert.rejects(manager.restore(tampered),/checksum mismatch/);
  assert.equal(s.mutations,0);
  assert.equal((await s.listRecords()).length,0);
});
test("duplicate and malformed records rejected without mutation",async()=>{
  const s=store(),manager=createRecoveryManager(s,{env});
  const bad=JSON.stringify({format:"ryzova-wonder-backup",version:1,records:[
    {id:"same",content:"1"},{id:"same",content:"2"}]});
  await assert.rejects(manager.restore(bad),/duplicate/);
  assert.equal(s.mutations,0);
});
test("legacy backups explicitly report missing integrity protection",async()=>{
  const s=store([{id:"a",content:"old"}]),manager=createRecoveryManager(s,{env});
  const old=JSON.stringify({format:"ryzova-wonder-backup",version:1,records:[
    {id:"a",content:"replaced"},{id:"b",content:"new"}]});
  assert.deepEqual(await manager.restore(old),{imported:1,skipped:1,integrity:"legacy-unverified",version:1});
  assert.equal((await s.listRecords()).find(x=>x.id==="a").content,"old");
  await assert.rejects(manager.restore(old,{allowLegacy:false}),/Unsupported/);
});
test("recovery storage reports quota pressure and opt-in persistence",async()=>{
  const manager=createRecoveryManager(store(),{env});
  assert.deepEqual(await manager.storageStatus(),{
    usage:81,quota:100,ratio:0.81,persisted:false,warning:"approaching-quota",evictionPossible:true
  });
  assert.deepEqual(await manager.requestPersistence(),{supported:true,granted:true});
});
test("unsupported crypto is a visible error, not a fabricated checksum",async()=>{
  await assert.rejects(exportRecovery([{id:"x",content:"v"}],{env:{}}),/SHA-256/);
});

