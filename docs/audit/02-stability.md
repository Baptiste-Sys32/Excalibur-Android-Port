# Stability and reproducibility

## Changes and regression coverage

The overlay enabled-state effect and late bridge listener cleanup are fixed.
The native multi-file envelope is no longer recursive; transport budgets and
sanitization are isolated in ImportPolicy for JVM testing. Unused Capacitor
addition and wrong-package-name stubs are replaced with meaningful tests.

Pure tests run with Node's test runner and the already-installed TypeScript
transpiler; no test framework or runtime dependency is added. The actual source
modules are transpiled in memory, not copied implementations. App tsc remains
the type checker. Tests cover freshness, ZIP roundtrip/CRC/duplicates, offline
navigation, page settings and pen-only routing. JVM tests cover sanitized names,
count/byte boundaries and overflow. Android instrumentation uses real cache
files to build and serialize an ACTION_SEND_MULTIPLE payload.

## Open stability risks

- High: UI-thread content-provider I/O can ANR. The byte cap is not a time cap.
- High: public canvas saves can truncate on partial writes; private temp+rename
  is stronger but lacks a previous-valid index generation or fsync contract.
- High: recovery has unbounded orphan storage and no byte budget; restore is
  partial on failure and private backup coverage is incomplete.
- Medium: canvas manager virtualizes visible rows but lists all files, resolves
  all IDs and thumbnails concurrently with Promise.all; large workspaces can
  pressure memory and filesystem bridges before virtualization helps. Bound
  background loading and cancel stale queries before increasing supported size.
- Medium: backup creation materializes all input bytes, ZIP chunks and output
  blob. Restore caps 256 MiB total, 64 MiB per entry and 2000 entries but still
  copies data in memory. Large image imports permit 25 million decoded pixels
  (about 100 MB RGBA before other copies). Do not treat compressed bytes as RAM.
- Medium: shape casts from safeJsonParse validate syntax, not runtime schema.
  Corrupt index/preferences types can reach array methods or invalid paths.
- Medium: scene serialization precedes the autosave try block. A serialization
  exception can reject a fire-and-forget persist call; failures should update
  autosave health and preserve the last valid data.
- Medium: canvas versions prune files before committing their new index, and
  version saves are not globally serialized. Kill/concurrency tests are needed.
- Medium: async initial stylus get may overwrite a newer listener sample;
  pause/resume and direct override-reason transitions need a session-aware fix.
- Low: vendor type generation deliberately tolerates upstream diagnostics as
  documented; marker existence is not proof of declaration correctness. Wrapper
  type checking and runtime acceptance remain necessary.

Broad catches frequently preserve startup availability but hide details. In
particular readDataText maps all read errors to absent data, directory listing
maps errors to an empty list, migration swallows errors then marks completion,
and deletion swallows non-missing failures. Add bounded diagnostic categories
without scene contents, names, paths or credentials. Avoid replacing these with
uncaught exceptions until UI error paths exist.

## Build interpretation

Successful source builds demonstrate that toolchains can assemble the pinned
source and lockfile on this machine. They do not establish byte-identical APKs:
debug signing, timestamps, caches and toolchain versions are not normalized.
Clean detached-worktree npm ci and full debug results are recorded in LOG.md.
No dependency upgrades, engine edits, remote operations or release builds are
part of this work. Existing chunk-size/duplicate import warnings are retained.

Clean-checkout testing exposed a real baseline defect: CSS and element runtime
exports depended on ignored vendor dist artifacts. Wrapper Vite aliases now
resolve tracked CSS and pinned element sources. This changes module resolution,
not engine source. Both original and isolated builds pass with the fix; final
clean install/build outcomes are logged separately. Public assets remain tracked,
and asset sync deliberately leaves them in place if upstream dist is absent.

Dependency tooling reports 36 total advisories on npm ci, 17 with dev omitted
(1 low, 11 moderate, 5 high, no production critical). High-severity package names
in that production report are dompurify, immutable, lodash-es, nanoid and
source-map-js. This is untriaged package metadata; reachability/backport review
is required before severity becomes an application exploitability claim. Review
lockfile updates one package family at a time, preserve the engine pin, and
re-run offline and import/export security fixtures. Do not run audit fix blindly.
