# Browser and device acceptance — not yet verified

Use localhost or HTTPS in an unrestricted browser. Required before any claim of installability or native-like parity.

| Scenario | Expected evidence |
| --- | --- |
| Initial load and controlled service worker | active controller, app shell cached |
| Offline browser reload | app shell loads without a network request |
| Close / reopen browser offline | saved records survive in the same browser origin |
| Storage pressure / data eviction | backup and recovery path documented |
| Reconnect and sync | outbox acknowledgements with no lost later edits |
| WebGPU compute | shader executes, result matches JS and workload is measured |
| WebAssembly compute | compiled WASM runs, identical operation semantics |
| Unsupported GPU | falls back without claiming GPU execution |
| Camera / hardware APIs | prompt only on user action; denied and unsupported paths behave honestly |
| Cross-browser matrix | Chrome, Edge, Firefox, Safari platform and version recorded |

A passing mock/Node test does not satisfy real browser acceptance. Managed Linux browser previously returned ERR_BLOCKED_BY_ADMINISTRATOR on navigation; report actual device/browser results separately.

