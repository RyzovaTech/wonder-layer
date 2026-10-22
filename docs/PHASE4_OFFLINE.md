# Phase 4 — Offline reliability and PWA lifecycle

This is a **pure-PWA engineering implementation**, not a guarantee that any online-only application will function offline.

## Data safety

- IndexedDB schema version upgraded to v2, preserving existing records/outbox and creating metadata storage for future migrations.
- `store.importRecords(records,{overwrite:false})` validates the full batch before opening a single read-write IndexedDB transaction. Failure aborts the transaction; browser transactional atomicity protects against partial imports.
- Backup `wonder.backup()` now exports checksum-protected format v2. `wonder.restore()` preserves the old return contract `{imported,skipped}`; `wonder.recovery.restore()` also exposes integrity/version metadata.
- Original version 1 backups remain compatible. Such backups are **not integrity-authenticated**.
- SHA-256 protects against accidental corruption. It **does not authenticate a backup creator and is not encryption**. Never import backups you do not trust.
- Backup restoration marks records dirty and queues new mutations for later sync; do not automatically upload without a trusted, authenticated endpoint.
- IndexedDB and OPFS storage remain origin- and profile-scoped; browser settings, eviction and user actions can delete data.

## Storage pressure

```js
const health=await wonder.recovery.storageStatus();
console.log(health.ratio,health.persisted,health.evictionPossible);
persistButton.addEventListener("click",()=>wonder.recovery.requestPersistence());
```

Quota is an estimate; a granted persistence request is **not** a backup or immunity from user-initiated clearing.

## Reconnect controller

```js
const sync=wonder.reconnect({
  onStatus:state=>console.log(state),
  baseDelayMs:1500,maxDelayMs:120000
});
// Start only if the host configured an authorized HTTPS sync endpoint.
sync.start();
// Stop on component teardown:
sync.stop();
```

Exponential backoff, deduplication and event-based resume work only while a page is running and visible. Conflicts are not automatically overwritten; stalled queues are surfaced. The SDK does **not** include multi-tenant authenticated server sync.

## Safe PWA update

```js
await wonder.pwa.register("./sw.js",{scope:"./"});
await wonder.pwa.checkForUpdate();
// On deliberate user confirmation after saving edits:
wonder.pwa.activateWaiting();
```

The example service worker now uses v3 cache and **does not** `skipWaiting()` on install. New-worker activation is explicitly initiated by a host app, so active work is not silently disrupted.

## Tests and full-device acceptance

```sh
npm test
npm run test:phase4
python3 tests/browser_acceptance.py --browser chromium
```

Unit tests exercise checksums, recoveries, retry states and lifecycle state-machine behavior. Real browsers must still validate forced termination mid-import, offline cold start, service-worker update under unsaved edits, quota pressure, devices and storage eviction. GitHub Actions Node 20/22 is required for CI, but **CI alone does not prove device-level reliability**.
