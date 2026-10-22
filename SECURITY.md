# Security policy (pre-release)

This repository is an experimental SDK, not a production secure sync service.

- Never connect an unauthenticated demo sync endpoint to the public Internet.
- Respect browser permissions: no silent installation, device access or permission bypass.
- Do not upload local data without application-owner consent.
- Treat imported backups and server acknowledgements as untrusted data.
- Offline storage is origin-scoped, can be evicted and is not a substitute for backups.
- Report vulnerabilities privately to the repository maintainers using GitHub private vulnerability reporting when available. Do not include secrets or exploit payloads in public issues.

