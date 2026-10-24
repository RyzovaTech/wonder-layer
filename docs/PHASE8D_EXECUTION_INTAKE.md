# Phase 8D — Physical Validation Execution Intake

**Status: validation execution initiated; no independent physical-device test results or reviewer signatures received.** This document adds a deterministic, privacy-minimized local evidence intake table, not a public compatibility guarantee.

## Active test cohorts (all NOT TESTED)

| Cohort | Exact minimum coverage | Physical-device status | Owner / evidence |
| --- | --- | --- | --- |
| P0 Android | Real Android phone, Chrome stable, service-worker control, offline reload, full cold browser/PWA restart, synthetic IndexedDB recovery | **NOT TESTED** | Authorized tester to be assigned privately |
| P0 iOS | Real iPhone, Safari, equivalent SW/offline/cold restart/recovery | **NOT TESTED** | Authorized tester to be assigned privately |
| P1 iOS Chrome | iPhone Chrome under Apple browser/platform policies, feature limitations | **NOT TESTED** | Assign privately only if claimed |
| P1 Desktop | Physical Windows Edge, macOS Safari, chosen additional browsers | **NOT TESTED** | Assign privately |
| P1 Hardware | Real WebGPU shader verification or consented physical peripherals where supported | **NOT TESTED** | Assign privately |
| Security | Independent non-implementing security review for exact source SHA and actual deployed environment | **PENDING** | Qualified reviewer to be assigned privately |

Do not assume a named reviewer/tester exists merely because a task is tracked or CI passed.

## Execution procedure

1. The release owner chooses actual authorized testers and a qualified independent reviewer using a **private communications channel**. Do not post testers' names, IDs, email addresses, screenshots or device identifiers to public GitHub.
2. Verify the Vercel Device Lab deployment: **READY**, expected exact Git SHA, authentication still enabled for **all** environments. Give access through authorized SSO membership only; never disable SSO or circulate bypass links.
3. Each tester opens the protected `/examples/device-lab/` URL from the real device and follows [Phase 8D protocol](PHASE8D_PHYSICAL_VALIDATION.md): check SW control, save only `wonder-synthetic-only`, disable all networking, reload, read synthetic value, terminate the actual app process and reopen **still offline**, read again.
4. Record each selected permission outcome from deliberate user clicks. A denied/unsupported action is a valid documented *outcome*, not proof that the hardware feature works.
5. Download the v2 JSON evidence on-device and securely transfer it to a trusted **restricted** workstation/store. It is self-reported, not automatically physical-attested. Do not upload it here.
6. On a trusted local workstation validate the file(s):

```sh
node tools/verify-device-evidence.mjs ./android-device.json
node tools/physical-review-intake.mjs
node tools/physical-review-intake.mjs ./android-device.json ./iphone-device.json > local-review-intake.md
```

When called with no files, the review intake command prints a fully **NOT TESTED** matrix. With files it reports only **SELF_REPORTED_ONLY** counts; no report can move a row to VERIFIED. Run outputs are local; do not commit/upload `local-review-intake.md` if it refers to restricted testing.

7. Generate a SHA-256 checksum of each JSON file on the same trusted workstation, and cross-reference the digest in a **private** copy of [blank attestation form](PHASE8D_ATTESTATION_TEMPLATE.md). A checksum detects later content changes but does not prove device origin, user identity, timestamp authenticity, or truth.
8. The independent device evidence reviewer checks actual physical provenance, exact source/deployed SHA, offline disconnect and full process restart, reported limitations and restricted report checksum. The separate qualified security reviewer evaluates trust boundaries and issues; neither reviewer is an assistant or synthetic test.
9. Only after the independent review and explicit release-owner approval may a separate reviewable PR propose compatibility claims for exact browser/OS versions. Preserve PR CI, issue #18 and release issue #19. No automatic promotion from JSON, successful Node tests or hosted browser emulation.

## Intake report guarantee

`tools/physical-review-intake.mjs` validates at most 25 privacy-minimized local JSON files per invocation (each at most 32 KiB) using the same v1/v2 validator as Device Lab, then renders:

- Initial Android Chrome and iOS Safari rows, plus desktop and optional browser categories.
- Number of **self-reported sessions** per browser platform (NOT distinct verified devices).
- Counts of manually claimed offline reload and cold restart passes (NOT independent proof).
- `NOT_TESTED` for rows with no reports, `SELF_REPORTED_ONLY` for rows with reports, and `NOT_ATTESTED` for all physical claims.
- **physicalDevicesCertified: 0** and **releaseApproved: false** invariant.

No device-specific model, serial number, network address, location, media, tester email or free-form private note is emitted. Report counts are for private decision support only. User-supplied files are never used as commands or instructions.

## Release boundary

The npm SDK is still `private:true` version `0.0.0-poc.1`. Linux latest-head verification, independent security approval, verified branch ruleset and licensing/distribution authorization remain mandatory unresolved gates. Physical phone evidence **requires actual consenting people and actual physical phones**; this phase's engineering tooling does not substitute for either.

**Evidence intake engineering complete** means the scripts/docs/tests are reviewed and CI green. **Physical acceptance complete** requires genuine authenticated device testing and independent approval, which remains OPEN.
