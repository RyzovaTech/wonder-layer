# Existing PWA integration demo

This repository now contains a **real, standalone PWA example** at `examples/basic-pwa/`.
It imports the framework-independent Wonder Layer SDK directly from `../../src/wonder.js`.
No desktop/mobile wrapper is created and no platform-specific app is rewritten.

## Run
From repository root:
```sh
python3 -m http.server 8765
```
Visit `http://127.0.0.1:8765/examples/basic-pwa/` in an unrestricted modern browser.

## Acceptance
1. First online visit, allow the service worker to install; reload and inspect `navigator.serviceWorker.controller`.
2. Write a note, Save locally; reload and Reopen. Verify content.
3. In DevTools set Network = Offline. Reload. The shell and previously saved note should remain accessible after the first complete precache.
4. Disable offline; run Compute; record actual backend, duration and failure details. WASM and GPU paths are not universal.
5. Export a backup, clear the note in another profile and import there to validate portability. Existing IDs are skipped by default.
6. Inspect the capabilities report; do not interpret API presence as hardware permission or device support.

## Design constraints
- Service-worker scope is limited to `/examples/basic-pwa/`; do not register overlapping workers in an existing production PWA. Adapt the host worker instead.
- The example only uses local operations. No sync endpoint is contacted; the host developer must implement an authorized sync backend and conflict policy.
- IndexedDB can be evicted and user-cleared. Export backups.
- Installability and offline browser restart require **real-browser acceptance**, which the restricted development container cannot provide.
- This sample is not evidence of native feature parity or universal WebGPU support.

