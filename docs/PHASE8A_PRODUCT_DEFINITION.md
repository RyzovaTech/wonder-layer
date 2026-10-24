# Phase 8A — Product Definition and Positioning

**Decision state:** Phase 8A product direction documented for engineering/product planning. **Not** a license decision, production-readiness approval, price announcement or permission to distribute.  
**Baseline:** 2026-10-24, merged `main` commit `4a7090eeb7f89da95b2ef971d3b53795de0ef135`.  
**Machine-readable claims contract:** [phase8a-capabilities.json](product/phase8a-capabilities.json).

## 1. Product identity and customer promise

**Category:** Framework-independent, Pure-PWA capability SDK for an **existing** web application. The SDK improves developer access to browser-permitted capabilities; it does not extend browser/OS privileges.

**One-sentence positioning:**

> Ryzova Wonder Layer helps developers build offline-resilient, device-aware Pure PWAs by integrating local storage/recovery, adaptive browser compute and permission-gated device capabilities behind a reusable SDK—with explicit fallbacks, and no mandatory native wrapper.

**Short description (documentation/landing-page candidate):**

> One web app. More practical browser capability. Wonder Layer connects existing PWAs to local-first records, recovery, adaptive computation and permitted device APIs. Capabilities are detected at runtime, permissions remain user-controlled and unsupported platforms get honest fallbacks.

**Developer value hypothesis (NOT independently measured):** Less repeated integration work across storage, recovery, compute, permission checks and framework lifecycle. We must establish the actual time saved, binary size, runtime performance and support burden with representative external developers before making quantitative marketing claims.

**Brand boundary:** Wonder Layer is its own SDK product. Rev/Alphi integration may be explored later, but is **not** a prerequisite or a shipped integration.

## 2. Who it serves (prioritized)

| Priority | Persona | Job to be done | Initial use case | Buying/adoption signal |
| --- | --- | --- | --- | --- |
| P0 — first adopter | Independent JavaScript/TypeScript developer who already owns an offline-capable PWA | Add reliable local records, user-managed recovery and browser capability checks without implementing every subsystem from scratch | Notes, field checklist, local project workspace | Independently installs the private test tarball and completes one end-to-end workflow |
| P1 — second adopter | Small team building a cross-browser, device-aware PWA | Support browser-permitted camera, files, compute and optional hardware APIs without promising universal parity | Inspections, photo/field tools, device diagnostics | Team verifies feature fallback across its actual supported browsers/devices |
| P2 — later buyer | Engineering lead embedding SDK capabilities into a commercial PWA | Reduce maintenance costs and obtain clear compatibility, lifecycle and support commitments | Internal operations web app / proprietary software | Demonstrates willingness to pay after a technically and legally approved distribution model |

**Not the initial target:** Consumers buying a standalone Wonder Layer app; developers demanding unrestricted native hardware access, OS-level background services, native OS development, guaranteed offline retention, or a turnkey cloud sync/backend/AI model. Do not position this as an Electron/Capacitor replacement for use cases needing unavailable native APIs.

## 3. Problems, existing alternatives and differentiation hypothesis

| Developer problem | What Wonder Layer provides today | What we still need to prove |
| --- | --- | --- |
| Fragmented web capability handling | `inspect()`, `hardware.capabilities()` and explicit `hardware.request()` | Ease-of-integration vs direct Web API implementations |
| Compute backend differences | `compute()` and `scheduler` with validated JS/WASM/Worker and conditional WebGPU selection | Comparative speed/energy outcomes on physical devices; no performance supremacy claims |
| Offline project continuity | `store`, `recovery`, `files` and opt-in persistence requests | Cold-restart, storage eviction and browser-policy behavior on real target devices |
| PWA lifecycle friction | `pwa` lifecycle controls and hosted Device Lab sample | App owner integration friction and conflict-free service-worker management |
| Cross-framework wiring | Core ESM, lazy `/client`, React `/react`, Vue `/vue` entrypoints | Real external developers successfully integrate without maintaining duplicate adapters |

**Alternatives and complements:** Direct browser Web APIs, custom wrappers, service-worker utilities such as Workbox, offline data libraries and native wrappers. Wonder Layer is **complementary** to web frameworks and SW tooling, not an evidence-backed claim to outperform or replace them.

## 4. Product capability contract

The [JSON capability manifest](product/phase8a-capabilities.json) is the source of truth for Phase 8A website/docs claims and is validated by `tests/product-definition.test.mjs`.

| Capability | Stable developer-facing surface for this engineering beta | Contract boundary |
| --- | --- | --- |
| Capability inspection | `wonder.capabilities()`, `wonder.inspect()` | A reported available API does not guarantee permission or successful hardware dispatch |
| Adaptive compute | `wonder.compute(Float32Array, options)`, `wonder.scheduler` | JS/WASM/Worker/WebGPU selection depends on browser/device; no arbitrary AI inference provided |
| Local records | `wonder.store.save()`, `listRecords()`, outbox | Origin-scoped; browser storage may be cleared/evicted |
| Recovery | `wonder.recovery.export()`, `validate()`, `restore()`, `storageStatus()` | User-managed snapshots and integrity metadata are not automatic cloud backup |
| Private files | `wonder.files.read()`, `write()`, `estimate()` | OPFS when supported; origin scope and quotas apply |
| PWA lifecycle | `wonder.pwa.register()`, `inspect()`, `checkForUpdate()` | The host owns SW scope; no silent installation/background guarantee |
| Hardware bridge | `wonder.hardware.capabilities()`, `request()` | Requests require explicit user interaction, supported APIs and user consent |
| Optional sync/reconnect | `wonder.sync()`, `reconnect()`, `foregroundSync()` | **Client-only**; no production authentication, tenant isolation, or backend supplied |

