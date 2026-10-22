# Phase 5 — Universal Developer SDK acceptance and release gates

## Engineering deliverables

- [x] ESM package entry and optional client/React/Vue subpath exports
- [x] Dependency-free deterministic build preserving WASM/Worker asset locations
- [x] TypeScript declarations and typed public API shape
- [x] Lazy client lifecycle for existing web apps and hydration-safe imports
- [x] Vanilla, React and Vue integration examples and developer guide
- [x] CI build, Node tests, npm package content inspection
- [ ] Public publishing — deliberately blocked pending RyzovaTech license and approved release scope

## Package verification

```sh
npm run build
npm test
npm pack --dry-run
npm pack
```

Check tarball for `dist/compute.wasm`, `dist/compute-worker.js`, `dist/index.d.ts`, `dist/client.js`, `dist/react.js` and `dist/vue.js`. Binary is included locally, not fetched from a third party.

## Release blockers and external acceptance

1. Select a repository/package license explicitly; `private: true` remains in force until authorized.
2. Verify TypeScript declarations with a consumer project using its own TypeScript and React/Vue dependencies.
3. Verify React strict-effect/remount and Vue plugin teardown in real framework applications (static and mocked adapters are not sufficient).
4. Full browser/OS matrix for install, offline restart, storage eviction, permission denial, WebGPU correctness.
5. Threat review, signed/versioned release process and clear support policy before public distribution.
6. Audit WASM asset URL resolution in target bundlers (Vite, Webpack, Rollup etc.). Some bundlers require explicit asset-copy handling.
7. Validate production sync authentication, data tenancy, conflict resolution and backups before enabling upload.

**Scope:** Phase 5 engineering build complete means the SDK is installable as a local tarball with passing automated code/package tests, not that universal native-like compatibility or a public npm release has been certified.

