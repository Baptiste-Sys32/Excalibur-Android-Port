# Local workspace and writing timeout

## Keep awake while writing

Pen & touch > Keep awake while writing is Off by default. When enabled, pen or
eraser contact keeps this Activity's screen awake for 120 s after the last
contact. Hover, finger input and mouse do not renew the deadline. Backgrounding,
disabling and Activity destruction clear it immediately. Resume requires a new
contact. The system timeout and wake-lock permissions are not changed.

## Choose a local workspace

Canvases > Choose workspace folder opens Android's folder picker. Select a
folder on internal storage or an SD card and grant read/write access. Excalibur
uses an Excalidraw subfolder containing canvases, libraries, exports and backups.
Cloud providers are rejected even if they appear in the system picker. No
network service or new runtime dependency is used.

Selection is remembered across process restarts. Cancel leaves the old selection
intact. Use default Documents folder returns to Documents/Excalidraw. Switching
never migrates, deletes or automatically copies existing files. Re-select a
previous workspace to see its canvases again. The current drawing is privately
autosaved before switching, and can then be explicitly saved into the new root.

Autosave, recovery, the canonical library, templates and version history remain
app-private. Public canvas identities include their tree URI and relative path,
so identical filenames in different workspaces do not share a canvas ID or
thumbnail/version association. Renaming a canvas preserves its ID. External
renaming/removal of a root or SD card can invalidate Android's document IDs;
re-select the folder if unavailable. The app does not silently redirect writes
into a different workspace when a grant fails.

Prior grants are retained for outstanding file references; resetting selection
does not revoke them or delete files. Android app settings can clear grants.
Backups still have the coverage and restore limitations in DATA-MAP.md; they
contain the active public workspace, not every previously selected root.

## Write and recovery behavior

Only public document-tree paths use the new bridge. Existing default storage
and all private storage keep their previous backend. Workspace paths are scoped
to Excalidraw/, reject traversal/control/reserved names and allow up to 200
characters per segment. Files are limited to 64 MiB. Full-file encoding/transfer
still has a memory cost; that limit is not a peak-heap guarantee.

Writes stage and verify size before replacing an existing file. A synchronous,
app-private journal records the pending transaction before renaming the old
file. On the next operation for that tree, a missing target is restored from
the previous file; if the target exists, leftover staging/backup files are
cleaned. Directory collisions are rejected and never recursively deleted.
Providers do not offer a universal atomic-replace contract: the temporary rename
gap is recoverable rather than globally atomic. Concurrent edits by other apps,
provider bugs, power loss durability and full-disk behavior still need device
acceptance. A process killed before the journal exists may leave a hidden
.excalibur-*.tmp file; this is not shown as a canvas. No unbounded pruning of
unknown files or old workspaces is attempted.

Sharing copies a workspace document into app cache because Capacitor 5 Share
accepts file URIs only. The share cache keeps at most five files and 64 MiB;
older cached shares can expire. Originals stay in the workspace.
