import {test} from "node:test";
import assert from "node:assert/strict";
import {createForegroundSync} from "../src/lifecycle.js";

function fakeWindow(){
  const listeners=new Map(),docListeners=new Map(),timers=new Map();
  let last=0;
  const env={
    navigator:{onLine:true},
    document:{
      visibilityState:"visible",
      addEventListener:(name,fn)=>docListeners.set(name,fn),
      removeEventListener:name=>docListeners.delete(name)
    },
    addEventListener:(name,fn)=>listeners.set(name,fn),
    removeEventListener:name=>listeners.delete(name),
    setInterval:(fn,interval)=>{timers.set(++last,{fn,interval});return last;},
    clearInterval:id=>timers.delete(id)
  };
  return {env,listeners,docListeners,timers};
}
const tick=async()=>{await Promise.resolve();await Promise.resolve();};
test("foreground sync runs while online and visible, then stops cleanly",async()=>{
  const f=fakeWindow();let calls=0,states=[];
  const sync=createForegroundSync(async()=>{calls++;return {pending:0};},{
    win:f.env,intervalMs:1000,onStatus:s=>states.push(s)
  });
  sync.start();
  await tick();
  assert.equal(calls,1);
  assert.equal(states.at(-1).state,"synced");
  f.env.navigator.onLine=false;
  await f.listeners.get("online")();
  assert.equal(calls,1);
  f.env.navigator.onLine=true;
  f.env.document.visibilityState="hidden";
  await f.docListeners.get("visibilitychange")();
  assert.equal(calls,1);
  f.env.document.visibilityState="visible";
  await f.docListeners.get("visibilitychange")();
  await tick();
  assert.equal(calls,2);
  sync.stop();
  assert.equal(sync.active,false);
  assert.equal(f.listeners.size,0);
  assert.equal(f.docListeners.size,0);
  assert.equal(f.timers.size,0);
});
test("network failures are reported as retry, not success",async()=>{
  const f=fakeWindow();const states=[];
  const sync=createForegroundSync(async()=>{throw new Error("temporary network failure");},{
    win:f.env,onStatus:s=>states.push(s)
  });
  sync.start();await tick();
  assert.equal(states.at(-1).state,"retry");
  assert.match(states.at(-1).error,/temporary network failure/);
  sync.stop();
});
test("foreground sync is not a guaranteed background task",async()=>{
  const f=fakeWindow();f.env.document.visibilityState="hidden";
  let calls=0;
  const sync=createForegroundSync(async()=>{calls++;},{win:f.env});
  sync.start();await tick();
  assert.equal(calls,0);
  sync.stop();
});
