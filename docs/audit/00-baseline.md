# Baseline, 2026-10-28

Starting commit: `1a315700`, clean `main`; work branch `codex/stabilize`.
Read the 30 latest commits, all three existing docs, MIGRATION.md, both Java
classes and StylusHoverOverlay before implementation. No repository AGENTS.md.
Local refs include the migration branch and upstream history; no fetch or push.

Node v24.14.0, OpenJDK 21.0.12.1. adb reports no attached devices.
Difference from the report: SDK emulator and two AVDs are installed.

Baseline tsc and ESLint pass. Web build passes (24.89 s Vite phase).
Vendor declaration generation prints pre-existing errors but explicitly accepts
emitted declarations after layout validation, as documented in VENDOR.md.
Largest core chunk: 5,469.71 kB, gzip 1,868.03 kB. This is a warning, not a
failed build. Android compilation result is recorded in LOG.md.

The manifest retains INTERNET, allowBackup=false, and the existing app ID.
No runtime dependency has been added. No S Pen measurements are possible yet.
Static findings are not device measurements; see DEVICE-CHECKLIST.md.
