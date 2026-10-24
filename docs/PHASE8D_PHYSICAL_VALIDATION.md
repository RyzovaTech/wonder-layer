# Phase 8D — Physical Device Validation and Compatibility Evidence

**Engineering state:** evidence-collection tooling implemented, **physical validation not yet performed**. No tester, independent reviewer or device has been certified by this repository, CI or an LLM.

## What Phase 8D must prove

Wonder Layer's original promise is a more resilient Pure-PWA developer experience across *browser-permitted* APIs. Desktop CI and Playwright mobile emulation are not evidence of physical Android Chrome or iOS Safari behavior. Compatibility means an exact browser/version/device category and a documented test scenario, never unconditional OS-wide native parity.

| Gate | Minimum acceptance evidence | Current status |
| --- | --- | --- |
| Android Chrome, real smartphone | Private tester identity confirmation, OS/browser versions, trusted HTTPS, SW control, offline reload, cold browser restart, local record recovery, permission outcomes | **NOT TESTED** |
| iPhone Safari, real smartphone | Same tests on actual iPhone; separate data for standalone PWA if install supported | **NOT TESTED** |
| Desktop physical Windows and Mac | Real OS/browser results, offline reopen, permissions where available, visible fallbacks | **NOT TESTED as separately attested device evidence** |
| Real GPU/peripheral access | Explicit click, supported adapter/permission, actual dispatch/parity or denied/unsupported outcome | **NOT TESTED as independently attested physical device evidence** |
| Storage/recovery edge cases | Browser-eviction behavior, interrupted write, multi-tab update, backup integrity, no unsaved-data overwrite | **NOT TESTED on physical mobile** |
| Independent security approval | Qualified non-implementing reviewer, dated reviewed SHA, restricted findings and signature; explicit release-owner acceptance | **PENDING** |

CI hosted browser evidence is valid **for CI only**. The completed Phase 8C baseline is `d35fc6e703dad964a202e9e804abfebc59d652d1` with SDK, external consumers, browser engines and CodeQL workflows green. A new PR or deployment SHA must always be recorded anew.

## Authorized device tester: real-world procedure

1. Obtain explicit authorization to access the *authentication-protected* Wonder Layer Device Lab. Confirm project/team, exact deployed commit, Vercel Authentication still enabled, no bypass links, and secure HTTPS.
2. On the **real phone**, open `/examples/device-lab/`, manually choose OS and browser. Do not enter device identifiers, account names, GPS coordinates, raw screenshots containing personal data, serial numbers or customer notes.
3. While online, allow the Service Worker to install; reload if necessary and click **Check SW control**. It should report observed pass. Click **Save synthetic value**. The only value is `wonder-synthetic-only`, stored in origin-scoped IndexedDB without sync.
4. Disconnect **all** mobile and Wi-Fi networking on the actual device. While offline, reload the Device Lab and click **Read synthetic value**. Only mark *Observed pass* if the synthetic value is present while offline; otherwise choose failed/unsupported.
5. Keep networking off. Fully terminate the browser/PWA at the OS task level, reopen the same Device Lab page while offline, and click **Read synthetic value**. Only mark *Observed pass* for cold restart if this actually succeeded. A tab refresh or Playwright persistent context is **not** a real phone app termination.
6. Check **I manually verified networking was disconnected** only if you actually did so. If the network was not confirmed, leave it unchecked; do not mark offline reload or cold restart passed. A local JSON file still cannot prove the phone was offline or that it was real hardware.
7. For each hardware API, use the **explicit** capability button, review the browser's own chooser/permission dialog, and test meaningful grant/deny/unsupported outcomes. Media tracks stop immediately; no media or coordinates are retained. A denied/unsupported result **is not** a successful hardware test. Test WebGPU dispatch only if a browser exposes a real compatible adapter.
8. Click **Download local JSON evidence**, then use a trusted workstation to validate. Keep full evidence and any separate human provenance/review records only in an **approved restricted evidence store**, never in a public GitHub issue or repository PR.
9. Have an **authorized independent device tester** attest to actual hardware/OS, no emulation, precise browser/OS version, offline-network procedure, pass/fail details, and restricted evidence reference. Obtain a second independent security review for security sign-off, and a separate authorized release-owner decision.

