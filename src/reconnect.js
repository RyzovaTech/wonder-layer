/**
 * Foreground-only sync with bounded exponential retry. No guaranteed background execution.
 * Never start automatically or contact a remote endpoint without the host app opting in.
 */
export function createReconnectController(sync,{
  win=globalThis,onStatus=()=>{},baseDelayMs=1500,maxDelayMs=120000
}={}){
  if(typeof sync!=="function")throw new TypeError("Expected sync function");
  if(!Number.isSafeInteger(baseDelayMs)||baseDelayMs<100||
     !Number.isSafeInteger(maxDelayMs)||maxDelayMs<baseDelayMs)
    throw new RangeError("Invalid retry bounds");
  let active=false,generation=0,failures=0,timer=null,inFlight=null,state="stopped";
  const canRun=()=>win.navigator?.onLine!==false&&win.document?.visibilityState!=="hidden";
  function notify(next,extra={}){
    state=next;
    onStatus({state:next,failures,active,...extra});
  }
  function cancelTimer(){
    if(timer!==null){win.clearTimeout?.(timer);timer=null;}
  }
  function schedule(ms){
    if(!active||!canRun())return;
    cancelTimer();
    timer=win.setTimeout?.(()=>{timer=null;void attempt();},ms)??null;
  }
  async function attempt(){
    if(!active||!canRun())return {state:"paused"};
    if(inFlight)return inFlight;
    const current=generation;
    notify("syncing");
    inFlight=(async()=>{
      try{
        const result=await sync();
        if(!active||current!==generation)return {state:"stopped"};
        failures=0;
        if((result?.conflicts?.length??0)>0){
          notify("conflict",{conflicts:result.conflicts,pending:result.pending??null});
        }else if(Number.isSafeInteger(result?.pending)&&result.pending>0){
          const applied=result.applied?.length??0;
          if(applied===0){
            notify("stalled",{pending:result.pending});
          }else{
            notify("pending",{pending:result.pending});
            schedule(baseDelayMs);
          }
        }else notify("idle",{pending:result?.pending??null});
        return result;
      }catch(error){
        if(active&&current===generation){
          failures++;
          const delay=Math.min(maxDelayMs,baseDelayMs*2**Math.min(failures-1,20));
          notify("retry",{delayMs:delay,error:String(error?.message??error)});
          schedule(delay);
        }
        return {state:"retry",error:String(error?.message??error)};
      }finally{inFlight=null;}
    })();
    return inFlight;
  }
  function onAvailable(){
    cancelTimer();
    if(!active)return;
    if(!canRun())notify("paused");
    else {failures=0;void attempt();}
  }
  function start(){
    if(active)return;
    active=true;generation++;failures=0;
    win.addEventListener?.("online",onAvailable);
    win.addEventListener?.("offline",onAvailable);
    win.document?.addEventListener?.("visibilitychange",onAvailable);
    if(canRun())void attempt();else notify("paused");
  }
  function stop(){
    if(!active)return;
    active=false;generation++;cancelTimer();
    win.removeEventListener?.("online",onAvailable);
    win.removeEventListener?.("offline",onAvailable);
    win.document?.removeEventListener?.("visibilitychange",onAvailable);
    notify("stopped");
  }
  return Object.freeze({start,stop,attempt,get state(){return state;},
    get active(){return active;},get retries(){return failures;}});
}

