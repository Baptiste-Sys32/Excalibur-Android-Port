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
