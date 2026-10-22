# Phase 6 — First Real Browser Evidence

## Verified GitHub Actions run

**2026-10-22:** [Run 39735706627](https://github.com/RyzovaTech/wonder-layer/actions/runs/39735706627) executed a **real Playwright Chromium** session on an Ubuntu GitHub-hosted runner. All **10 of 10 checks** passed, with the complete JSON evidence artifact uploaded.

| Check | Result |
| --- | --- |
| Online navigation and app shell | PASS |
| Controlled Service Worker | PASS |
| IndexedDB local write | PASS |
| Version 2 SHA-256 recovery checksum | PASS |
| Block PWA update with unsaved note | PASS |
| Storage health/quota reporting | PASS (not persisted) |
| Adaptive compute | PASS using **WASM** |
| OPFS file write-read | PASS |
| Offline browser reload and saved note | PASS |
| Cold browser-profile restart while offline | PASS |

Compute detail: Chromium did not provide a working WebGPU adapter (`No WebGPU adapter`). Wonder Layer fell back to **WASM**, completing the 65,536-element numeric operation in ~15.2 ms in that hosted session (inclusive of UI/engine overhead). **No claim of successful GPU execution** is supported by this run.

This test did not establish platform-wide installation support, actual mobile Safari/Android or physical USB/Bluetooth permissions. Storage persistence was `false` in that run; cold-session retention is not a guarantee against user-clearing or eviction. The app was tested as a browser PWA, not a Windows/macOS native wrapper.

## Phase 6 follow-on evidence (in progress)

The branch adds a separate **consumer tarball** CI workflow to build Vanilla, React and Vue samples and strict-TypeScript check them against the **installed package**. Firefox and WebKit Linux desktop acceptance jobs are experimental; their failures must be investigated and are **not** to be reinterpreted as passing acceptance.

## Remaining release gates

Real physical Chrome/Edge/Firefox/Safari/Android/iOS matrix, actual GPU dispatch on supported hardware, camera and restricted device permission behaviors, production sync threat model, accessibility, performance/bundle budgets and explicit licensing decision.

Phase 6 is **underway, not complete**.
