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
    const req=globalThis.indexedDB.open(name,1);
    req.onupgradeneeded=()=>{
      const target=req.result;
      if(!target.objectStoreNames.contains("records"))target.createObjectStore("records",{keyPath:"id"});
      if(!target.objectStoreNames.contains("outbox"))target.createObjectStore("outbox",{keyPath:"record_id"});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(new Error("Database upgrade blocked by another tab"));
  });
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
      if(syncInFlight)return syncInFlight;
      syncInFlight=(async()=>{
        const operations=(await store.pending()).slice(0,200);
        if(!operations.length)return {applied:[],conflicts:[],pending:0};
        const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operations})});
        if(!response.ok)throw new Error("Sync failed: HTTP "+response.status);
        const data=await response.json();
        if(!Array.isArray(data.applied)||!Array.isArray(data.conflicts))throw new Error("Malformed sync response");
        await store.applyAcknowledgements(data.applied);
        return {applied:data.applied,conflicts:data.conflicts,pending:(await store.pending()).length};
      })();
      try{return await syncInFlight;}finally{syncInFlight=null;}
    },
    close(){db.close();}
  };
  return store;
}

