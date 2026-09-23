# Data map

This is the authoritative storage inventory for the rebuild baseline. Paths below
are relative to the storage root used by each backend.

## App-private storage

Implemented in `src/lib/persistence.ts`.

- `scenes/autosave.excalidraw`
  - Latest autosaved scene.
- `scenes/recovery/<snapshot-id>.excalidraw`
  - Crash/background recovery snapshots.
  - Default retention is intended to be bounded; verify before relying on pruning.
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
  - Custom templates and template metadata.

## User-visible storage

Default public root is:

- `Documents/Excalidraw/canvases/*.excalidraw`
- `Documents/Excalidraw/libraries/*.excalidrawlib`
- `Documents/Excalidraw/exports/*`
- `Documents/Excalidraw/backups/*.zip`

Treatment during the rebuild:

- Private storage becomes canonical for autosave, recovery, versions, libraries,
  templates, and canonical scenes.
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

Restore must verify manifest identity and version, validate entry scope, stage
before overwriting, and report restored, renamed, skipped, and failed files.

## Incoming files

Android accepts:

- `ACTION_VIEW`
- `ACTION_SEND`
- `ACTION_SEND_MULTIPLE`

Relevant MIME families include Excalidraw JSON, Excalidraw libraries,
octet-stream files, and images. The current compatibility intake limit is 8 MiB
per file. Multi-file imports must retain per-file provenance and errors.

## Migration safety rules

- Never delete a legacy source before its replacement is verified.
- Never overwrite an index without first preserving the previous valid copy.
- Never mark migration complete after partial failure.
- Keep old backup archives byte-for-byte readable.
- Preserve canvas IDs and version associations across storage moves.
