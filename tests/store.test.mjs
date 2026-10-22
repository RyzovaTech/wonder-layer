import {test} from "node:test";
import assert from "node:assert/strict";
import {openWonderStore} from "../src/store.js";
import {createWonderLayer} from "../src/wonder.js";

// In-memory IndexedDB state-machine fake. It is not proof of browser disk persistence.
function fakeIndexedDB(){
  const maps={};
  function makeDatabase(){
    return {
      objectStoreNames:{contains:name=>name in maps},
      createObjectStore(name,options){maps[name]={map:new Map(),keyPath:options.keyPath};},
      close(){},
      transaction(){
        let pending=0,completed=false;
        const tx={
          oncomplete:null,onabort:null,onerror:null,error:null,
          abort(){tx.onabort?.();},
          objectStore(name){
            const {map,keyPath}=maps[name];
            function request(op,value){
              pending++;
              const r={onsuccess:null,onerror:null,result:undefined,error:null};
              setTimeout(()=>{
                try{
                  if(op==="get")r.result=map.get(value);
                  if(op==="getAll")r.result=[...map.values()];
                  if(op==="put"){map.set(value[keyPath],structuredClone(value));r.result=value[keyPath];}
                  if(op==="delete")map.delete(value);
                  r.onsuccess?.();
                }catch(error){
                  r.error=error;tx.error=error;r.onerror?.();tx.onerror?.();
                }
                pending--;
                setTimeout(()=>{if(!pending&&!completed){completed=true;tx.oncomplete?.();}},2);
              },0);
              return r;
            }
            return {get:value=>request("get",value),getAll:()=>request("getAll"),put:value=>request("put",value),delete:value=>request("delete",value)};
          }
        };
        return tx;
      }
    };
  }
  return {open(){
    const db=makeDatabase();
    const r={result:db,onupgradeneeded:null,onsuccess:null,onerror:null};
    setTimeout(()=>{r.onupgradeneeded?.();setTimeout(()=>r.onsuccess?.(),0);},0);
    return r;
  }};
}
function withIndexedDB(fn){
  return async()=>{
    const original=globalThis.indexedDB;
    globalThis.indexedDB=fakeIndexedDB();
    try{await fn();}finally{
      if(original===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=original;
    }
  };
}
test("offline saves coalesce by record; IDB survives simulated database reopen",withIndexedDB(async()=>{
  const db=await openWonderStore("records");
  await db.save("draft","first");
  await db.save("draft","second");
  assert.equal((await db.pending()).length,1);
  assert.equal((await db.pending())[0].content,"second");
  db.close();
  const reopened=await openWonderStore("records");
  assert.equal((await reopened.listRecords())[0].content,"second");
  const item=(await reopened.pending())[0];
  await reopened.applyAcknowledgements([{op_id:item.op_id,record_id:"draft",revision:1}]);
  assert.equal((await reopened.pending()).length,0);
  assert.equal((await reopened.listRecords())[0].dirty,false);
  reopened.close();
}));
test("ack for older mutation never drops newer local edit",withIndexedDB(async()=>{
  const db=await openWonderStore("stale-ack");
  await db.save("note","first");
  const old=(await db.pending())[0];
  await db.save("note","second");
  await db.applyAcknowledgements([{op_id:old.op_id,record_id:"note",revision:4}]);
  const next=(await db.pending())[0];
  assert.equal(next.content,"second");
  assert.equal(next.expected_revision,4);
  assert.equal((await db.listRecords())[0].dirty,true);
  db.close();
}));
test("local or remote conflict resolution is explicit",withIndexedDB(async()=>{
  const db=await openWonderStore("conflicts");
  await db.save("note","local text");
  await db.resolveConflict("note","local",{revision:7,content:"remote text"});
  assert.equal((await db.pending())[0].expected_revision,7);
  await db.resolveConflict("note","remote",{revision:7,content:"remote text"});
  assert.equal((await db.pending()).length,0);
  assert.equal((await db.listRecords())[0].content,"remote text");
  await assert.rejects(db.resolveConflict("note","unknown",{revision:7,content:"remote text"}),/Unknown conflict strategy/);
  db.close();
}));
test("sync batches at most 200 and deduplicates concurrent requests",withIndexedDB(async()=>{
  const savedFetch=globalThis.fetch;
  const db=await openWonderStore("batch");
  for(let i=0;i<205;i++)await db.save("id-"+i,"payload");
  let calls=0;
  try{
    globalThis.fetch=async(_,init)=>{
      calls++;
      const operations=JSON.parse(init.body).operations;
      assert.equal(operations.length,200);
      return {ok:true,json:async()=>({
        applied:operations.map(op=>({record_id:op.record_id,op_id:op.op_id,revision:1})),
        conflicts:[]
      })};
    };
    const [a,b]=await Promise.all([db.sync("/api/sync"),db.sync("/api/sync")]);
    assert.equal(calls,1);
    assert.equal(a.applied.length,200);
    assert.equal(b.pending,5);
    assert.equal((await db.pending()).length,5);
  }finally{globalThis.fetch=savedFetch;db.close();}
}));
test("failed network request retains edits for retry",withIndexedDB(async()=>{
  const oldFetch=globalThis.fetch;
  const db=await openWonderStore("retry");
  await db.save("draft","offline value");
  try{
    globalThis.fetch=async()=>{throw new Error("offline");};
    await assert.rejects(db.sync("/api/sync"),/offline/);
    assert.equal((await db.pending()).length,1);
    globalThis.fetch=async(_,init)=>({
      ok:true,json:async()=>({applied:JSON.parse(init.body).operations.map(op=>({record_id:op.record_id,op_id:op.op_id,revision:1})),conflicts:[]})
    });
    assert.equal((await db.sync("/api/sync")).pending,0);
  }finally{globalThis.fetch=oldFetch;db.close();}
}));
test("backup validation and default non-overwriting restore",withIndexedDB(async()=>{
  const layer=await createWonderLayer({dbName:"restore"});
  try{
    await layer.store.save("existing","safe");
    const backup=JSON.stringify({format:"ryzova-wonder-backup",version:1,records:[
      {id:"existing",content:"overwrite attempt"},
      {id:"fresh",content:"new"}
    ]});
    assert.deepEqual(await layer.restore(backup),{imported:1,skipped:1});
    const rows=await layer.store.listRecords();
    assert.equal(rows.find(x=>x.id==="existing").content,"safe");
    assert.equal(rows.find(x=>x.id==="fresh").content,"new");
    const dup=JSON.stringify({format:"ryzova-wonder-backup",version:1,records:[
      {id:"dup",content:"a"},{id:"dup",content:"b"}
    ]});
    await assert.rejects(layer.restore(dup),/Invalid or duplicate/);
    assert.equal((await layer.store.listRecords()).length,2);
  }finally{layer.close();}
}));

test("invalid mixed acknowledgements are rejected before any changes",withIndexedDB(async()=>{
  const db=await openWonderStore("untrusted-acks");
  await db.save("note","persisted");
  const op=(await db.pending())[0];
  await assert.rejects(db.applyAcknowledgements([
    {record_id:"note",op_id:op.op_id,revision:1},
    {record_id:"other",op_id:"bad",revision:-1}
  ]),/Invalid server acknowledgement/);
  assert.equal((await db.pending()).length,1);
  assert.equal((await db.listRecords())[0].dirty,true);
  db.close();
}));
test("older server revision cannot roll local record backward",withIndexedDB(async()=>{
  const db=await openWonderStore("revision-floor");
  await db.save("note","first");
  const op=(await db.pending())[0];
  await db.applyAcknowledgements([{record_id:"note",op_id:op.op_id,revision:5}]);
  await db.save("note","new");
  const later=(await db.pending())[0];
  await db.applyAcknowledgements([{record_id:"note",op_id:later.op_id,revision:3}]);
  assert.equal((await db.listRecords())[0].revision,5);
  assert.equal((await db.pending()).length,1);
  db.close();
}));

test("atomic bulk import preserves existing dirty record and creates outbox entries",withIndexedDB(async()=>{
  const db=await openWonderStore("atomic-import");
  try{
    await db.save("existing","precious");
    const result=await db.importRecords([
      {id:"existing",content:"do-not-overwrite"},
      {id:"new-a",content:"restored one"},
      {id:"new-b",content:"restored two"}
    ]);
    assert.deepEqual(result,{imported:2,skipped:1});
    const records=await db.listRecords();
    assert.equal(records.find(x=>x.id==="existing").content,"precious");
    assert.equal(records.find(x=>x.id==="new-a").dirty,true);
    assert.equal((await db.pending()).length,3);
    const overwritten=await db.importRecords([{id:"existing",content:"approved"}],{overwrite:true});
    assert.deepEqual(overwritten,{imported:1,skipped:0});
    assert.equal((await db.listRecords()).find(x=>x.id==="existing").content,"approved");
  }finally{db.close();}
}));
test("bulk recovery rejects malformed batch before touching store",withIndexedDB(async()=>{
  const db=await openWonderStore("invalid-import");
  try{
    await assert.rejects(db.importRecords([
      {id:"one",content:"safe"},{id:"one",content:"duplicate"}
    ]),/Invalid or duplicate/);
    assert.equal((await db.listRecords()).length,0);
    assert.equal((await db.pending()).length,0);
  }finally{db.close();}
}));
