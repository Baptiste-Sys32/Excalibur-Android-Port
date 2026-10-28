# Work log

## Baseline

- Read existing docs, migration record, recent history, bridge, activity and hover overlay.
- Created codex/stabilize from clean main. No remote operations.
- tsc and lint passed; Vite built in 24.89 s with existing vendor declaration
  diagnostics and large chunk warnings.
- No adb device. Found two installed AVDs and attempted headless emulator.
- Found circular multi-file intent JSON, unbounded files per intent, stale hover
  proximity, disabled-at-mount overlay effect, and asynchronous listener cleanup race.
- Recovery metadata retains eight entries but orphan files and deletion failures
  can escape retention. Restore is not a transaction. Document before changing
  storage semantics without a device backup.

## Baseline follow-up

- Initial direct Gradle failed because SDK discovery was unset. With command-local
  ANDROID_HOME, compilation passed (110 tasks, 1 min 1 s on first setup).
- First AVD failed with unsupported ARM configuration. FocusFlight_API36 booted
  headlessly as emulator-5554. No physical pen hardware is present.
- Guard patterns cover the requested credential filenames in both ignore files;
  tracked credential marker scan found zero matching files (no contents printed).
- Initial validation runs overlapped while reading/building. Final per-change and
  isolated checkout checks are authoritative; elapsed times under concurrent CPU
  load are not performance improvements.

## Hover and listener lifecycle correction

- Effect now follows enabled state; late listener registration is torn down when
  disposed. Hover no longer trusts an indefinitely stale proximity bit.
- Native display freshness accepts [0, 300) ms and rejects future timestamps.
  Inactivity display expiry: previously potentially unbounded, now 500 ms plus
  event-loop scheduling. This is a code bound, not a measured hardware delay.
- Final tsc, lint, build (Vite 33.00 s), Java compile (5 s), diff check passed.
  Freshness and ZIP pure smoke tests passed; expanded test suite follows.

## Native intake hardening

- Separate batch envelope from file objects to remove the recursive JSON graph.
- Limit attempted files to 32, accepted batch bytes to 64 MiB, and queued raw bytes
  to 64 MiB in addition to ten slots. This excludes transient/base64/JSON copies;
  it is not a total heap ceiling. Overflow still discards oldest queued batches.
- Do not retain duplicate intent events when no listener exists; the queue is
  the durable process-local source. Guard malformed parcels/provider failures.
- Sanitize path segments, control characters, dot names and long display names.
- Replace template addition/package-name tests with JVM transport policy tests
  and a real Android two-file payload serialization regression test.
- Native intake validation passed: tsc, lint, web build, Java compile, two JVM
  policy tests and one Android instrumented serialization test on API 36 AVD.
  A simultaneous manual instrumentation attempt raced Gradle's test lifecycle
  and found no installed runner; the Gradle connected test completed successfully.
