# Phase 2 — Real-browser acceptance and performance

## Local execution

Prerequisites: Python 3, Node 20+, an unrestricted browser.

```bash
npm test
npm run bench:node
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/browser_acceptance.py --browser chromium
```

Use `--browser firefox` or `--browser webkit` when their Playwright browsers are installed. For multiple browsers, supply distinct `--output` JSON paths. The runner intentionally preserves a browser profile for testing **cold offline restart**, and never bypasses browser admin policy.

## Acceptance gates

| Gate | Required evidence |
| --- | --- |
| CI | GitHub Actions Node 20/22 runs green on main |
| PWA | Real installed service worker controlling the example |
| Offline | Offline reload + browser restart using same profile |
| Data | Real IndexedDB and OPFS persistence, export/import recovery |
| Compute | Actual browser WASM and/or WebGPU workload, numerical parity |
| GPU | Adapter readiness plus measured shader dispatch on supported hardware |
| Hardware | Explicit user permission, denied and unsupported paths |
| Performance | Browser/device-specific GPU/WASM/Worker/JS data (Node is CPU-only) |
| Matrix | At least one tested desktop and one mobile browser, then broader browsers |
| Release | Security review, CI and browser evidence green, docs limitations accurate |

If `ERR_BLOCKED_BY_ADMINISTRATOR`, this is an environment restriction, **not** a pass. GitHub Actions jobs with `runner_id:0` and no steps may indicate an Actions runner/policy/billing issue. See issue #6. No claim of native feature parity, silent PWA installation, or guaranteed background execution is made.

## Scope status

Current tests verify some source/contract behavior. A **Phase 2 Complete** claim requires all relevant gates above, especially actual browser runs and CI. This document is a checklist, not a claim of completion.
