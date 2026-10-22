# Framework integrations (local tarball)

These are **source examples**, not separately deployed demo applications. The existing runnable standalone PWA is at `../basic-pwa/`.

Install the Wonder SDK npm tarball created with `npm pack` into your **existing project**, then copy the appropriate integration snippet.

- `vanilla/`: lazy SDK client with safe resource disposal, no framework.
- `react/App.jsx`: React provider + typed hook without bundling React twice.
- `vue/main.js` and `vue/App.vue`: Vue 3 plugin, injected reactive SDK client.

These examples rely on the consumer project's bundler (for package imports), framework installation, and browser-secure origin. They are not executable by simply running `python -m http.server` in this SDK repository; see `docs/DEVELOPER_SDK.md` for the fully runnable vanilla PWA and integration instructions.

React and Vue adapters accept the **host application's own framework runtime**, so Wonder Layer itself has **zero framework dependencies**. Framework-specific browser integration must still be accepted on real devices.

