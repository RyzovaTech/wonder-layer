export function exportBackup(records){
  if(!Array.isArray(records))throw new Error("Invalid records");
  return JSON.stringify({format:"ryzova-wonder-backup",version:1,records:records.map(({id,content})=>({id,content}))});
}
export function parseBackup(raw){
  if(typeof raw!=="string" || raw.length>12_000_000)throw new Error("Backup size exceeds limit");
  const backup=JSON.parse(raw);
  if(backup?.format!=="ryzova-wonder-backup" || backup.version!==1 || !Array.isArray(backup.records) || backup.records.length>20000)
    throw new Error("Unsupported backup format");
  const ids=new Set();
  for(const item of backup.records){
    if(typeof item?.id!=="string" || !item.id || item.id.length>120 || typeof item.content!=="string" || item.content.length>100000 || ids.has(item.id))
      throw new Error("Invalid or duplicate backup entry");
    ids.add(item.id);
  }
  return backup.records;
}

