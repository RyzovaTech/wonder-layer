# Phase 7 — Security & Release Preparation (pre-release gate)

## Controlled beta preparation

- [x] Device Lab offline Service Worker shell and synthetic IndexedDB persistence test added
- [x] Build-file SHA-256 manifest generation; CI uploads integrity metadata only, not public tarballs
- [x] Review and device attestation template drafted
- [ ] Physical tester reports, independent reviewer acceptance, license/publication policy and Linux CI restoration remain open

See [Private Beta RC plan](PRIVATE_BETA_RC_PLAN.md). No private beta distribution or public release is approved merely by automated builds.

## Engineering progress

- [x] Restore Phase 6 consumer CI after browser dependency download timeout, PR #15
- [x] Restrict SDK sync to same-origin endpoints; same-origin credentials, no-referrer, no-store, redirect error
- [x] Validate each server acknowledgement and conflict against submitted mutation IDs
- [x] Reject duplicate, stale/unrelated/malformed sync responses before altering local storage
- [x] Fail-closed content type, streamed response size budget and bounded JSON parsing (not just Content-Length)
- [x] Preserve offline Service Worker dependency cache when new modules are added
- [x] Prepare privacy-minimized manual real-device hardware/GPU acceptance lab
- [x] Prepare automated security contract/regression checks

## Security requirements *not* implemented or not verified

- [ ] External independent security review and sign-off of the published threat model in `docs/PHASE7_INDEPENDENT_REVIEW.md`. CodeQL is automated analysis, not a replacement for independent human assessment.
- [ ] Authenticated multi-tenant production sync **server**. Same-origin URL restriction alone does **not** provide authentication/authorization, CSRF protection, audit logging, rate limiting or tenant isolation.
- [ ] Strict CSP and security headers configured by the deploying **host application**. SDK cannot impose response headers on host sites.
- [ ] Formal malicious backup, corrupt IndexedDB and crash-interruption fuzzing on real devices.
- [ ] Independent penetration testing of camera/microphone/device consent and permissions.
- [ ] Production performance measurements on supported physical WebGPU hardware.
- [ ] Physical Android/iOS device validation with exact browser/OS versions.
- [ ] Approved software license and release/publication authority, verified release provenance and signed tags.
- [ ] Version/support matrix, release notes, upgrade/rollback tests and explicit stable release criteria.

## Publication invariant

`package.json` must retain `private: true` until release authorization, license selection and evidence gates are completed. CI should catch accidental publication enabling. **No version bump or registry deployment** is authorized by this phase.

## Release readiness distinction

**Security hardening implemented** means the specific sync risks above have code and regression tests. It does NOT certify production security or universal device compatibility. `0.0.0-poc.1` remains an experimental SDK.

