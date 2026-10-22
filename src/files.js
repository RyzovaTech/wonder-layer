function root(){
  if(!globalThis.navigator?.storage?.getDirectory)throw new Error("OPFS unavailable");
  return navigator.storage.getDirectory();
}
function fileName(name){
  if(typeof name!=="string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(name) || name===".." || name===".")throw new Error("Invalid local filename");
  return name;
}
export async function writePrivateFile(name,content){
  const entry=await(await root()).getFileHandle(fileName(name),{create:true});
  const writer=await entry.createWritable();
  try{await writer.write(content);await writer.close();}
  catch(error){await writer.abort().catch(()=>{});throw error;}
}
export async function readPrivateFile(name){
  const entry=await(await root()).getFileHandle(fileName(name));
  return (await entry.getFile()).arrayBuffer();
}
export async function getStorageEstimate(){
  return await globalThis.navigator?.storage?.estimate?.()??null;
}

