/**
 * Host-owned, opt-in service-worker registration and safe update coordination.
 * Does not auto reload, prompt for installation, or skip waiting by default.
 */
export function createPWALifecycle({env=globalThis,onState=()=>{}}={}){
  const navigator=env.navigator??{};
  let registration=null,deferredInstall=null,installed=false;
  const listeners=[];
  function emit(state,info={}){onState({state,...info});}
  function listen(target,type,handler){
    target?.addEventListener?.(type,handler);
    listeners.push(()=>target?.removeEventListener?.(type,handler));
  }
  const onPrompt=event=>{
    event.preventDefault?.();
    deferredInstall=event;
    emit("install-available");
  };
  const onInstalled=()=>{installed=true;deferredInstall=null;emit("installed");};
  function watchInstall(){
    listen(env,"beforeinstallprompt",onPrompt);
    listen(env,"appinstalled",onInstalled);
  }
  function inspect(){
    return {
      serviceWorker:"serviceWorker" in navigator,
      controlled:!!navigator.serviceWorker?.controller,
      waiting:!!registration?.waiting,
      standalone:env.matchMedia?.("(display-mode: standalone)")?.matches===true||
        navigator.standalone===true,
      installPromptAvailable:!!deferredInstall,installed
    };
  }
  async function register(url,{scope}={}){
    if(!navigator.serviceWorker?.register)throw new Error("Service worker unavailable");
    if(!env.isSecureContext && env.isSecureContext!==undefined)
      throw new Error("Service workers require secure origin");
    if(registration)return registration;
    registration=await navigator.serviceWorker.register(url,{...(scope?{scope}:{})});
    listen(registration,"updatefound",()=>emit("update-found"));
    listen(navigator.serviceWorker,"controllerchange",()=>emit("controller-changed"));
    watchInstall();
    emit("registered",{waiting:!!registration.waiting});
    return registration;
  }
  async function checkForUpdate(){
    if(!registration)throw new Error("Register a service worker first");
    await registration.update();
    return inspect();
  }
  function activateWaiting(){
    // Host must explicitly call after saving unsynced drafts and securing user consent.
    if(!registration?.waiting)return false;
    registration.waiting.postMessage({type:"WONDER_ACTIVATE_UPDATE"});
    emit("update-activation-requested");
    return true;
  }
  async function requestInstall(){
    if(!deferredInstall)return {available:false};
    const prompt=deferredInstall;deferredInstall=null;
    await prompt.prompt();
    const choice=await prompt.userChoice;
    emit("install-choice",{outcome:choice?.outcome??"unknown"});
    return {available:true,outcome:choice?.outcome??"unknown"};
  }
  function close(){
    for(const release of listeners.splice(0))release();
    deferredInstall=null;
  }
  return Object.freeze({register,inspect,checkForUpdate,activateWaiting,
    requestInstall,close,get registration(){return registration;}});
}

