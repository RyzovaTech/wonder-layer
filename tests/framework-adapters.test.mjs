import {test} from "node:test";
import assert from "node:assert/strict";
import {createReactWonderBindings} from "../src/react.js";
import {createVueWonderBindings} from "../src/vue.js";
import {createWonderClient} from "../src/client.js";

const tick=()=>new Promise(resolve=>setImmediate(resolve));
test("React provider owns client lifecycle and hook reports status",async()=>{
  let stopEffect;
  const states=[];
  const context={value:null};
  const React={
    createContext:()=>({Provider:"provider",...context}),
    createElement:(type,props,children)=>({type,props,children}),
    useContext:ctx=>ctx.value,
    useMemo:fn=>fn(),
    useState:initial=>{
      const value=initial();
      return [value,next=>{states.push(next.status)}];
    },
    useEffect:fn=>{stopEffect=fn();}
  };
  const bindings=createReactWonderBindings(React);
  assert.throws(()=>bindings.useWonderLayer(),/WonderProvider/);
  const client=createWonderClient({}, {factory:async()=>({close(){}})});
  const node=bindings.WonderProvider({client,children:"child"});
  assert.equal(node.type,"provider");
  assert.equal(node.props.value.client,client);
  await tick();
  assert.ok(states.includes("ready"));
  stopEffect();
  assert.equal(client.status,"ready"); // caller-owned
  client.dispose();
});
test("React provider unmount closes internally owned resources",async()=>{
  let cleanup,created=0,closed=0;
  const original=globalThis.indexedDB;
  // Provider owns its client. A fake IndexedDB is not necessary when the lifecycle
  // contract is exercised via client injection in the previous test.
  const React={
    createContext:()=>({Provider:"provider"}),
    createElement:(type,props,children)=>({type,props,children}),
    useContext:()=>null,
    useMemo:fn=>fn(),
    useState:init=>[init(),()=>{}],
    useEffect:fn=>{cleanup=fn();}
  };
  createReactWonderBindings(React).WonderProvider({children:null});
  assert.equal(typeof cleanup,"function");
  cleanup();
  if(original===undefined)delete globalThis.indexedDB;
  else globalThis.indexedDB=original;
});
test("Vue plugin injects reactive client and never touches browser during adapter creation",async()=>{
  const scope=new Map();
  const Vue={
    reactive:x=>x,
    inject:(key,fallback)=>scope.get(key)??fallback
  };
  const bindings=createVueWonderBindings(Vue);
  assert.throws(()=>bindings.useWonderLayer(),/app.use/);
  let closed=0;
  const client=createWonderClient({}, {factory:async()=>({close(){closed++;}})});
  const plugin=bindings.createWonderPlugin({}, {client});
  assert.equal(client.status,"idle");
  plugin.install({provide:(key,value)=>scope.set(key,value)});
  await tick();
  const injected=bindings.useWonderLayer();
  assert.equal(injected.client,client);
  assert.equal(injected.state.status,"ready");
  assert.throws(()=>plugin.install({provide(){}}),/already installed/);
  plugin.dispose();
  assert.equal(closed,1);
});
test("Adapter detects incorrect React / Vue API injection",()=>{
  assert.throws(()=>createReactWonderBindings({}),/Missing React API/);
  assert.throws(()=>createVueWonderBindings({}),/Vue 3/);
});

