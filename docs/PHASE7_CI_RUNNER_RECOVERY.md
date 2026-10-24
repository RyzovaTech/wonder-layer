# Phase 7 — GitHub runner recovery

**2026-10-24 runner incident:** GitHub Actions run attempt #3 on the Phase 7 PR failed for all `ubuntu-latest` jobs **before any step executed** (no runner allocated, `runner_id:0`, `steps:[]`), despite repeated requests. Windows Edge and macOS WebKit jobs had actually executed and passed. No product test failure can be inferred from a run with zero steps.

For this PR the default runner of Node 20/22, packed consumer builds, CodeQL + dependency audit, and desktop Chromium/Firefox/WebKit test jobs is temporarily set to `macos-latest`, a runner pool which actually executed recent macOS WebKit acceptance checks. These jobs remain required; they are not downgraded to `continue-on-error`.

Important caveats:
- Mac-hosted Chromium, Firefox and WebKit are **real browser engines on macOS**, not Linux desktop acceptance.
- Linux acceptance was independently performed in Phase 6 on Linux runners. It has **not been repeated on this Phase 7 head** due to runner allocation failure.
- Re-establish `ubuntu-latest` CI in a follow-up PR after the runner pool recovers, or add dedicated Linux self-hosted infrastructure. Do not delete old Linux incident evidence or assert that macOS constitutes Android/iOS hardware testing.
- If macOS runner allocation also fails, classify it as infrastructure and keep Phase 7 CI gate open; do not merge solely to silence checks.

Evidence:
- Original Linux runner incident: [GitHub issue #6](https://github.com/RyzovaTech/wonder-layer/issues/6)
- Repeated failed attempt #3: SDK run `39787345110`, consumer `39787345308`, browser `39787345164`, security `39787345353`.
- The corrected runner selection is versioned with the Phase 7 feature PR and must pass current-head CI before merging.