## Machine-readable self-report format v2

The Device Lab now exports `ryzova-device-acceptance-v2`. Version 1 evidence remains parseable for older authorized test rounds; v1 does **not** contain structured offline results. V2 adds a single `offlineChecks` object with an exact allowed schema:

```json
{
  "networkDisconnection": "not-confirmed",
  "serviceWorkerControl": "not-tested",
  "offlineReload": "not-tested",
  "coldRestart": "not-tested"
}
```

Allowed offline status values: `not-tested`, `observed-pass`, `observed-fail`, `unsupported`. `networkDisconnection` is either `not-confirmed` or `manually-confirmed`. A claimed offline pass requires network manual confirmation and a preceding service worker pass; cold-restart pass also requires an offline-reload pass. These rules prevent **internally inconsistent self-reporting**, not deliberate fabrication or forged evidence. A CLI report always includes `attestedPhysicalDevice:false` and `independentSecurityApproval:false`.

Use:

```sh
node tools/verify-device-evidence.mjs ./wonder-device-acceptance.json
node tools/verify-device-evidence.mjs ./android-test.json ./iphone-test.json
```

Multiple JSON files yield a privacy-minimized **SELF_REPORTED_AGGREGATE_REQUIRES_INDEPENDENT_ATTESTATION**, including counts by OS/browser and manually reported offline observations. `physicalDevicesCertified` always equals **0**, regardless of number or reported status. Files should never be pasted into GitHub or automatically uploaded to telemetry.

The CLI enforces maximum file size, exact permitted JSON keys, known OS/browser values, strict result enums and acceptable coarse hardware detail; rejects unexpected identifiers such as `deviceId`, GPS coordinates, arbitrary raw-media fields or free-form notes.

## Acceptance and reporting plan

For each *attested* OS/browser row, an authorized reviewer privately records:

- Device category, OS/browser *versions*, browser versus standalone mode, test date, signed non-emulated provenance, exact deployed commit and restricted report reference.
- Browser SW control, offline reload, **cold physical restart** and synthetic data recovered, all separated.
- Camera/microphone/permission denial and cleanup, supported peripheral actions, WebGPU numerical parity, and no data-loss or policy bypass.
- Unsupported/denied/cancelled/error states; never promote a supported state from a single API's presence or from another browser.
- Independent security assessment outcome, release-owner acceptance and pending retest issues.

**No public compatibility matrix cell should change from NOT TESTED to VERIFIED based solely on downloaded JSON, macOS/Windows CI, an assistant's simulated environment or a user-agent string.**

## Automation verification (not physical proof)

Node regression tests protect the v2 JSON schema, negative cases, spoofed fields, incompatible manual offline sequences and uncertified aggregation. Real hosted browser tests verify the new UI controls, that an unconfirmed manual offline pass cannot export, and that the existing Device Lab's synthetic storage flow works in headless network-offline mode.

Those automated tests do **not** establish physical device provenance, actual camera/BLE/USB access or independent reviewer signature.

## Outstanding release conditions

GitHub `main` branch protection is still pending [#21](https://github.com/RyzovaTech/wonder-layer/issues/21), latest-head Linux CI [#6](https://github.com/RyzovaTech/wonder-layer/issues/6), signed independent security [#17](https://github.com/RyzovaTech/wonder-layer/issues/17), physical devices/license approval [#18](https://github.com/RyzovaTech/wonder-layer/issues/18) and overall release tracker [#19](https://github.com/RyzovaTech/wonder-layer/issues/19).

Phase 8D engineering can be integrated when all exact-head automated checks are green, while **physical validation acceptance remains OPEN** until external testing is genuinely completed. Never disable Vercel Authentication, remove npm private gate, enable unreviewed public releases or invent a tester's approval.
