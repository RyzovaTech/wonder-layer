import {validateSyncEndpoint,validateSyncResponse,readBoundedSyncJson} from "./sync-security.js";

function requestResult(request){
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error("IndexedDB request failed"));
  });
}
function transactionDone(tx){
  return new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error??new Error("IndexedDB transaction failed"));
    tx.onabort=()=>reject(tx.error??new Error("IndexedDB transaction aborted"));
  });
}
const validId=id=>typeof id==="string"&&id.length>=1&&id.length<=120;
const validContent=value=>typeof value==="string"&&value.length<=100000;
export async function openWonderStore(name="ryzova-wonder"){
  if(!globalThis.indexedDB)throw new Error("IndexedDB unavailable — offline persistence cannot be guaranteed");
  const db=await new Promise((resolve,reject)=>{
    const req=globalThis.indexedDB.open(name,2);
    req.onupgradeneeded=()=>{
      const target=req.result;
      if(!target.objectStoreNames.contains("records"))target.createObjectStore("records",{keyPath:"id"});
      if(!target.objectStoreNames.contains("outbox"))target.createObjectStore("outbox",{keyPath:"record_id"});
      if(!target.objectStoreNames.contains("metadata"))target.createObjectStore("metadata",{keyPath:"key"});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(new Error("Database upgrade blocked by another tab"));
  });
  // Release the database connection when another tab requests a schema migration.
  db.onversionchange=()=>db.close();
  let syncInFlight=null;
  const readAll=async storeName=>{
    const tx=db.transaction(storeName,"readonly"),done=transactionDone(tx);
    const result=await requestResult(tx.objectStore(storeName).getAll());
    await done;return result;
  };
  const store={
    async listRecords(){return readAll("records");},
    async pending(){return readAll("outbox");},
    async save(id,content){
      if(!validId(id)||!validContent(content))throw new Error("Invalid ID or content");
      const tx=db.transaction(["records","outbox"],"readwrite"),done=transactionDone(tx);
      const records=tx.objectStore("records");
      const current=await requestResult(records.get(id));
      const revision=current?.revision??0;
      const op_id=globalThis.crypto.randomUUID();
      const record={id,content,revision,dirty:true,updatedAt:new Date().toISOString()};
      records.put(record);
      tx.objectStore("outbox").put({record_id:id,content,expected_revision:revision,op_id});
      await done;return record;
    },
    async importRecords(items,{overwrite=false}={}){
      if(!Array.isArray(items)||items.length>20000)throw new Error("Invalid recovery records");
      const ids=new Set();
      for(const value of items){
        if(!validId(value?.id)||!validContent(value?.content)||ids.has(value.id))
          throw new Error("Invalid or duplicate recovery record");
        ids.add(value.id);
      }
      // One IndexedDB transaction: either all recovered records and outbox entries
      // commit, or the browser rolls all changes back on abort / QuotaExceededError.
      const tx=db.transaction(["records","outbox"],"readwrite");
      const done=transactionDone(tx);
      const records=tx.objectStore("records"),outbox=tx.objectStore("outbox");
      let imported=0,skipped=0;
      try{
        for(const item of items){
          const existing=await requestResult(records.get(item.id));
          if(existing&&!overwrite){skipped++;continue;}
          const revision=existing?.revision??0;
          const row={id:item.id,content:item.content,revision,dirty:true,
            updatedAt:new Date().toISOString()};
          const op={record_id:item.id,content:item.content,expected_revision:revision,
            op_id:globalThis.crypto.randomUUID()};
          await requestResult(records.put(row));
          await requestResult(outbox.put(op));
          imported++;
        }
        await done;
        return {imported,skipped};
      }catch(error){
        try{tx.abort();}catch{}
        await done.catch(()=>{});
        throw error;
      }
    },
    async resolveConflict(id,mode,remote){
      if(!validId(id)||!validContent(remote?.content)||!Number.isSafeInteger(remote?.revision)||remote.revision<0)
        throw new Error("Invalid conflict details");
      if(mode!=="remote" && mode!=="local")throw new Error("Unknown conflict strategy");
      const tx=db.transaction(["records","outbox"],"readwrite"),done=transactionDone(tx);
      const records=tx.objectStore("records"),outbox=tx.objectStore("outbox");
      if(mode==="remote"){
        records.put({id,content:remote.content,revision:remote.revision,dirty:false,updatedAt:new Date().toISOString()});
        outbox.delete(id);
      }else if(mode==="local"){
        const current=await requestResult(records.get(id));
        if(!current){tx.abort();await done.catch(()=>{});throw new Error("Record absent");}
        records.put({...current,revision:remote.revision,dirty:true});
        outbox.put({record_id:id,content:current.content,expected_revision:remote.revision,op_id:globalThis.crypto.randomUUID()});
      }
      await done;
    },
    async applyAcknowledgements(applied){
      // Reject any malformed server batch before changing local records.
      if(!Array.isArray(applied))throw new Error("Invalid server acknowledgement list");
      for(const ack of applied){
        if(!validId(ack?.record_id)||typeof ack?.op_id!=="string"||!ack.op_id||
          !Number.isSafeInteger(ack?.revision)||ack.revision<0)
          throw new Error("Invalid server acknowledgement");
      }
      for(const ack of applied){
        const tx=db.transaction(["records","outbox"],"readwrite"),done=transactionDone(tx);
        const records=tx.objectStore("records"),outbox=tx.objectStore("outbox");
        const queued=await requestResult(outbox.get(ack.record_id));
        const current=await requestResult(records.get(ack.record_id));
        if(current && ack.revision>=current.revision){
          if(queued?.op_id===ack.op_id){
            outbox.delete(ack.record_id);records.put({...current,revision:ack.revision,dirty:false});
          }else if(queued){
            // A later local write must not be deleted by an older server acknowledgement.
            outbox.put({...queued,expected_revision:ack.revision});
            records.put({...current,revision:ack.revision,dirty:true});
          }
        }
        await done;
      }
    },
    async sync(endpoint="/api/sync"){
      // Resolve and validate even when there is no pending work: fail closed on
      // cross-origin, unsafe-scheme or credential-bearing endpoint mistakes.
      const safeEndpoint=validateSyncEndpoint(endpoint);
      if(syncInFlight)return syncInFlight;
      syncInFlight=(async()=>{
        const operations=(await store.pending()).slice(0,200);
        if(!operations.length)return {applied:[],conflicts:[],pending:0};
        const response=await fetch(safeEndpoint,{
          method:"POST",mode:"same-origin",credentials:"same-origin",
          redirect:"error",referrerPolicy:"no-referrer",cache:"no-store",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({operations})
        });
        if(!response.ok)throw new Error("Sync failed: HTTP "+response.status);
        const contentType=response.headers?.get?.("content-type");
        if(response.headers && !/^application\/(?:[a-z0-9.+-]*\+)?json(?:\s*;|\s*$)/i.test(contentType??""))
          throw new Error("Sync response must be JSON");
        const length=response.headers?.get?.("content-length");
        if(length!==null && length!==undefined && Number(length)>1_000_000)
          throw new Error("Sync response exceeds size limit");
        const data=await readBoundedSyncJson(response);
        validateSyncResponse(data,operations);
        await store.applyAcknowledgements(data.applied);
        return {applied:data.applied,conflicts:data.conflicts,pending:(await store.pending()).length};
      })();
      try{return await syncInFlight;}finally{syncInFlight=null;}
    },
    close(){db.close();}
  };
  return store;
}

