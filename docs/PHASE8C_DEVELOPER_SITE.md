# Phase 8C — Developer Site, Documentation & Browser Playground

**State:** Protected developer-preview engineering implementation. Not a public documentation launch, npm publication, license permission, paid checkout or production authorization.
**Baseline:** Phase 8B main merge dc91da934a7599f46b1c6e78c01590fb2d5b0108.

## Purpose

Wonder Layer targets existing Pure-PWA JavaScript/TypeScript developers who need a reusable browser-permitted storage/recovery, adaptive compute, hardware capability and service-worker lifecycle SDK. The developer preview answers four questions: what is implemented, how do I evaluate it, how do I integrate it, and what remains unverified?

The site demonstrates a lightweight real browser capability inspection, numerical transform, and synthetic IndexedDB write/reopen, all initiated by explicit clicks. No automatic hardware permission, geolocation, camera, microphone, production sync, external analytics, customer data, or commercial checkout exists on the page.

## Engineering deliverables

| Artifact | Purpose |
| --- | --- |
| examples/developer-site/index.html | Responsive accessible developer landing page with capability cards, live playground, quick-start and release gates |
| examples/developer-site/styles.css | CSS-only visual design, visible keyboard focus, responsive layout and reduced-motion preference |
| examples/developer-site/site.js | Content-safe claims rendering and user-click-only compute/IndexedDB demo; copyable Vanilla/React/Vue SDK snippets |
| docs/product/phase8a-capabilities.json | Existing machine-readable truth source for eight claims and their evidence statuses |
| tools/build-device-lab.mjs | Explicit allowlist expansion for the already-authenticated Vercel static preview |
| tests/developer-site.test.mjs | Node checks for safe claims rendering, no trackers, local-only demo, accessible controls and release restrictions |
| tests/browser_acceptance.py | Real browser acceptance tests for developer page, evidence loading, compute, synthetic save/reopen and snippet switching |

## Trusted preview and local instructions

The repo is integrated with the Vercel Device Lab project, previously verified to use Vercel Authentication on all deployment targets. Once the exact commit is deployed successfully, the intended preview route is:

    /examples/developer-site/

A developer can check out authorized source, run npm test, then run python3 -m http.server 8765 and navigate to:

    http://127.0.0.1:8765/examples/developer-site/

Only HTTPS or localhost provide secure browser contexts. This docs page itself is **not an independently installable PWA** and never registers a new Service Worker. Existing Basic PWA and Device Lab examples retain separate, host-owned scopes.

The HTML, CSS, JS and claim manifest are copied by exact allowlist into the protected preview alongside existing SDK JS/WASM assets. The builder still excludes package tarballs, environment files and reports. Existing restrictive CSP, script policy, response headers and Device Lab service-worker no-store header remain intact. The preview's new site resources use no-cache headers.

## Truthful capability and privacy boundaries

- Eight capability cards are rendered from the approved Phase 8A JSON contract, with visible hosted evidence (yes/partial) and physical mobile evidence not verified. The JS rejects mismatching/malformed manifest metadata.
- Text is created using safe DOM textContent, not raw HTML interpolation. There are no third-party scripts, fonts or analytics.
- Initial page load fetches only same-origin website/SDK assets and the claims JSON; external GitHub links are navigated only if clicked.
- The live inspector never prompts for camera/USB/etc. Runtime support is not proof of permission or hardware availability.
- Compute reports the actually selected backend for one small Float32Array transform; this is not a benchmark, GPU certification or proven speed claim.
- Synthetic local save/reopen uses an isolated origin-scoped IndexedDB name and literal sample value only. Data may be evicted or cleared. No sync request occurs.
- The actual package remains version 0.0.0-poc.1 and private: true, with no final license or public npm publication authorization.

## Acceptance ledger

- [x] Build developer microsite and capability-manifest-driven cards.
- [x] Add click-to-run browser local demo and code snippets for three supported integrations.
- [x] Add a protected deployment allowlist and keep the CSP/SW headers restricted.
- [x] Include source-level safety tests and real browser acceptance coverage.
- [ ] Exact PR-head Node 20/22 SDK, consumer builds, Chromium/Firefox/WebKit/Windows Edge/macOS WebKit and CodeQL/security workflows all passing.
- [ ] Post-merge main CI passing independently.
- [ ] Independent authenticated staging UX accessibility/performance assessment and external developer feedback.
- [ ] Real Android/iPhone device evidence, Linux latest-head CI, independent signed security review, verified branch protection and authorized license/distribution decisions.

Passing the website CI does not authorize public npm, distribution, physical mobile certification or a paid commercial offering.

## Next handoff

**Phase 8D**: real mobile/hardware verification and a device compatibility evidence matrix.
**Phase 8E**: code ownership, licensing, customer validation and commercial terms only after legal/technical approvals.
**Phase 8F**: approved invited developer beta and measured onboarding/performance/support feedback.

References: Phase 8A product definition, Phase 8B SDK quality, release issue #19, reviewer #17, licensing #18, Linux #6, main protection #21.
