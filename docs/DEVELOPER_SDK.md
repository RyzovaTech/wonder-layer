# Wonder Layer — Developer Integration Guide (Phase 5)

**Pure PWA first. One existing web application, no mandatory native wrapper.**

This is a pre-release SDK. Browser permissions, device/OS support and installed app behavior are still controlled by each browser. There is no silent installation, native privilege bypass or guaranteed background execution.

## Build and use a local npm tarball

From this repository:

```sh
npm run build
npm test
npm pack
```

The resulting `ryzova-wonder-layer-0.0.0-poc.1.tgz` is a local installation artifact, not an npm registry release. Inside your existing PWA project:

```sh
npm install /path/to/ryzova-wonder-layer-0.0.0-poc.1.tgz
```

The SDK archive includes all JavaScript modules, the real `compute.wasm` binary, worker module, and TypeScript declarations. It does not require React, Vue or native packaging.

## Vanilla JavaScript (fastest integration)

```js
import {createWonderLayer} from "@ryzova/wonder-layer";

// Call after DOM readiness, in a supported browser secure context (localhost or HTTPS).
const wonder=await createWonderLayer({dbName:"my-existing-pwa"});
try{
  const compute=await wonder.compute(new Float32Array([1,2,3]));
  console.log(compute.backend,compute.data);
  await wonder.store.save("draft","Local-first content");
  console.log(await wonder.recovery.storageStatus());
}finally{
  wonder.close();
}
```

For lazy SSR-compatible client creation, use `@ryzova/wonder-layer/client`:

```js
import {createWonderClient} from "@ryzova/wonder-layer/client";
const client=createWonderClient({dbName:"my-existing-pwa"});
const off=client.subscribe(({status,error})=>console.log(status,error));
const wonder=await client.start();
await wonder.store.save("draft","Edited on-device");
// On page/component teardown:
off();
client.dispose();
```

**Do not call `client.start()` in server-side rendering.** Module imports and client construction are inert.

## React

The lightweight adapter does not import or package React. Pass your application's React runtime explicitly:

```jsx
import * as React from "react";
import {createReactWonderBindings} from "@ryzova/wonder-layer/react";

const {WonderProvider,useWonderLayer}=createReactWonderBindings(React);
function Note(){
  const {status,layer,error}=useWonderLayer();
  return <button disabled={status!=="ready"}
    onClick={()=>layer?.store.save("draft","Local content")}>
      {status==="ready"?"Save offline":error?String(error):status}
    </button>;
}
export default function App(){
  return <WonderProvider options={{dbName:"my-app"}}><Note/></WonderProvider>;
}
```

Use a stable provider/client for the lifetime of your application. The provider starts the client in an effect and stops internally created clients on unmount. Passing a pre-created `client` means your app owns disposal. In StrictMode, effects can mount/cleanup more than once; the client guards superseded initialization.

## Vue 3

```js
import * as Vue from "vue";
import {createVueWonderBindings} from "@ryzova/wonder-layer/vue";
const {createWonderPlugin,useWonderLayer}=createVueWonderBindings(Vue);
const plugin=createWonderPlugin({dbName:"my-app"});
const app=Vue.createApp(MyApp);
app.use(plugin);
app.mount("#app");

// Inside a setup() function, useWonderLayer() returns {client,state}.
// Before tearing down the app, call plugin.dispose().
```

The plugin is client-only: install it after hydration rather than inside server-side rendering. Vue state is reactive; `state.status` becomes `"ready"` when a browser database opens.

## Browser-owned lifecycle and security

- The host PWA owns its service-worker scope. Register an existing service worker using `wonder.pwa.register("./sw.js",{scope:"./"})` only if the host does not already register that scope; otherwise integrate its update logic.
- Consent is required for hardware access. A capability inspection never requests permission. Call `wonder.hardware.request("camera",{video:true})` inside a user click handler, and stop acquired tracks on teardown.
- Keep data on-device by default. `wonder.sync()` and `wonder.reconnect(...).start()` are **explicit opt-in** and require your own authorized server endpoint and conflict policy.
- IndexedDB, OPFS and caches are scoped to the browser origin and may be cleared/evicted. Use backups with integrity metadata.
- Persistent storage requests are optional and do not guarantee data survival against user clearing.
- WebGPU depends on the GPU/adapter and browser. Validated JS/WASM/Worker fallbacks handle unsupported compute backends, but cannot make arbitrary cloud-only business logic offline.

## Integration acceptance checklist

1. Install the local tarball into an existing PWA without changing its routing or framework configuration.
2. Confirm the app builds and starts with Wonder Layer; inspect the bundle for unnecessary framework copies.
3. Open offline records, close/reopen browser and verify persistence on the intended browser/device.
4. Test the numerical accuracy, latency and fallback of each supported compute backend.
5. Explicitly request a supported hardware capability from a user click. Check denied/unsupported behavior.
6. Verify no extra overlapping service workers were registered by the SDK.
7. Run `npm test` and then the unrestricted browser acceptance runner on real supported devices.

## SDK lifecycle and size guardrails (Phase 8B)

- One `layer.pwa` lifecycle instance coalesces concurrent `register("./sw.js", {scope:"./"})` calls. Keep URL and scope consistent within that lifecycle.
- If `pwa.close()` occurs during an asynchronous browser registration, pending callers receive a descriptive error; no extra listeners are attached to the disposed instance. The SDK never silently unregisters a worker that the browser/host owns.
- `layer.close()` is safe to call repeatedly, and `createWonderClient().dispose()` releases the owned layer.
- `npm run size:check` rebuilds `dist` and checks a **512 KiB total raw SDK asset budget** and **96 KiB single JS asset budget**, including JS/WASM/types. These are *not* minified or gzipped browser bundle measurements.
- See [Phase 8B product quality](PHASE8B_SDK_PRODUCT_QUALITY.md) for experimental API/versioning expectations. All SDK public surfaces remain pre-release and not certified on physical mobile devices.

## Current development restrictions

The SDK package is **private:true**, and there is no selected RyzovaTech license. Do not publicly publish or market as production secure/multi-tenant sync. Release to npm requires a licensing, security, browser/device and versioning decision after full acceptance.

