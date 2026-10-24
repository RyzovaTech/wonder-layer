# Phase 8B — SDK Product Quality: Lifecycle, Size, Stability

**Status:** Engineering quality work, not a public release or stable API designation. Baseline: Phase 8A merge `57934d206fcebee3894b12340ded39daa3131992`. Target package remains `@ryzova/wonder-layer@0.0.0-poc.1` with `private: true`.

## Product-quality objectives

1. Make client integration safe under repeated mounts, registration concurrency and teardown.
2. Supply measurable **distribution asset** size checks without false claims about minified customer bundle size or performance.
3. Specify an experimental API contract, semantic-versioning discipline and migration expectations.
4. Keep Vanilla/React/Vue consumers and hosted cross-browser acceptance as exact-head CI requirements.
5. Preserve security and release gates; none of this authorizes public npm publication, license use or physical-device certification.

## Implementation: lifecycle guarantees

- `createPWALifecycle().register(url, {scope})` coalesces concurrent calls **on the same lifecycle instance** to one browser registration. Repeated calls after success reuse the registration. The host must choose a consistent service worker URL and scope for the lifetime of that instance.
- On registration failure, a later explicit attempt can retry. The rejected request is not held forever.
- `pwa.close()` is idempotent: event listeners are removed, the deferred install prompt is cleared and a later registration/update attempt fails with a descriptive closed-lifecycle error. If the async browser registration resolves *after* `close()`, the SDK does **not** attach listeners and rejects its pending request rather than reviving a disposed instance.
- **Critical ownership contract:** closing the SDK does **not** call `ServiceWorkerRegistration.unregister()`. A registered Service Worker belongs to the **host PWA and browser origin**, not the SDK instance. The host app decides when/if it unregisters its worker.
- `createWonderLayer().close()` is idempotent and makes a best effort to release both PWA listeners and the IndexedDB connection. If a synchronous subsystem constructor fails after opening the store, the opened connection is closed.
- These guarantees do not promise successful service-worker installation if the browser denies it, caches fail, scope conflicts exist, or runtime policy forbids installation.

### Host example — explicit register and cleanup

```js
import {createWonderClient} from "@ryzova/wonder-layer/client";

const client=createWonderClient({dbName:"field-notes"});
try{
  // In a browser only, after page/client initialization (never during SSR).
  const layer=await client.start();
  // Your own app owns the service-worker scope.
  await layer.pwa.register("./sw.js",{scope:"./"});
  await layer.store.save("note-1","Draft stored locally");
  console.log(await layer.recovery.storageStatus());
}finally{
  // Release SDK listeners, resources and database handles.
  // Host controls its already-registered service worker.
  client.dispose();
}
```

For React, `createReactWonderBindings(React)` manages its internal client across provider mounting; a provided external client remains caller-owned. For Vue 3, `createVueWonderBindings(Vue)` manages the injected state and `plugin.dispose()` on application teardown. No framework runtime is bundled.

## Distribution size budget: accurate definitions

Run:

```sh
npm run size:check
```

This rebuilds `dist/` and executes `tools/sdk-size-report.mjs`. The same `dist` inspection runs as part of `npm test` through `tests/sdk-size-report.test.mjs`.

| Metric | Current policy | Measurement |
| --- | --- | --- |
| All copied `dist` assets combined | At most **512 KiB** | Sum of raw JS, declaration, WASM and metadata file bytes |
| Largest individual JavaScript file | At most **96 KiB** | Raw uncompressed bytes of each JS asset |
| Required entrypoint/worker/WASM/types | All present | Mandatory asset inventory |
| Public release permissions | Always false | Package `private:true` checked before size report |

**Scope caveat:** These are **guardrail ceilings** for internal distribution growth, **not** the actual downloaded bytes for a user, gzip/brotli sizes, minified bundle size, parse time, memory usage, runtime performance, WebGPU parity or claimed comparative market advantage. For a credible developer comparison, Phase 8C must record a real independent consumer's bundler output and feature-specific modules used, plus test environment and source hash.

Known baseline inventory (2026-10-24 audit of main `src/` + `types/` files **before Phase 8B build**, not a `dist/` CI result): approximately **67,312 raw bytes** across 22 source/type assets; exact `dist` report must be generated in CI. Do not publish this as a customer bundle-size benchmark.

## Experimental API and versioning policy

- Until formal release approval, every exported SDK entrypoint and method is **experimental**. The current `0.0.0-poc.1` version remains unchanged; adding a size-check script or fixing races does not authorize a version bump.
- After license + independent security + real-device gates and an explicit product decision, adopt standard semantic versioning: **patch** for backward-compatible bug fixes, **minor** for backward-compatible features, **major** for breaking behavior. Pre-1.0 APIs require specially documented compatibility expectations; no implicit commitment is made yet.
- Keep `@ryzova/wonder-layer`, `/client`, `/react` and `/vue` exports synchronized with their public `.d.ts` definitions and consumer builds. If a breaking change is proposed, it must include migration examples, TypeScript compile tests, browser acceptance changes, reviewer approval and an explicit changelog entry.
- Public API errors should be actionable; unsupported browser APIs and denied permissions must be distinguished in UI. Do not silently retry hardware prompts, auto-sync private records, or swallow security boundaries.
- Browser APIs remain controlled by host origin/permissions. The application owns `sw.js`, CSP, authentication, data deletion policy and consent UX.
- `npm pack` is a **local internal test archive** only. `private:true`, license and external sign-off gates remain unchanged.

## Verification matrix and acceptance

- [x] Add regression tests for concurrent SW registration and one set of event listeners.
- [x] Add regression tests for close while SW registration is pending, retry after failure and no implicit SW unregister.
- [x] Add regression test for repeated top-level SDK close releasing storage once.
- [x] Add deterministic size-budgets tests for missing/duplicate/unsafe paths and excessive sizes.
- [x] Wire a real `dist` size-check to the SDK package test suite and a `size:check` npm script.
- [ ] Verify Node 20/22 **exact PR head** `npm test`/release gate; no test runs claimed until CI completes.
- [ ] Verify packed external Vanilla/React/Vue TypeScript consumer and hosted Chromium/Firefox/WebKit/Edge/macOS browser acceptance at exact PR head.
- [ ] Verify CodeQL and runtime dependency audit, then PR merge and independent post-merge main CI.
- [ ] Verify physical Android/iOS and real peripherals, independent human review and Linux latest-head CI **separately**, not through hosted emulation.
- [ ] Collect external developer integration time, shipped bundled size, performance and feedback **only after testers actually participate**.

### Remaining release blockers

See [#19](https://github.com/RyzovaTech/wonder-layer/issues/19) for device/review/release gates, [#6](https://github.com/RyzovaTech/wonder-layer/issues/6) for Linux CI and intermittent service-worker acceptance, [#17](https://github.com/RyzovaTech/wonder-layer/issues/17) for production-sync security, [#18](https://github.com/RyzovaTech/wonder-layer/issues/18) for licensing, and [#21](https://github.com/RyzovaTech/wonder-layer/issues/21) for branch protection.

**Never equate a green CI build with public release, physical mobile certification, native API parity, production tenant-safe sync, or an independent security sign-off.**
