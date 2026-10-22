# Phase 7 — Physical Device Validation Protocol

**This is an execution protocol, not a claim that Android/iOS or physical hardware already passed.**

## Safe local device lab

Run the repository over HTTPS on the target device (or localhost on that same device) and navigate to `/examples/device-lab/`. For a phone connecting to a development computer, ordinary `http://192.168.x.x` is **not a secure context** and will typically block hardware APIs. Use a trusted HTTPS deployment with authentication and access controls, or host on-device; avoid sharing private test data or exposing demo sync endpoints on the public Internet.

The lab uses **real user click events** to initiate camera, microphone, geolocation, Bluetooth, USB, HID, serial and WebGPU shader tests. Browser permissions and hardware support may vary. A denied prompt is **not** a passing capability test. Results are exported only when a user clicks Download and contain coarse statuses. The lab never transmits or retains raw coordinates, image frames, recorded audio, device IDs, or file contents.

### Matrix — record exact devices and evidence before changing status

| System | Browser | Device owner to run | Status |
| --- | --- | --- | --- |
| Android physical phone | Chrome stable | Authorized device tester | NOT TESTED |
| iPhone physical device | Safari | Authorized device tester | NOT TESTED |
| iPhone physical device | Chrome (WebKit restrictions may apply) | Authorized device tester | NOT TESTED |
| Windows physical laptop | Edge/Chrome/Firefox | Authorized device tester | NOT TESTED |
| macOS physical Mac | Safari/Chrome | Authorized device tester | NOT TESTED |
| Linux physical desktop | Chrome/Firefox | Authorized device tester | NOT TESTED |
| Real supported WebGPU adapter | Actual shader dispatch and numeric parity | GPU device tester | NOT TESTED |

### Acceptance procedure

1. Record OS/browser version, install mode (browser/PWA standalone), secure-context state and device type. **Do not record serial numbers, location or account identity.**
2. Visit the existing PWA demo and verify initial online load → cache installation → offline reload → full browser termination → restart while offline → IndexedDB records and backup recovery.
3. Test permission **granted, declined and unsupported** states only from explicit user gestures. After media permissions, verify tracks are stopped.
4. On a physical GPU, click the GPU shader button and require `backend === "gpu"` with numerical verification; if no adapter, log unsupported, not passed.
5. Verify storage quota pressure, user-clearing behavior, interrupted IndexedDB transaction and multi-tab service worker updates manually. Document data loss/recovery incidents.
6. Export only the privacy-minimized JSON evidence from the lab. Record exact device OS/browser version in a private test report without identifying people.
7. Have an authorized reviewer approve each OS/browser capability claim; update the compatibility matrix only for genuinely tested setups.

**Not interchangeable with hardware tests:** Linux Playwright WebKit mobile emulation is not iOS Safari; Android-style Chromium emulation is not a physical Android device. GitHub Windows/macOS runners do not grant real phone camera/Bluetooth/NFC capabilities.

## Release decision

The SDK can remain in a private beta while physical validation is incomplete. Public native-like compatibility claims require at least one real device in each claimed category and documented limitations.

