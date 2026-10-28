# Data map

This is the authoritative storage inventory for the rebuild baseline. Paths below
are relative to the storage root used by each backend.

## App-private storage

Implemented in `src/lib/persistence.ts`.

- `scenes/autosave.excalidraw`
  - Latest autosaved scene.
- `scenes/recovery/<snapshot-id>.excalidraw`
  - Crash/background recovery snapshots.
  - Metadata is sliced to eight entries after each successful snapshot write.
  - Deletion is best-effort, with no directory reconciliation or byte budget.
    Crashes and deletion failures can leave unbounded orphan files.
- `scenes/autosave.degraded.excalidraw`
  - Image-free fallback when full autosave fails; bootstrap does not load it automatically.
- `library/default.excalidrawlib`
  - Canonical private library.
- `canvas-manager/index.json`
  - Canvas identity and pin metadata.
  - Current key shape is effectively `location:path`.
- `canvas-manager/thumbnails/<hash>.txt`
- `canvas-manager/thumbnails/<hash>.json`
  - Cached thumbnail image and validation metadata.
- `canvas-manager/versions/<canvas-id>/index.json`
- `canvas-manager/versions/<canvas-id>/<version-id>.excalidraw`
  - Timeline versions for a canvas ID.
- `templates/custom/index.json`
- `templates/custom/items/<template-id>.excalidraw`
- `canvas-manager/thumbnails/template-<template-id>.txt`
  - Custom templates and template metadata.

## User-visible storage

Default public root is:

- `Documents/Excalidraw/canvases/*.excalidraw`
- `Documents/Excalidraw/libraries/*.excalidrawlib`
- `Documents/Excalidraw/exports/*`
- `Documents/Excalidraw/backups/*.zip`

Treatment during the rebuild:

- Private storage is canonical for autosave, recovery, versions, libraries and
  templates. Explicit saved canvases are still written to Documents on Android.
- Public storage remains a compatibility source and explicit export/workspace
  destination.
- Do not automatically mirror the same drawing in both trees.

## Preferences

Implemented through Capacitor Preferences:

- `draw/recents`
  - Recovery snapshot metadata.
- `draw/settings`
  - Editor settings.
- `draw/legacyMigrationComplete`
  - Legacy external-storage migration marker.

On web, app-private text is namespaced under localStorage keys beginning with:

- `draw/data/`

## Backups

Backup archives live under:

- `Documents/Excalidraw/backups/*.zip`

Current v1 backup expectations:

- `manifest.json`
- `canvases/`
- `libraries/`
- `exports/`
- Legacy `app-data/` entries

Actual backup includes public canvases, libraries and exports, plus private
canvas-manager/index.json, templates/custom/index.json and indexed template files.
It omits private autosave, degraded autosave, recovery, canonical library,
versions, thumbnails and Preferences. It is not a full app-data backup.

Restore verifies identity/version, listed byte sizes, ZIP CRCs and broad path
scope before applying entries. Public conflicts are renamed. Private app-data
paths overwrite atomically per file, but there is no staging/transaction across
files, no previous-valid index copy, and no partial-result return after failure.
These are safety requirements still to implement, not existing guarantees.

## Incoming files

Android accepts:

- `ACTION_VIEW`
- `ACTION_SEND`
- `ACTION_SEND_MULTIPLE`

Relevant MIME families include Excalidraw JSON, Excalidraw libraries,
octet-stream files, and images. The current compatibility intake limit is 8 MiB
per file. Native intake now attempts at most 32 files and accepts at most 64 MiB
per batch, with a 64 MiB raw-byte queue budget and ten batch slots. Overflow drops
the oldest batches. Base64 and serialization copies consume additional memory.
Rejected native files currently have no per-file error result. The MIME policy
accepts a supported extension OR a JSON/image MIME, rather than a strict allowlist.

## Migration safety rules

- Never delete a legacy source before its replacement is verified.
- Never overwrite an index without first preserving the previous valid copy.
- Never mark migration complete after partial failure (current legacy migration
  violates this: copy failures are swallowed and completion is set in finally).
- Keep old backup archives byte-for-byte readable.
- Preserve canvas IDs and version associations across storage moves.
