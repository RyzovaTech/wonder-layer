import {test} from "node:test";
import assert from "node:assert/strict";
import {createReconnectController} from "../src/reconnect.js";

function environment(){
  let nextId=0;
  const timers=new Map(),events=new Map(),docEvents=new Map();
  const win={
    navigator:{onLine:true},
    document:{visibilityState:"visible",
      addEventListener:(type,cb)=>docEvents.set(type,cb),
      removeEventListener:type=>docEvents.delete(type)},
    addEventListener:(type,cb)=>events.set(type,cb),
    removeEventListener:type=>events.delete(type),
    setTimeout:(fn,ms)=>{const id=++nextId;timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id)
  };
  const fireTimer=async()=>{
    const entry=timers.entries().next().value;
    if(!entry)throw Error("No timer");
    timers.delete(entry[0]);entry[1].fn();
    await new Promise(resolve=>setImmediate(resolve));
  };
  return {win,timers,events,docEvents,fireTimer};
}
const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));};
test("exponential retry bounds and reconnect recovery",async()=>{
  const x=environment(),observed=[];
  let calls=0;
  const controller=createReconnectController(async()=>{
    calls++;
    if(calls<3)throw Error("offline");
    return {applied:[{record_id:"x"}],pending:0,conflicts:[]};
  },{win:x.win,onStatus:event=>observed.push(event),baseDelayMs:200,maxDelayMs:300});
  controller.start();await flush();
  assert.equal(controller.state,"retry");
  assert.equal([...x.timers.values()][0].ms,200);
  await x.fireTimer();
  assert.equal([...x.timers.values()][0].ms,300);
  await x.fireTimer();
  assert.equal(controller.state,"idle");
  assert.equal(calls,3);
  assert.equal(x.timers.size,0);
  controller.stop();
  assert.equal(x.events.size,0);
  assert.equal(x.docEvents.size,0);
});
test("conflict stops retries until user resolves it",async()=>{
  const x=environment();let calls=0;
  const controller=createReconnectController(async()=>{
    calls++;return {conflicts:[{record_id:"a"}],pending:1,applied:[]};
  },{win:x.win});
  controller.start();await flush();
  assert.equal(controller.state,"conflict");
  assert.equal(x.timers.size,0);
  assert.equal(calls,1);
  controller.stop();
});
test("stalled sync does not busy-loop pending records",async()=>{
  const x=environment();
  const controller=createReconnectController(async()=>({applied:[],conflicts:[],pending:5}),{win:x.win});
  controller.start();await flush();
  assert.equal(controller.state,"stalled");
  assert.equal(x.timers.size,0);
  controller.stop();
});
test("offline and hidden tabs do not issue new remote requests",async()=>{
  const x=environment();let calls=0;
  x.win.navigator.onLine=false;
  const controller=createReconnectController(async()=>{calls++;return {pending:0};},{win:x.win});
  controller.start();await flush();
  assert.equal(calls,0);
  x.win.navigator.onLine=true;x.win.document.visibilityState="hidden";
  x.events.get("online")();await flush();
  assert.equal(calls,0);
  x.win.document.visibilityState="visible";
  x.docEvents.get("visibilitychange")();await flush();
  assert.equal(calls,1);
  controller.stop();
});
test("stopping while request is pending cannot create later retries",async()=>{
  const x=environment();
  let reject;
  const controller=createReconnectController(()=>new Promise((_,bad)=>{reject=bad;}),{win:x.win});
  controller.start();
  controller.stop();
  reject(Error("network lost"));
  await flush();
  assert.equal(x.timers.size,0);
  assert.equal(controller.state,"stopped");
});
test("double start remains idempotent",async()=>{
  const x=environment();let calls=0;
  const controller=createReconnectController(async()=>{calls++;return {pending:0};},{win:x.win});
  controller.start();controller.start();await flush();
  assert.equal(calls,1);controller.stop();
});

