import {test} from "node:test";
import assert from "node:assert/strict";
import {createWonderClient} from "../src/client.js";

const tick=()=>new Promise(resolve=>setImmediate(resolve));
test("SDK controller import is inert until start and concurrent starts share init",async()=>{
  let opened=0,closed=0;
  const mock={close(){closed++;}};
  const client=createWonderClient({dbName:"test"},{
    factory:async(options)=>{opened++;assert.equal(options.dbName,"test");await tick();return mock;}
  });
  assert.equal(client.status,"idle");
  assert.equal(opened,0);
  const seen=[];const unsubscribe=client.subscribe(s=>seen.push(s.status));
  const [first,second]=await Promise.all([client.start(),client.start()]);
  assert.strictEqual(first,mock);assert.strictEqual(second,mock);
  assert.equal(opened,1);
  assert.deepEqual(seen,["idle","loading","ready"]);
  assert.equal(client.status,"ready");
  unsubscribe();
  client.stop();
  assert.equal(closed,1);
  assert.equal(client.status,"idle");
});
test("stop during pending initialization closes late-created layer, not leaking resources",async()=>{
  let finish;let closed=0;
  const client=createWonderClient({},{
    factory:()=>new Promise(resolve=>{finish=resolve;})
  });
  const pending=client.start();
  await tick();
  client.stop();
  finish({close(){closed++;}});
  await assert.rejects(pending,/superseded/);
  assert.equal(closed,1);
  assert.equal(client.status,"idle");
});
test("retry after init failure and safe dispose",async()=>{
  let calls=0,closes=0;
  const client=createWonderClient({},{
    factory:async()=>{
      if(++calls===1)throw Error("IndexedDB denied");
      return {close(){closes++;}};
    }
  });
  await assert.rejects(client.start(),/IndexedDB denied/);
  assert.equal(client.snapshot().error.message,"IndexedDB denied");
  await client.start();
  assert.equal(client.status,"ready");
  client.dispose();
  assert.equal(closes,1);
  assert.equal(client.status,"disposed");
  assert.throws(()=>client.subscribe(()=>{}),/disposed/);
  await assert.rejects(client.start(),/disposed/);
});
test("misbehaving subscribers do not interrupt lifecycle",async()=>{
  const client=createWonderClient({},{
    factory:async()=>({close(){}})
  });
  client.subscribe(()=>{throw Error("listener")});
  const states=[];client.subscribe(s=>states.push(s.status));
  await client.start();
  assert.deepEqual(states,["idle","loading","ready"]);
  client.dispose();
});


test("StrictMode-style stop/restart creates a fresh client without retaining stale promise",async()=>{
  let firstResolve,secondResolve,opened=0,closed=0;
  const client=createWonderClient({}, {factory:async()=>{
    opened++;
    return new Promise(resolve=>{
      if(opened===1)firstResolve=resolve;
      else secondResolve=resolve;
    });
  }});
  const first=client.start();
  await tick();
  client.stop();
  const second=client.start();
  await tick();
  assert.equal(opened,2);
  secondResolve({close(){closed++;}});
  const layer=await second;
  assert.equal(client.status,"ready");
  firstResolve({close(){closed++;}});
  await assert.rejects(first,/superseded/);
  assert.equal(client.layer,layer);
  assert.equal(closed,1);
  client.dispose();
  assert.equal(closed,2);
});
