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

## Offline wrapper policy

- Added pre-script CSP for local/data/blob assets, blocking remote resource loads
  and frames. Explicitly disabled AI/embeds via public props; hid online library
  browse/publish/help links from src and blocked external navigation callbacks.
- Built output still contains upstream host strings (18 distinct host strings in
  JavaScript). Presence is not reachability; CSP is the resource boundary.
- tsc, lint, build, Java compile, diff check and full debug build passed.
- API 36 emulator: airplane mode=1, Wi-Fi disabled, cold launch completes with two
  canvas nodes; Assistant and Excalifont loaded, zero errored font faces at launch.
  Local index fetch returned 200; external esm.sh fetch was rejected by CSP.
  A rectangle drawn through adb touch was autosaved as one rectangle in private
  storage. Physical S Pen timing and complete export matrix remain unverified.

## Regression suite

- Added npm test (Node built-in runner, existing TypeScript transpiler) and CI step.
- Seven pure tests pass, including 8000 guide-quantization inputs. Extracted the
  existing quantization unchanged into pageSettings.ts so tests exercise the
  actual helper. Old historical scene-rounding error at 30x reproduced as
  14.9925 px versus current 0.4997 px; this session does not change that bound.
- Two JVM tests and two Android instrumentation tests pass, including actual
  snapshot similarity thresholds and discrete changes. Full verification passes.
- Airplane-mode persisted rectangle survived force stop/relaunch. Simple local
  PNG/SVG/PDF exports succeeded: 1098 / 1264 / 28153 bytes respectively. These are
  existence/size smoke checks, not comprehensive visual export acceptance.

## Clean checkout blocker

- Detached checkout at bed46dfa: npm ci passed (879 packages). Full debug failed
  in Vite because @excalidraw/excalidraw/index.css resolves to ignored vendor dist.
- Package review also found @excalidraw/element runtime exports point to ignored
  dist, unlike common/math source exports. This requires wrapper Vite aliases to
  tracked CSS and pinned element source. No vendor edits or dependency upgrade.
- npm ci reports 36 dependency advisories (2 low, 13 moderate, 20 high, 1 critical).
  This is npm's aggregate report, not a verified exploitability assessment or an
  app-only count. VENDOR.md already records one version-based false positive.
  No automatic audit-fix or unreviewed dependency/engine update was performed.

## Build source resolution

- Added Vite aliases for the tracked prebuilt CSS and pinned element source.
  No vendor file changed. Main-checkout tsc/lint/build/Java/diff checks pass.
- The detached checkout with this wrapper config completes full debug assembly
  from npm ci without vendor runtime dist. A final committed-state rerun follows.
- Core bundle is now 5425.08 kB (gzip 1856.42 kB), versus baseline 5469.71 kB
  (gzip 1868.03 kB). This reflects source resolution, not a claimed speed gain.
- Rebuilt APK launches in airplane mode with local Assistant/Excalifont. Synthetic
  pen pointer at (100,120) produces exactly translate3d(100px,120px,0); ring is
  visible after rAF and hidden after 600 ms observation. No physical latency claim.

## INTERNET comparison

- Temporary detached-worktree variant removed only INTERNET. aapt confirms the
  merged APK requests no INTERNET (only the generated receiver permission).
- API 36, WebView 133.0.6943.137, airplane mode and Wi-Fi disabled: no-INTERNET
  variant launches, exposes two canvas nodes, local fetch=200, DrawBridge call
  succeeds, Assistant/Excalifont load, and a touch rectangle autosaves.
- PNG/SVG/PDF outputs exist at 1088 / 1244 / 28119 bytes. PDF completed after
  the initial 2 s observation window, so results were checked again afterward.
- INTERNET is retained in production because local provider/share workflows,
  complex font/image exports and other supported Android/WebView combinations
  are not fully certified. Capacitor does not universally require the permission
  for this tested local launch path. Removal is a viable follow-up with the
  explicit physical-device acceptance checklist, not a proven universal failure.
- Production-only npm audit reports 17 advisories (1 low, 11 moderate, 5 high,
  zero critical). These are package reports, not verified runtime exploitability.

## Final clean checkout and measurement summary

