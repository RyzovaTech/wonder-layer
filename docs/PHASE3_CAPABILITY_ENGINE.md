# Phase 3 — Maximum Practical Browser Capabilities

## Intent

One existing PWA, one adaptive SDK layer, no native rewrite. Feature availability varies by browser, platform, permissions, hardware and site security. **Wonder Layer does not remove browser limits.**

### Adaptive scheduler

```js
import {createWonderLayer} from "@ryzova/wonder-layer";
const wonder=await createWonderLayer({dbName:"my-app"});
const results=await wonder.compute(new Float32Array(65536).fill(2),{
  policy:"responsive" // or "throughput"
});
console.log(results.backend,results.failures,results.durationMs);
console.log(wonder.scheduler.stats());
```

- Throughput: for large vectors prefer WebGPU (if exposed), WASM, Worker, JS.
- Responsive: prioritize Worker when size reaches threshold; runtime fallback if the Worker is unavailable.
- Only finite Float32 input / gain / bias is supported; max vector size defaults to 4 million elements.
- Every result is validated against a numerical reference; invalid outputs fail over to the next backend.
- Individual backend failures are cooled down temporarily; explicit `prefer` forces only that backend.
- `await wonder.scheduler.inspect({refresh:true})` checks GPU adapter readiness, not execution performance.
- `AbortSignal` stops before/after backend operations and cancels Worker operations; GPU dispatch/WASM running synchronously cannot be preempted by the JS wrapper.
- `await wonder.scheduler.calibrate(input,{samples:2})` explicitly measures eligible backend end-to-end execution and validates each result. If every planned backend has a verified sample, throughput scheduling can order by its measured latency.
- Latency metrics are local, in-memory and workload-size-bucketed; calibration is opt-in and can be expensive. It does not automatically request device permissions. Do not interpret one calibration as a cross-device benchmark. End-to-end browser benchmarking is required.

### Permission-gated hardware

```js
const available=wonder.hardware.capabilities(); // never prompts
cameraButton.addEventListener("click",async()=>{
  const stream=await wonder.hardware.request("camera",{video:true});
  try{ /* host app uses stream */ }
  finally{stream.getTracks().forEach(track=>track.stop());}
});
```

Support names: `camera`, `microphone`, `geolocation`, `bluetooth`, `usb`, `hid`, `serial`, `nfc`, `clipboard-read`, `clipboard-write`, `share`, `wake-lock`, `file-open`.

- Caller must initiate privileged calls from explicit user interactions and supply filters/arguments where required.
- Browsers may reject for permissions, no user activation, device absence, policy restrictions or unsupported APIs.
- Typed `WonderHardwareError` codes distinguish `UNSUPPORTED`, `INSECURE_CONTEXT`, `PERMISSION_DENIED`, `INVALID_OPTIONS`, `CANCELLED`, `NOT_FOUND`, `DEVICE_ERROR`.
- `capabilities()` means API exposure, not permission granted or physical device availability.
- Caller owns resource lifecycle: camera/mic tracks must be stopped, wake locks released, serial/USB devices closed after use.
- The demo does **not** store geolocation coordinates or camera frames.

### Engineering checks

```bash
npm test
npm run test:phase3
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/examples/basic-pwa/` to exercise the adaptive compute plan and explicit hardware prompts.

Unit and simulated contract checks validate SDK logic only. **Phase 3 browser/hardware acceptance remains part of the full-device evaluation after implementation**, including WebGPU dispatch, WASM correctness, lifecycle, permission denial, Safari/Firefox limitations and network-offline behavior. GitHub Actions runners must also become operational before release.
