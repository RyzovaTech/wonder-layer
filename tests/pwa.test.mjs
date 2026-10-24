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

test("parallel PWA registration joins one browser registration and installs listeners once",async()=>{
  const x=mock();
  let resolveRegister,registerCalls=0;
  x.env.navigator.serviceWorker.register=()=>{
    registerCalls++;
    return new Promise(resolve=>{resolveRegister=resolve;});
  };
  const pwa=createPWALifecycle({env:x.env});
  const first=pwa.register("./sw.js",{scope:"./"});
  const second=pwa.register("./sw.js",{scope:"./"});
  await Promise.resolve(); // Browser register starts on a microtask.
  assert.equal(registerCalls,1);
  resolveRegister(x.reg);
  const [a,b]=await Promise.all([first,second]);
  assert.strictEqual(a,x.reg);
  assert.strictEqual(b,x.reg);
  assert.equal(x.regEvents.size,1);
  assert.equal(x.swEvents.size,1);
  assert.equal(x.events.size,2);
  pwa.close();
  assert.equal(x.regEvents.size,0);
  assert.equal(x.swEvents.size,0);
  assert.equal(x.events.size,0);
});

test("closing during pending PWA registration does not install orphan listeners or unregister host worker",async()=>{
  const x=mock();
  let resolveRegister,unregisterCalls=0;
  x.reg.unregister=()=>{unregisterCalls++;};
  x.env.navigator.serviceWorker.register=()=>new Promise(resolve=>{resolveRegister=resolve;});
  const pwa=createPWALifecycle({env:x.env});
  const pending=pwa.register("./sw.js");
  await Promise.resolve();
  pwa.close();
  pwa.close(); // Idempotent teardown.
  resolveRegister(x.reg);
  await assert.rejects(pending,/closed during registration/);
  assert.equal(x.regEvents.size,0);
  assert.equal(x.swEvents.size,0);
  assert.equal(x.events.size,0);
  assert.equal(unregisterCalls,0,"SDK must not delete host-owned service-worker scope");
  await assert.rejects(pwa.register("./sw.js"),/closed/);
  await assert.rejects(pwa.checkForUpdate(),/closed/);
  assert.equal(pwa.activateWaiting(),false);
  assert.deepEqual(await pwa.requestInstall(),{available:false});
});

test("failed PWA registration can be explicitly retried without stale promise",async()=>{
  const x=mock();
  let calls=0;
  x.env.navigator.serviceWorker.register=async()=>{
    if(++calls===1)throw Error("temporary registration failure");
    return x.reg;
  };
  const pwa=createPWALifecycle({env:x.env});
  await assert.rejects(pwa.register("./sw.js"),/temporary registration failure/);
  assert.equal(pwa.registration,null);
  assert.strictEqual(await pwa.register("./sw.js"),x.reg);
  assert.equal(calls,2);
  pwa.close();
});
