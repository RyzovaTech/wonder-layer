# Phase 6 — Consumer and Cross-Browser Acceptance

Phase 6 is the **validation gate**, not a claim that web APIs bypass browser/OS security restrictions. `npm test` validates logic; real browsers and devices validate the actual user experience.

## Evidence ledger

| Gate | Execution | Status |
| --- | --- | --- |
| SDK package (tarball + WASM/Worker) | CI Node 20/22 | Phase 5 baseline passed 76/76, reverify on Phase 6 |
| Strict TypeScript consumer | Independently installed tarball, tsc | In progress |
| Real React/Vue/Vanilla bundling | Consumer Vite builds from tarball | In progress |
| Chromium offline app | Linux Playwright persistent profile and SW | In progress |
| IndexedDB/OPFS/backups | Playwright actual browser | In progress |
| WebGPU/WASM/Worker JS parity | Playwright browser, no fabricated GPU success | In progress |
| Firefox/WebKit desktop engines | Playwright, service worker support varies | Not verified |
| Safari macOS/iOS and Android devices | Real hardware/device matrix | Not verified |
| Native-only hardware permissions | Physical user-click permission tests | Not verified |
| Production multi-tenant authenticated sync/security | Third-party review | Not verified |
| Commercial/public release | Licensing & approval | Not authorized |

Evidence must record browser versions, OS, and tested device. Unsupported APIs count as **unsupported**, not as successful features. A Linux Chromium test cannot certify Apple iOS, Android or Windows hardware parity.

## Commands

```sh
npm test
npm run test:consumers
python3 -m pip install 'playwright>=1.56,<2'
python3 -m playwright install --with-deps chromium
python3 tests/browser_acceptance.py --browser chromium
```

Run in a real browser environment not blocked by administrator policies. CI uploads JSON acceptance reports even if tests fail. Use issues #2, #4, #10 and #13 for specific capability/device gaps.

## Release gating

No public production readiness, device universality, background task reliability or unrestricted native features may be asserted until the complete hardware/platform matrix is actually tested and security/licensing are approved.
