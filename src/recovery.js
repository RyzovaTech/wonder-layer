import {parseBackup} from "./backup.js";

const FORMAT="ryzova-wonder-recovery";
const VERSION=2;
const MAX_BYTES=12_000_000;
function normalize(records){
  if(!Array.isArray(records)||records.length>20000)throw new Error("Too many recovery records");
  const seen=new Set();
  const result=[];
  for(const value of records){
    if(typeof value?.id!=="string"||value.id.length<1||value.id.length>120||
       typeof value.content!=="string"||value.content.length>100000||
       seen.has(value.id))throw new Error("Invalid or duplicate recovery record");
    seen.add(value.id);
    result.push({id:value.id,content:value.content});
  }
  return result.sort((a,b)=>a.id.localeCompare(b.id,"en"));
}
function secureCrypto(env){
  const crypto=env.crypto;
  if(!crypto?.subtle?.digest)throw new Error("Secure SHA-256 is unavailable");
  return crypto;
}
async function digest(payload,env){
  const bytes=new TextEncoder().encode(payload);
  const result=await secureCrypto(env).subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(result)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
export async function exportRecovery(records,{env=globalThis}={}){
  const items=normalize(records);
  const body=JSON.stringify(items);
  const hash=await digest(body,env);
  const data=JSON.stringify({format:FORMAT,version:VERSION,algorithm:"SHA-256",
    checksum:hash,records:items});
  if(new TextEncoder().encode(data).byteLength>MAX_BYTES)throw new Error("Recovery file exceeds limit");
  return data;
}
export async function parseRecovery(raw,{env=globalThis,allowLegacy=true}={}){
  if(typeof raw!=="string"||new TextEncoder().encode(raw).byteLength>MAX_BYTES)
    throw new Error("Recovery size exceeds limit");
  const document=JSON.parse(raw);
  if(document?.format==="ryzova-wonder-backup" && allowLegacy)
    return {version:1,integrity:"legacy-unverified",records:normalize(parseBackup(raw))};
  if(document?.format!==FORMAT||document.version!==VERSION||
     document.algorithm!=="SHA-256"||typeof document.checksum!=="string"||
     !/^[0-9a-f]{64}$/.test(document.checksum))
    throw new Error("Unsupported or invalid recovery format");
  const records=normalize(document.records);
  const actual=await digest(JSON.stringify(records),env);
  if(actual!==document.checksum)throw new Error("Recovery checksum mismatch");
  return {version:VERSION,integrity:"sha256",records};
}
export function createRecoveryManager(store,{env=globalThis}={}){
  if(!store||typeof store.importRecords!=="function")
    throw new TypeError("Storage adapter requires atomic importRecords");
  return Object.freeze({
    async export(){return exportRecovery(await store.listRecords(),{env});},
    async validate(raw){return parseRecovery(raw,{env});},
    async restore(raw,{overwrite=false,allowLegacy=true}={}){
      const parsed=await parseRecovery(raw,{env,allowLegacy});
      const result=await store.importRecords(parsed.records,{overwrite});
      return {...result,integrity:parsed.integrity,version:parsed.version};
    },
    async storageStatus(){
      const storage=env.navigator?.storage;
      const estimate=typeof storage?.estimate==="function"?await storage.estimate():null;
      const persisted=typeof storage?.persisted==="function"?await storage.persisted():null;
      const quota=estimate?.quota??null,usage=estimate?.usage??null;
      return {quota,usage,ratio:quota>0&&typeof usage==="number"?usage/quota:null,
        persisted,warning:quota>0&&usage/quota>=0.8?"approaching-quota":null,
        evictionPossible:persisted!==true};
    },
    async requestPersistence(){
      const storage=env.navigator?.storage;
      if(typeof storage?.persist!=="function")return {supported:false,granted:false};
      // Call ONLY from an explicit user interaction; never auto-request.
      const granted=await storage.persist();
      return {supported:true,granted:granted===true};
    }
  });
}

