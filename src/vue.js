import {createWonderClient} from "./client.js";

/**
 * Vue 3 adapter; caller supplies its own Vue runtime.
 * No global singleton, no implicit hardware access and SSR-safe imports.
 */
export function createVueWonderBindings(Vue){
  if(typeof Vue?.reactive!=="function"||typeof Vue?.inject!=="function")
    throw new TypeError("Vue 3 reactive and inject APIs are required");
  const key=Symbol("RyzovaWonderLayer");
  function createWonderPlugin(options={}, {client:externalClient}={}){
    const client=externalClient??createWonderClient(options);
    const state=Vue.reactive({...client.snapshot()});
    const unsubscribe=client.subscribe(next=>{
      state.status=next.status;
      state.layer=next.layer;
      state.error=next.error;
    });
    const context=Object.freeze({client,state});
    let installed=false;
    return Object.freeze({
      install(app){
        if(installed)throw new Error("Wonder plugin already installed");
        if(typeof app?.provide!=="function")throw new TypeError("Vue app.provide required");
        installed=true;
        app.provide(key,context);
        void client.start().catch(()=>{});
      },
      async start(){return client.start();},
      stop(){client.stop();},
      dispose(){
        unsubscribe();
        if(externalClient)client.stop();
        else client.dispose();
      },
      get state(){return state;},
      get client(){return client;}
    });
  }
  function useWonderLayer(){
    const context=Vue.inject(key,null);
    if(!context)throw new Error("useWonderLayer requires app.use(wonderPlugin)");
    return context;
  }
  return Object.freeze({createWonderPlugin,useWonderLayer,key});
}

