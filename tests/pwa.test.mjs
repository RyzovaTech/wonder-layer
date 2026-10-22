import {test} from "node:test";
import assert from "node:assert/strict";
import {createPWALifecycle} from "../src/pwa.js";

function mock(){
  const events=new Map(),swEvents=new Map(),regEvents=new Map(),messages=[];
  let prompts=0,updates=0;
  const waiting={postMessage:msg=>messages.push(msg)};
  const reg={waiting,update:async()=>{updates++;},
    addEventListener:(name,fn)=>regEvents.set(name,fn),
    removeEventListener:name=>regEvents.delete(name)};
  const serviceWorker={controller:null,
    register:async()=>reg,
    addEventListener:(name,fn)=>swEvents.set(name,fn),
    removeEventListener:name=>swEvents.delete(name)};
  const env={isSecureContext:true,navigator:{serviceWorker},
    addEventListener:(name,fn)=>events.set(name,fn),
    removeEventListener:name=>events.delete(name),
    matchMedia:()=>({matches:false})};
  return {env,events,swEvents,regEvents,messages,reg,
    get prompts(){return prompts;},get updates(){return updates;},
    installEvent:{preventDefault(){},prompt:async()=>{prompts++;},
      userChoice:Promise.resolve({outcome:"accepted"})}};
}
test("service worker registration and update require explicit host actions",async()=>{
  const x=mock(),states=[];
  const pwa=createPWALifecycle({env:x.env,onState:s=>states.push(s.state)});
  assert.equal(pwa.inspect().waiting,false);
  assert.equal(x.messages.length,0);
  await pwa.register("./sw.js",{scope:"./"});
  assert.equal(pwa.inspect().waiting,true);
  assert.equal(x.messages.length,0);
  await pwa.checkForUpdate();
  assert.equal(x.updates,1);
  assert.equal(pwa.activateWaiting(),true);
  assert.deepEqual(x.messages,[{type:"WONDER_ACTIVATE_UPDATE"}]);
  pwa.close();
  assert.equal(x.events.size,0);
});
test("install prompt is stored until user-initiated request",async()=>{
  const x=mock(),pwa=createPWALifecycle({env:x.env});
  await pwa.register("./sw.js");
  x.events.get("beforeinstallprompt")(x.installEvent);
  assert.equal(x.prompts,0);
  assert.equal(pwa.inspect().installPromptAvailable,true);
  assert.deepEqual(await pwa.requestInstall(),{available:true,outcome:"accepted"});
  assert.equal(x.prompts,1);
  assert.deepEqual(await pwa.requestInstall(),{available:false});
  pwa.close();
});
test("unsupported and insecure worker contexts report errors",async()=>{
  const unavailable=createPWALifecycle({env:{navigator:{}}});
  await assert.rejects(unavailable.register("./sw.js"),/unavailable/);
  const x=mock();x.env.isSecureContext=false;
  await assert.rejects(createPWALifecycle({env:x.env}).register("./sw.js"),/secure/);
});

