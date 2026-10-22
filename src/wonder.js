import {detectCapabilities,inspectCapabilities} from "./capabilities.js";
import {adaptiveCompute} from "./compute.js";
import {openWonderStore} from "./store.js";
import {createForegroundSync} from "./lifecycle.js";
import {exportBackup,parseBackup} from "./backup.js";
import {readPrivateFile,writePrivateFile,getStorageEstimate} from "./files.js";

export async function createWonderLayer({dbName="ryzova-wonder",endpoint="/api/sync"}={}){
  const store=await openWonderStore(dbName);
  async function sync(){return store.sync(endpoint);}
  return {
    runtime:"pure-pwa",
    capabilities:()=>detectCapabilities(),
    inspect:()=>inspectCapabilities(),
    compute:(input,options)=>adaptiveCompute(input,options),
    store,sync,
    foregroundSync:options=>createForegroundSync(sync,options),
    files:{read:readPrivateFile,write:writePrivateFile,estimate:getStorageEstimate},
    async backup(){return exportBackup(await store.listRecords());},
    async restore(payload,{overwrite=false}={}){
      const rows=parseBackup(payload),existing=new Set((await store.listRecords()).map(x=>x.id));
      let imported=0,skipped=0;
      for(const row of rows){
        if(!overwrite&&existing.has(row.id)){skipped++;continue;}
        await store.save(row.id,row.content);imported++;existing.add(row.id);
      }
      return {imported,skipped};
    },
    async requestPersistentStorage(){return !!(await globalThis.navigator?.storage?.persist?.());},
    close:()=>store.close()
  };
}
export {detectCapabilities,inspectCapabilities} from "./capabilities.js";
export {adaptiveCompute,jsTransform,wasmTransform,gpuTransform,workerTransform,selectComputeOrder} from "./compute.js";
export {parseBackup,exportBackup} from "./backup.js";