All methods remain **experimental**, not semver-stable production APIs. The exported package entrypoints are `@ryzova/wonder-layer`, `/client`, `/react` and `/vue`; see [Developer SDK Guide](DEVELOPER_SDK.md) for tested usage. Phase 8B must specify semver/API change policy before promoting any API to stable.

### Hard exclusions for claims, demos and sales

No implicit permissions or browser sandbox bypass. No unrestricted native APIs, silent install, guaranteed background tasks, guaranteed storage retention, or guaranteed GPU performance. No bundled AI model, finished photo editor, cloud platform, anonymous public sync or secure multi-tenant server. Never label hosted Playwright/WebKit emulation as actual iPhone hardware evidence.

The package currently remains `0.0.0-poc.1` with `private: true`, license **unselected**, public npm publication **not authorized**. A private GitHub repo or staging preview is not a customer-license grant. Price tiers, dual licensing, terms and checkout integrations are **hypotheses**, not approved offerings.

## 5. First developer workflows to demonstrate

1. **Offline field notes / workspace (P0):** locally save an item, disconnect network, reload pre-cached app, reopen record, export a snapshot, restore into a clean controlled test profile. Measure reliability and developer integration time. State that cache coverage and browser eviction policies are app/device dependent.
2. **Compute fallback (P1):** run one documented `Float32Array` transform, inspect attempted backend and failures, confirm numerical parity in supported hosted browsers; repeat WebGPU hardware work only when real adapters are available.
3. **Device-aware action (P1):** inspect availability, request a camera or supported API following a click, handle denial/unsupported state without retaining raw media by default.

These are **demo/validation acceptance journeys**, not announcements that complete production apps are available. Existing [Basic PWA](../examples/basic-pwa/) and [Device Lab](../examples/device-lab/) are starting points; Phase 8C may create presentation-quality demos.

## 6. Evidence ledger and what is *not* verified

At the baseline merge SHA, post-merge `main` had 4/4 GitHub workflows and 10/10 jobs pass: [Node 20/22 SDK](https://github.com/RyzovaTech/wonder-layer/actions/runs/40063863814), [independent packed consumer](https://github.com/RyzovaTech/wonder-layer/actions/runs/40063863602), [browser matrix](https://github.com/RyzovaTech/wonder-layer/actions/runs/40063863622) and [security automation](https://github.com/RyzovaTech/wonder-layer/actions/runs/40063863609). Hosted browser checks include Chromium, Firefox, WebKit, native Windows Edge and macOS WebKit. Protected Vercel Device Lab HTTP assets/headers were probed, not independently browser-operated.

Unresolved: physical Android Chrome and iPhone Safari; real peripheral and hardware WebGPU results; latest-head Linux CI; independent human security sign-off; production sync backend trust boundary; final license and distribution authorization; GitHub `main` branch protection. Track [#19](https://github.com/RyzovaTech/wonder-layer/issues/19), [#18](https://github.com/RyzovaTech/wonder-layer/issues/18), [#17](https://github.com/RyzovaTech/wonder-layer/issues/17), [#6](https://github.com/RyzovaTech/wonder-layer/issues/6) and [#21](https://github.com/RyzovaTech/wonder-layer/issues/21).

**Evidence taxonomy:** `implemented` = code exists; `hosted-automated` = hosted CI has demonstrated a defined workflow; `physical-verified` = authenticated tester attests physical device and saves restricted evidence; `independent-approved` = dated authorized human review. Never promote between categories automatically.

## 7. Success metrics and external validation plan (not yet measured)

**Adoption hypotheses, to test before paid launch:**

- Recruit **5–10 consenting external developers** representing P0 and P1; collect zero personal identifiers in public issues. This is a proposed research sample, not an existing user count.
- Track time from private authorized tarball delivery to first successful `store.save` + reload; record blockers and setup steps (baseline vs SDK where a fair comparison is possible).
- For each candidate demo, report device/browser version, tested feature/unsupported/denied state, cold restart, restore success, bundle size and any failures. Physical-device attestation is a separate signed record.
- Track API discoverability (can an unfamiliar developer find entrypoint, initialization, cleanup and fallback docs?), documentation errors, issue resolution and opt-in interest in paid commercial usage.
- **Go/no-go for Phase 8C public-facing claims:** independent developer reproduction + reproducible artifact + explicit supported environments and caveats. Do not invent percentages, benchmark wins, testimonials, customers or revenue.

## 8. Phase 8A acceptance and handoff

- [x] Product positioning, target segment order, problem/solution boundary, non-goals and first customer journeys documented.
- [x] API/package-entrypoint-to-capability mapping captured in machine-readable claims manifest and tested against repository declarations.
- [x] Validated baseline and unverified release gates explicitly separated.
- [x] Commercial model treated as an option, not a license/public-release decision.
- [ ] **External developer/customer discovery:** intentionally deferred; needs real third-party participation and consent.

**Phase 8B handoff:** API review and stability/versioning policy; ergonomics, exception handling, package weight, reference-quality examples and measured developer integration tests.  
**Phase 8C handoff:** accurate docs website with working sandbox/demo, capability table sourced from the JSON contract, clear `not-tested` markers and legal review before commercial copy.  
**Phase 8D/8E handoff:** physical acceptance, security review, distribution/legal approvals; any commercial/public release remains blocked until their explicit gates pass.

This decision document authorizes **planning and testable engineering only**; it cannot authorize publication, license use or product claims contradicted by evidence.
