# Wonder Layer — Private Beta Release Candidate Preparation

**Status:** Engineering candidate preparation started; **not approved** to distribute or publish. Current package `0.0.0-poc.1`, `private:true`. Public GitHub repository source visibility is not the same as a private npm registry.

## What has actually been validated

- Phase 7 merged on `main` at `b5e39632f03a59e7708e9aa3e33f3225aedae2c6`.
- Exact Phase 7 PR head passed Node 20/22 (96 tests each), packed Vanilla/React/Vue × Chromium/Firefox/WebKit (9 combinations), Chromium/Firefox/WebKit + Windows Edge + macOS WebKit browser matrix (five CI jobs), and CodeQL/npm runtime audit.
- macOS GitHub-hosted fallbacks were used due to Ubuntu runner allocation failures. The original Phase 6 had Linux browser evidence; Phase 7 latest head has **not** re-established Linux CI.
- Post-merge main-branch CI needs separate evidence; PR-head success should not be mislabeled as post-merge completion.

## Private Beta Build Provenance

After a reviewed checkout, run:

```sh
npm test
npm run check:release
node tools/beta-candidate.mjs
```

`results/private-beta-build-manifest.json` records SHA-256 hashes of files in `dist` and, when GitHub Actions provides it, the exact commit. It is **build integrity metadata, not a security signature or release approval**. Only this metadata is uploaded as an Actions artifact; it must not accidentally upload a publishable SDK tarball.

Never execute `npm publish` or remove `private:true` without a written authorized decision and approved license. Distribution to invited testers must use an explicitly authorized access-controlled channel; GitHub Actions artifacts in a public repository are not an acceptable default channel for private distribution.

## Physical-device intake (release gate)

1. Use a trusted, **access-controlled HTTPS** deployment of the static repo and `/examples/device-lab/` in a browser on each *physical* device.
2. Run consented hardware tests; save synthetic data; go offline; reload; verify the page and synthetic IndexedDB value remain available; reconnect and export the privacy-minimized JSON.
3. Validate locally with `node tools/verify-device-evidence.mjs <report.json>`. It always reports `attestedPhysicalDevice:false`; an authorized human tester must separately attest actual physical hardware and exact OS/browser version.
4. Store evidence and reviewer identity **privately**, never in public GitHub Issues; publish only aggregated compatible/unsupported categories.
5. Verify physical Android Chrome and iOS Safari separately. WebKit emulation is not an iPhone.

## Independent human security reviewer gate

Provide the reviewed commit SHA, `docs/PHASE7_INDEPENDENT_REVIEW.md`, CodeQL/dep audit evidence, threat model, source, test results and restricted findings channel to a reviewer **independent of SDK implementation**. Obtain signed findings, resolve high/critical issues and authorize any exception before proposing release. Automated scans cannot sign off on this.

## Compatibility evidence status

| Area | Evidence | Status |
| --- | --- | --- |
| macOS Chrome/Firefox/WebKit Playwright engines | Phase 7 hosted PR CI | VERIFIED in automated host runners |
| Windows Edge Chromium | Phase 7 hosted PR CI | VERIFIED in hosted Windows |
| Linux Chromium/Firefox/WebKit | Phase 6 hosted PR CI | Historical verified; Phase 7 Linux runner restoration open |
| React/Vue/Vanilla SDK consumer integration | Phase 7 packaged browser tests | VERIFIED in Playwright engines |
| iOS Safari physical device | None supplied | NOT TESTED |
| Android Chrome physical device | None supplied | NOT TESTED |
| Hardware WebGPU shader on real adapter | None supplied | NOT TESTED |
| BLE/USB/HID/serial peripherals | No physical tested peripherals | NOT TESTED |
| Production authenticated tenant-safe sync server | No approved server assessment | BLOCKED |
| Independent human security audit | No independent signed report | BLOCKED |
| License, package publication, public beta | Not approved | BLOCKED |

## Release decision

Engineering artifacts can be prepared and checked. **No stable or public release is approved** until physical device, external security, authentication/tenant isolation (if sync is offered), Linux CI and licensing gates are resolved.

Tracking: [Issue #19](https://github.com/RyzovaTech/wonder-layer/issues/19), [Issue #17](https://github.com/RyzovaTech/wonder-layer/issues/17), [Issue #18](https://github.com/RyzovaTech/wonder-layer/issues/18), [Issue #6](https://github.com/RyzovaTech/wonder-layer/issues/6).

