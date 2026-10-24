import {detectCapabilities,inspectCapabilities} from "./capabilities.js";
import {adaptiveCompute} from "./compute.js";
import {createAdaptiveEngine} from "./scheduler.js";
import {createHardwareBridge} from "./hardware.js";
import {openWonderStore} from "./store.js";
import {createForegroundSync} from "./lifecycle.js";
import {createReconnectController} from "./reconnect.js";
import {createPWALifecycle} from "./pwa.js";
import {createRecoveryManager} from "./recovery.js";
import {exportBackup,parseBackup} from "./backup.js";
import {readPrivateFile,writePrivateFile,getStorageEstimate} from "./files.js";

export async function createWonderLayer({dbName="ryzova-wonder",endpoint="/api/sync"}={}){
  const store=await openWonderStore(dbName);
  try{
  const engine=createAdaptiveEngine();
  const hardware=createHardwareBridge();
  const recovery=createRecoveryManager(store);
  const pwa=createPWALifecycle();
  async function sync(){return store.sync(endpoint);}
  let closed=false;
  function close(){
    if(closed)return;
    closed=true;
    try{pwa.close();}finally{store.close();}
  }
  return {
    runtime:"pure-pwa",
    capabilities:()=>detectCapabilities(),
    inspect:()=>inspectCapabilities(),
    compute:(input,options)=>engine.run(input,options),
    scheduler:engine,
    hardware,
    store,sync,
    recovery,pwa,
    reconnect:options=>createReconnectController(sync,options),
    foregroundSync:options=>createForegroundSync(sync,options),
    files:{read:readPrivateFile,write:writePrivateFile,estimate:getStorageEstimate},
    async backup(){return recovery.export();},
    async restore(payload,options){
      // Backward-compatible SDK return shape; integrity metadata is available
      // through wonder.recovery.restore(...) for callers that need it.
      const {imported,skipped}=await recovery.restore(payload,options);
      return {imported,skipped};
    },
    async requestPersistentStorage(){return !!(await globalThis.navigator?.storage?.persist?.());},
    close
  };
  }catch(error){
    // Storage opened successfully; do not leak its connection if a later
    // synchronous subsystem constructor throws during SDK initialization.
    store.close();
    throw error;
  }
}
export {detectCapabilities,inspectCapabilities} from "./capabilities.js";
export {adaptiveCompute,jsTransform,wasmTransform,gpuTransform,workerTransform,selectComputeOrder} from "./compute.js";
export {parseBackup,exportBackup} from "./backup.js";

export {createAdaptiveEngine} from "./scheduler.js";
export {createHardwareBridge,WonderHardwareError} from "./hardware.js";

export {createRecoveryManager,exportRecovery,parseRecovery} from "./recovery.js";
export {createReconnectController} from "./reconnect.js";
export {createPWALifecycle} from "./pwa.js";
