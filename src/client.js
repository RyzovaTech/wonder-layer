import {createWonderLayer} from "./wonder.js";

/**
 * Lazy and SSR-safe resource controller. Importing this module never touches DOM,
 * hardware or IndexedDB; callers explicitly start it in the browser.
 */
export function createWonderClient(options={}, {factory=createWonderLayer}={}){
  if(typeof factory!=="function")throw new TypeError("Expected Wonder Layer factory");
  const listeners=new Set();
  let layer=null,loading=null,version=0,phase="idle",error=null,disposed=false;
  function snapshot(){return Object.freeze({status:phase,layer,error});}
  function broadcast(){
    const current=snapshot();
    for(const listener of listeners){
      try{listener(current);}catch{/* listeners must not break the SDK lifecycle */}
    }
  }
  function update(status,nextLayer=null,nextError=null){
    phase=status;layer=nextLayer;error=nextError;broadcast();
  }
  async function start(){
    if(disposed)throw new Error("Wonder client is disposed");
    if(layer)return layer;
    if(loading)return loading;
    const token=++version;
    update("loading");
    const pending=Promise.resolve().then(()=>factory(options)).then(created=>{
      if(!created||typeof created.close!=="function")
        throw new TypeError("Wonder factory must return a closeable SDK");
      if(disposed||token!==version){
        created.close();
        throw new Error("Wonder client initialization superseded");
      }
      update("ready",created);
      return created;
    }).catch(cause=>{
      if(!disposed&&token===version)update("error",null,cause);
      throw cause;
    }).finally(()=>{
      if(loading===pending)loading=null;
    });
    loading=pending;
    return pending;
  }
  function stop(){
    if(disposed)return;
    version++;
    const previous=layer;
    update("idle");
    previous?.close();
  }
  function dispose(){
    if(disposed)return;
    stop();
    disposed=true;
    update("disposed");
    listeners.clear();
  }
  function subscribe(listener,{emitCurrent=true}={}){
    if(typeof listener!=="function")throw new TypeError("Expected listener");
    if(disposed)throw new Error("Wonder client is disposed");
    listeners.add(listener);
    if(emitCurrent)listener(snapshot());
    return ()=>listeners.delete(listener);
  }
  return Object.freeze({start,stop,dispose,subscribe,snapshot,
    get status(){return phase;},get layer(){return layer;}});
}

