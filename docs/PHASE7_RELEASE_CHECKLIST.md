# Phase 7 — Security & Release Preparation (pre-release gate)

## Engineering progress

- [x] Restore Phase 6 consumer CI after browser dependency download timeout, PR #15
- [x] Restrict SDK sync to same-origin endpoints; same-origin credentials, no-referrer, no-store, redirect error
- [x] Validate each server acknowledgement and conflict against submitted mutation IDs
- [x] Reject duplicate, stale/unrelated/malformed sync responses before altering local storage
- [x] Fail-closed content type and size metadata handling, bounded accepted response
- [x] Preserve offline Service Worker dependency cache when new modules are added
- [x] Prepare privacy-minimized manual real-device hardware/GPU acceptance lab
- [x] Prepare automated security contract/regression checks

## Security requirements *not* implemented or not verified

- [ ] Formal third-party security review and browser threat model (XSS, storage theft, extensions, shared origin).
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