- Committed source 3dae8672, detached worktree: npm ci, seven pure tests, full
  npm run android:build:debug, tsc, lint, Java compile and two JVM tests pass.
  git status is empty and diff --check passes. This is a clean source rebuild,
  not a claim of byte-identical APK reproducibility. No vendored dist was copied
  from the workstation. Full debug Gradle phase: 21 s on this rerun.
- Temporary no-INTERNET edit is restored in the worktree. A wrong-root Gradle
  invocation during that experiment returned 127, then the correct android/
  wrapper path built successfully. Production manifest is unchanged throughout.
- No-INTERNET rectangle also survives force stop/relaunch; two canvases render.
  An early observation during startup returned zero canvases, then settled to two.
- This session did not measure S Pen latency, event loss, hardware ring offset,
  UI-thread trace cost, or peak heap. Device measurement procedures are explicit.

| Quantity | Before | After | Evidence type |
| --- | --- | --- | --- |
| Hover inactivity bound with stale proximity | Potentially indefinite | 500 ms plus scheduling | Code; synthetic visible after rAF, hidden at 600 ms |
| Future wall-clock sample accepted | Yes | No | Pure boundary test |
| Native files attempted per batch | Unbounded | 32 | JVM/native code bounds |
| Native batch / queued raw bytes | Unbounded | 64 MiB / 64 MiB | JVM/code bounds, excludes encoding/serialization copies |
| Multi-file envelope cycle | Present | Absent | Android serialization regression |
| Wrapper pure / meaningful JVM / Android tests | 0 / 0 / 0 | 7 / 2 / 2 | Passing runners |
| Clean npm ci full debug | Fails at ignored CSS/runtime dist | Passes | Detached worktree rebuild |
| Core JS / gzip | 5469.71 / 1868.03 kB | 5425.08 / 1856.42 kB | Vite output, no speed claim |
| Guide scroll error at 30x | 0.5 px bound at baseline | Same 0.5 px bound | 8000-input regression, existing correction preserved |

## Commit map

- f4a54a01: baseline and scoped working rules.
- 0ce41f29: hover and listener lifecycle.
- 81db8768: bounded, nonrecursive native intake and transport tests.
- 5ea143c5: local resource CSP and online UI containment.
- bed46dfa: wrapper/native regression coverage and CI.
- 3dae8672: clean-checkout runtime resolution.
- Final audit documentation commit: storage inventory corrections, severity and
  feature reports, measurement summary and device acceptance checklist.

No engine source edits, runtime dependencies, feature additions, new remotes,
fetches, pushes or release builds. No intentional rule exception. SDK discovery
was supplied per command because the requested bare Gradle invocation failed.

## Final main-checkout verification

- Seven pure tests, tsc, lint, web build, Java compile, two JVM tests, diff check
  and full debug build pass. Final web Vite phase: 21.94 s; full debug Gradle
  phase: 3 s incremental. Timing depends on caches and concurrent load.
- Restored normal production APK on the emulator; aapt confirms its unchanged
  INTERNET permission. A CDP probe immediately after installation found the app
  stopped; it was relaunched before continuing acceptance checks.
- Audit docs contain no em/en dashes; vendor tracked diff remains empty and
  tracked credential-marker scan remains zero. No remote mutation occurred.
- Final disabled-at-start acceptance: persisted Off through the UI, cold launched
  with no ring node, enabled through Pen & touch, then synthetic pen movement
  created a visible ring at exactly (110,130). Initial setup did not satisfy the
  Off precondition and was repeated explicitly; only the confirmed run is counted.
- All remaining physical S Pen, provider, low-storage and complex-export checks
  are collected in DEVICE-CHECKLIST.md with originating commit references.

## Feature 3: writing screen timeout

- Added opt-in Keep awake while writing in Pen & touch, default Off.
- Native stylus/eraser contact sets an Activity-only KEEP_SCREEN_ON flag; hover,
  fingers and mouse do not extend it. Timeout is 120 s since the last contact.
- One scheduled timeout checks the monotonic deadline; no task/window update is
  enqueued for every point. Pause, destruction and disabling clear the flag.
- Pure JVM policy test covers opt-in, last-contact extension, expiry and resume.
  tsc, lint, web build, Java compile, JVM and existing pure tests pass.
