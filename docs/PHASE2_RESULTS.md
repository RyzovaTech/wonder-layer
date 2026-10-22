# Phase 2 verification record — 2026-10-22

## Verified locally

- Prior standalone Pure-PWA PoC: `npm test` **27/27**, Python tests **9/9** on Linux. These are from a separate prototype, not this repository's GitHub Actions run.
- Official repository Phase 1/2 offline contract source: **11/11** contract functions passed in isolated JavaScript evaluation in the previous engineering session; this does not replace browser/Node acceptance.
- Exact compiled WASM binary in this repository: Git blob SHA `bd22c1ae6735ed04f9957df1447f8e907a9eae30`, matches the available local PoC binary (`git hash-object`). WebAssembly CPU kernel output agreed with JS reference within 0.001.
- Linux CPU hot-kernel benchmark using **Node v22.16.0** on AMD EPYC 9V74, **13 rounds**, warmup, allocated output reused:

| Float32 elements | JS in-place median (ms) | WASM hot median (ms) |
| ---: | ---: | ---: |
| 8,192 | 0.0075 | 0.0063 |
| 65,536 | 0.0716 | 0.0240 |
| 262,144 | 0.3205 | 0.0898 |

**Important:** excludes startup, JS→WASM transfer overhead, GPU, worker messages. These numbers are not cross-platform predictions or evidence that WebGPU is faster.

## Blocked tests

- Managed Linux Chromium 144.0.7559.96 navigated to localhost with the default administrator policy: `ERR_BLOCKED_BY_ADMINISTRATOR`. The environment defines `URLBlocklist: ["*"]`.
- Bundled Playwright browser is not installed here; the automation runner returns `Executable doesn't exist`. Its dependency installation would require unavailable network access.
- GitHub Actions jobs in this private repository previously reported `runner_id: 0`, empty `steps: []`, and no downloadable logs. All queried earlier workflows had `failure` conclusions without documented test execution. See [issue #6](../issues/6).

## What is *not* verified

Actual installed service worker, real offline browser restart, real OPFS and IndexedDB across full restart, WebGPU adapter/device execution, hardware permission variants, Safari/Firefox/Android/iOS compatibility and GitHub CI green state.

## Phase gate

**Phase 2 is NOT fully accepted.** The implementation, diagnostic harness and CPU verification have advanced, but browser acceptance and runner access require unrestricted execution. See [acceptance plan](PHASE2_ACCEPTANCE.md). No claim of native-app parity or production release is justified.
