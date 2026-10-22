export function createForegroundSync(sync,{win=globalThis,intervalMs=10000,onStatus=()=>{}}={}){
  if(typeof sync!=="function")throw new TypeError("sync must be a function");
  let active=false,running=false,timer=null;
  const online=()=>win.navigator?.onLine!==false;
  async function attempt(){
    if(!active||running||!online()||win.document?.visibilityState==="hidden")return;
    running=true;
    try{onStatus({state:"synced",result:await sync()});}
    catch(error){onStatus({state:"retry",error:String(error?.message??error)});}
    finally{running=false;}
  }
  function start(){
    if(active)return;
    active=true;
    win.addEventListener?.("online",attempt);
    win.document?.addEventListener?.("visibilitychange",attempt);
    timer=win.setInterval?.(attempt,Math.max(1000,intervalMs));
    void attempt();
  }
  function stop(){
    if(!active)return;
    active=false;
    win.removeEventListener?.("online",attempt);
    win.document?.removeEventListener?.("visibilitychange",attempt);
    win.clearInterval?.(timer);timer=null;
  }
  return {start,stop,attempt,get active(){return active;}};
}

