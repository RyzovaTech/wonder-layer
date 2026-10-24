# Wonder Layer — Private Beta Operations and Rollback Runbook

**Status: engineering preparation only. No package publication, external beta distribution, production sync approval, or public stable release is authorized.**

This runbook applies to the dedicated authentication-protected Vercel Device Lab and the **local-build-only** SDK candidate. It is not a release approval or a substitute for signed independent review and physical-device evidence.

## Candidate identity and version discipline

1. Record the exact reviewed Git commit, PR number, CI workflow run URLs, Vercel deployment ID, environment, reviewer and date in the restricted release record. Never treat a branch name or mutable deployment alias as provenance.
2. Keep `@ryzova/wonder-layer` at `0.0.0-poc.1` with `private: true` for this candidate. **Do not** create release tags, sign release claims, remove the private flag or execute `npm publish` based on this runbook.
3. On a reviewed checkout at the recorded commit run `npm test`, `npm run check:release` and `npm run beta:manifest`. Preserve the resulting SHA-256 manifest in a restricted record, alongside the exact source commit. A SHA-256 manifest checks local file integrity; it is **not** a signed supply-chain attestation.
4. Confirm Node 20/22, packed SDK consumer matrix, Chromium/Firefox/WebKit acceptance, Windows Edge, macOS WebKit, CodeQL and dependency audit all pass on the **same exact PR head**. Record post-merge `main` checks separately. Record Linux as blocked unless genuine Linux-runner evidence exists.

## Deployment verification before inviting authorized testers

1. Use only the Vercel project `wonder-layer-device-lab`, scoped to its approved team. Verify **Vercel Authentication: enabled for all targets** before testing, and again after any deployment or alias change. Do not create publicly shareable bypass links for testers, disable protection, or expose tokens in an issue, CI log or screenshot.
2. Compare `deployment.meta.githubCommitSha` with the expected candidate SHA; require `READY`. A ready build confirms build completion, **not** working Service Worker or physical-hardware acceptance.
3. On that *exact deployment URL*, require HTTP 200 for `/examples/device-lab/`, `/examples/device-lab/lab.js`, `/examples/device-lab/sw.js`, `/examples/device-lab/manifest.webmanifest`, the icons, `/src/wonder.js`, and referenced JS/WASM modules. Verify the expected CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and `Cache-Control: no-store` for the Service Worker. Do not infer these headers from `vercel.json` alone.
4. Run an **authenticated** browser session with consent to verify Service Worker installation, offline reload and IndexedDB recovery. HTTP probes alone are insufficient. Hosted CI or desktop browser checks must not be labeled physical Android/iOS.
5. Use only the synthetic IndexedDB key/value provided by the Device Lab. Do not enter real user content or sync sensitive files to the demo.

> **Phase 8D evidence update:** Exported Device Lab reports are now schema `ryzova-device-acceptance-v2` with optional *manual observations* required for offline reload/cold restart claims. `tools/verify-device-evidence.mjs` accepts legacy v1 and v2, including multiple-file aggregation, but remains `SELF_REPORTED_DEVICE_EVIDENCE` (or `SELF_REPORTED_AGGREGATE_REQUIRES_INDEPENDENT_ATTESTATION`). See [Phase 8D protocol](PHASE8D_PHYSICAL_VALIDATION.md). Do not treat a manually checked box as attested physical-device provenance.

## Physical-device evidence intake

The authorized tester follows `docs/PHASE7_DEVICE_VALIDATION.md`: physical device, OS/browser versions, user-initiated permission tests, online save, offline reload and cold browser/PWA restart. Export local JSON only after consent; on a trusted workstation validate with:

```sh
node tools/verify-device-evidence.mjs ./wonder-device-acceptance.json
```

The output remains `SELF_REPORTED_DEVICE_EVIDENCE`, `attestedPhysicalDevice: false`. Keep the JSON, tester identity/attestation, any installation-mode/offline notes, the exact deployed commit and date in a **restricted** evidence store. Never post camera media, coordinates, serial numbers, device IDs, personal data or complete evidence files on the public GitHub repository. The release owner separately records which OS/browser/capability combinations genuinely passed; denied, unsupported and simulated tests are distinct categories. The blank `docs/PRIVATE_BETA_REVIEW_TEMPLATE.md` must not be prefilled as approved.

## Independent review and decision record

Give the external security reviewer the exact reviewed SHA, threat model (`docs/PHASE7_INDEPENDENT_REVIEW.md`), test logs, dependency audit, host CSP/SW design, same-origin sync restrictions, known gaps and a restricted findings channel. Request an independently signed assessment; unresolved high/critical findings, unaudited production tenant isolation, or absent physical proof **block relevant release claims**. The RyzovaTech release owner must issue a *separate* explicit decision after reviewing findings, license and distribution terms. Do not call automated CodeQL a human sign-off.

## Rollback and incident response

- **Protected Device Lab deployment defect:** stop new tester invitations and record the affected deployment/commit. Identify a previously verified `READY` deployment of the **same project** with Authentication still enabled for all targets. Only an authorized operator should reassign/promote/rollback a deployment or alias after checking the exact ID, project and environment; confirm live headers, assets and authentication afterward. If no safe deployment is known, keep testing paused rather than exposing an unprotected host.
- **Source regression:** prepare a reviewable Git revert or fix PR; require fresh exact-head CI and an authenticated protected preview before merging. Avoid force-pushing `main`.
- **Already-downloaded local SDK candidate:** stop distributing the affected build through any approved private channel, identify affected recipients privately, rebuild from a reviewed known-good commit and verify a fresh build manifest before resuming. There is **no npm registry version to unpublish or roll back**, because publication is forbidden.
- **Offline-data incident:** preserve privacy-minimized reproduction notes, do not collect private browser stores, and block the impacted feature/device claim pending remediation and retest.
- **Security or access-control incident:** stop tester access using approved account controls, preserve only restricted evidence, alert the release owner and independent reviewer, and verify protection before any new invitation.

## Explicit exit gates

Do not upgrade status to public-beta/stable, claim hardware certification or publish until **all applicable** gates have real evidence: physical Android Chrome/iOS Safari and claimed peripherals/GPU, Linux CI restoration, independent signed security review, authenticated tenant-safe backend review before production sync, approved licensing/distribution, CI/build integrity and verified rollback. Track open gates in issues #6, #17, #18 and #19. A PR merge is an **engineering integration decision**, not a release approval.
