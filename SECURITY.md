# Wonder Layer Security Policy — Experimental SDK

The SDK remains a private pre-release. **Security hardening is not a third-party audit or production certification.**

## Sync transport and trust boundaries

- `store.sync(endpoint)` permits same-origin URLs only, requiring HTTPS except local loopback development. Cross-origin URLs, unsafe schemes, URL credentials, fragments and redirects are blocked. The browser sends same-origin credentials with `no-store` and `no-referrer`.
- Default SDK sync is **not started automatically**. Never call `sync()` or start foreground/reconnect sync unless an authorized host server has been configured.
- The server must implement authentication, per-record ownership/tenant authorization, CSRF defenses where cookies are used, rate limits, input validation and idempotent operation IDs. **Same-origin is not authentication.**
- Untrusted response acknowledgements and conflicts must refer to operations sent in the current batch; duplicate, unrelated and malformed results are rejected before local changes. Network bodies are streamed with an explicit byte limit to reduce oversized JSON memory-exhaustion risk. Browser failure and server failures retain queued local work for retry.
- Never expose a demo/unprotected `/api/sync` endpoint publicly. CSP, TLS/HSTS, cookie security and response security headers belong to the host application deployment.

## Local storage and backup

- Browser IndexedDB/OPFS data are origin- and profile-scoped. Clearing site data, eviction, OS failure or profile change may remove them.
- Version 2 backups include SHA-256 integrity checks against accidental corruption; **they are neither encrypted nor authenticated**. A malicious creator can replace data and calculate a new SHA-256 checksum. Import only backups from trusted sources.
- Atomic restore transactions help avoid partial writes; they are not a substitute for tested backup recovery and physical device crash tests.
- Avoid storing sensitive business records unencrypted without a specific application security/privacy review.

## Device and PWA permissions

- All camera, microphone, geolocation, Bluetooth, USB, HID and serial access follows explicit user activation and browser rules. No silent privilege escalation.
- Release device lab: `examples/device-lab/`. Results are downloaded only on user action. No raw media, coordinates, device IDs or file contents are intentionally captured or uploaded.
- The host app controls its own Service Worker and safe update/rollback policy. Same-origin XSS, compromised hosting and unsafe third-party scripts can undermine storage and permissions.

## Private vulnerability reporting

Contact repository maintainers through GitHub private vulnerability reporting when enabled. Do not place exploitable details, real personal information, tokens or secrets in public issues.

See [Phase 7 release/security gates](docs/PHASE7_RELEASE_CHECKLIST.md) and [physical device validation](docs/PHASE7_DEVICE_VALIDATION.md). No third-party penetration test or security certification has been completed.

## Repository visibility and licensing

The **GitHub source repository is public**, but the npm package is marked `private: true` and **no software license is selected**. These are distinct properties: the private npm flag does **not** make public source code confidential. Do not copy API secrets or customer records into public repository files, logs, issues or device evidence.
