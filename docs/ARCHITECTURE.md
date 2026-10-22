# Architecture — pure PWA capability SDK

```
Existing PWA
    └─ @ryzova/wonder-layer
         ├─ Capability inspector (checks availability, not silent permissions)
         ├─ Adaptive compute (GPU → WASM → Worker → JS)
         ├─ IndexedDB local store + outbox
         ├─ Sync protocol adapter (foreground only)
         ├─ OPFS utility + validated backups
         └─ Optional install / service worker integration in host app
```

## Goals
- One shared web codebase, no platform-specific native packaging requirement.
- Real WebGPU and WebAssembly workloads when supported, verified numerical fallbacks.
- Storage/recovery APIs that acknowledge quotas, eviction and user-triggered deletion.
- Minimal SDK coupling: the host PWA owns routing, lifecycle, authentication and its service worker.

## Architectural boundaries
- WebGPU availability is not the same as physical GPU functionality. Execution may still fail.
- Hardware APIs remain permission-, OS-, and browser-gated.
- Service worker scopes cannot be combined by installing multiple workers with overlapping scopes.
- Cloud-only business logic cannot become offline merely by importing the SDK.
- Authentication, encryption, data tenancy, production conflict resolution and secure hosted sync are out of scope for this first engineering branch.

## Test strategy
1. Fast deterministic Node tests for capability probes, GPU fallback policy and compiled WASM math.
2. Real browser acceptance on unrestricted Chromium/Firefox/WebKit with network toggling.
3. Real device hardware tests with explicit permission; manual matrix before public release.

**The current branch is a preliminary engineering foundation, NOT native feature parity.**

