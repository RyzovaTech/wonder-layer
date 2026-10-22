/**
 * Untrusted sync endpoint and server acknowledgement policy.
 * No implicit cross-origin upload of locally stored application records.
 */
const validId=id=>typeof id==="string"&&id.length>0&&id.length<=120;
export function validateSyncEndpoint(endpoint,{origin=globalThis.location?.origin}={}){
  if(typeof endpoint!=="string"||endpoint.length<1||endpoint.length>2048||
     endpoint.trim()!==endpoint||
     /[\u0000-\u001f\u007f]/.test(endpoint))
    throw new TypeError("Invalid sync endpoint");
  if(!origin||origin==="null"){
    // Node tests have no browser origin. Permit rooted app-local paths only.
    if(!endpoint.startsWith("/")||endpoint.startsWith("//")||endpoint.includes("#"))
      throw new Error("Sync requires a same-origin endpoint");
    return endpoint;
  }
  let url;
  try{url=new URL(endpoint,origin+"/");}
  catch{throw new Error("Invalid sync endpoint URL");}
  if(url.protocol!=="https:"&&url.protocol!=="http:")
    throw new Error("Unsafe sync endpoint scheme");
  if(url.origin!==origin)throw new Error("Cross-origin sync is forbidden; use an authenticated same-origin server");
  if(url.username||url.password||url.hash)throw new Error("Credentials or URL fragments not allowed in sync endpoint");
  return url.pathname+url.search;
}
export function validateSyncResponse(data,operations){
  if(!data||typeof data!=="object"||Array.isArray(data)||
     !Array.isArray(data.applied)||!Array.isArray(data.conflicts)||
     data.applied.length>operations.length||data.conflicts.length>operations.length||
     JSON.stringify(data).length>1_000_000)
    throw new Error("Malformed sync response");
  const submitted=new Map(operations.map(x=>[x.record_id,x.op_id]));
  const acked=new Set(),conflicted=new Set();
  for(const ack of data.applied){
    if(!validId(ack?.record_id)||typeof ack.op_id!=="string"||
       !Number.isSafeInteger(ack.revision)||ack.revision<0||
       submitted.get(ack.record_id)!==ack.op_id||acked.has(ack.record_id))
      throw new Error("Unsolicited or malformed server acknowledgement");
    acked.add(ack.record_id);
  }
  for(const conflict of data.conflicts){
    if(!validId(conflict?.record_id)||!submitted.has(conflict.record_id)||
       conflicted.has(conflict.record_id)||acked.has(conflict.record_id))
      throw new Error("Unsolicited or malformed sync conflict");
    conflicted.add(conflict.record_id);
  }
  return data;
}
