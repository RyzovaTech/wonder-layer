# Ryzova Wonder Layer

**One Web App. Maximum practical native-like power. Pure PWA first.**

Ryzova Wonder Layer is a framework-independent experimental SDK for giving existing Progressive Web Apps access to the best available modern web capabilities, with runtime fallback and realistic browser boundaries.

> **Engineering baseline, not a production release.** Browser acceptance and actual WebGPU hardware execution are not yet verified. A browser SDK cannot bypass device permissions, guarantee indefinite background execution, or silently install applications.

## Phase 5 — Universal Developer SDK package

Wonder Layer now has a **dependency-free, tree-shakeable ESM distribution** with TypeScript declarations, React and Vue integration adapters and a testable npm package archive. The package is **private / pre-release** until RyzovaTech selects the commercial or open-source license and authorizes publication.

```sh
npm run build        # generates dist with actual WASM and Worker assets
npm test             # automatically rebuilds, then runs SDK/package tests
npm pack             # creates a local SDK tarball for testing, NOT a registry publication
```

After `npm pack`, install the resulting `ryzova-wonder-layer-0.0.0-poc.1.tgz` into an existing PWA project with `npm install ./path/to/ryzova-wonder-layer-0.0.0-poc.1.tgz`. Import from `@ryzova/wonder-layer` or the optional `/client`, `/react`, `/vue` paths.

```js
import {createWonderLayer} from "@ryzova/wonder-layer";
const wonder=await createWonderLayer({dbName:"my-pwa"});
const result=await wonder.compute(new Float32Array([1,2,3]));
console.log(result.backend);
wonder.close();
```

**Do not initialize IndexedDB inside server-side rendering.** Use the lazy `createWonderClient` API or framework helpers after hydration. Framework helpers accept the application-provided React/Vue runtime so the SDK does not bundle or duplicate frameworks.

See [Developer integration guide](docs/DEVELOPER_SDK.md), [Release checklist](docs/PHASE5_RELEASE_READINESS.md), and [framework examples](examples/frameworks/).

## SDK overview

- **Adaptive compute:** real WebGPU WGSL shader, compiled WebAssembly kernel, Web Workers, and JavaScript fallback
- **Offline storage:** IndexedDB records + operation outbox; user-managed backup export/import and origin-private OPFS files
- **Capability inspection:** detects Web APIs and checks GPU adapter availability separately from mere API presence
- **PWA lifecycle:** host app owns its service worker and permissions; no native packaging required
- **Foreground sync:** a retry-capable local outbox. The demo does **not** contact an unauthenticated public backend.

## Phase 3 — Capability engine (engineering implementation)

- **Adaptive scheduler:** size-based backend selection, responsive Worker priority, validated results, numerical failover, backend cooldown, execution telemetry, cooperative AbortSignal support.
- **Explicit hardware bridge:** camera, microphone, geolocation, Bluetooth, USB, HID, Serial, NFC, clipboard, sharing, screen wake lock and local file-picker (where supported).
- **No implicit permissions:** hardware is only requested after host app explicitly invokes `wonder.hardware.request(...)` from a user action.
- **SDK integration:** `wonder.compute(input, {policy: "responsive"})`, `wonder.scheduler.inspect()`, `wonder.scheduler.stats()`, `wonder.hardware.capabilities()`.
- **Boundaries:** adapter readiness is not execution proof; browser APIs are permission- and platform-dependent. No native wrapper, background-runtime guarantee or silent hardware access.

See [Phase 3 architecture and tests](docs/PHASE3_CAPABILITY_ENGINE.md).

## Phase 4 — Offline reliability

- Atomic multi-record IndexedDB import (existing records preserved unless overwrite is explicit).
- SHA-256 integrity checks for version 2 backup/recovery snapshots; version 1 backups remain importable with `legacy-unverified` status.
- Opt-in persistent-storage requests and storage quota warnings; no eviction guarantee.
- Bounded exponential reconnect retry, foreground-only and disabled by default.
- Service Worker lifecycle with manual update activation; never silently replace a running app during an active session.
- The sample app includes storage usage, persistence requests and update controls. **It never automatically sends local notes to an arbitrary server.**

See [Phase 4 engineering notes](docs/PHASE4_OFFLINE.md).

## Run the existing-PWA integration example

Requirements: Python 3 and an unrestricted browser.

```sh
python3 -m http.server 8765
```

Visit: `http://127.0.0.1:8765/examples/basic-pwa/`

This sample uses Wonder Layer in a standalone PWA with an offline notebook, data backup, capability diagnostics and adaptive compute. It does not install a native wrapper.

See [integration instructions](docs/INTEGRATION.md), [architecture](docs/ARCHITECTURE.md), [browser acceptance](docs/BROWSER_ACCEPTANCE.md) and [security notes](SECURITY.md).

## Developer SDK example

```js
import { createWonderLayer } from "@ryzova/wonder-layer";
const wonder = await createWonderLayer({ dbName: "my-web-app" });
await wonder.store.save("draft-1", "This stays on-device.");
const result = await wonder.compute(new Float32Array([1,2,3]));
console.log(result.backend, result.data);
```

Before running locally via bare import specifiers, install/publish the package or use a browser-compatible relative import as the demo does.

```sh
npm test
```

Tests are designed to run under Node 20 and 22. Tests passing in Node are **not** evidence of real-browser installation, offline restart, WebGPU performance, or native parity.

## Product boundary

The SDK makes browser capabilities more accessible. It cannot create unsupported native OS privileges. Cloud-only apps still require application-level offline data/logic design. No license has yet been selected; commercial or open-source permission must not be inferred.
