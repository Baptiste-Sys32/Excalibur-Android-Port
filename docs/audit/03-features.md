# Daily S Pen feature audit

The original audit added no features. A subsequent user-requested follow-up
implements proposals 3 and 4; see docs/WORKSPACES.md. Rankings favor wrapper/native work
that leaves the pinned engine untouched. Effort is an engineering estimate,
including validation, not a delivery promise.

## Existing inventory

App.tsx owns scene bootstrap/autosave/recovery, native and web barrel routing,
pen-only mode, file/image/library imports, touch routing, undo/redo actions,
canvas manager, sharing, backup and export flows. DrawMainMenu exposes these
plus page modes/guides, pen settings and local help. PageTemplateOverlay and
pageSettings provide infinite or portrait A4 guides, lined/grid/dotted/music/
isometric patterns and visual margins. Margins preserve outside marks rather
than clipping strokes. Templates include built-ins, previews, search and custom
saved scenes. CanvasManager supports search, pins, thumbnails, duplicate/rename,
versions and batch operations. ExportCenter supports format, scale, background
and share-after choices; pdfExport paginates A4 at 210 x 297 mm. DialogSheet
handles confirmation/input. Native Activity handles view/send intents; bridge
also opens device storage. Capacitor manages back, status bar and splash.

Thus templates, pen-only mode, exports, backups, version history, canvas search,
barrel mapping and native sharing are not missing features.

## Ranked proposals

| Rank | Proposal | Why it helps daily use | Effort | Value / implementation risk | Offline risk | Engine risk |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Recovery health and verified backup completeness | A note-taking app must say which scenes/images/settings are actually protected; show quota, last full save and recoverable copies | 3-5 days | Very high / medium, storage must be failure-tested | None, local files only | None |
| 2 | Per-tool pen presets in a small favorites strip | Switch between writing pen and highlighter widths/colors without reopening menus; existing barrel mapping stays separate | 2-4 days | High / low-medium, public updateScene API with undo checks | None | Low, public API only |
| 3 | Keep screen awake while actively writing, with idle timeout | Prevent screen lock during handwritten study without changing system-wide timeout | 1-2 days | High / low, Activity window flag and lifecycle cleanup | None | None |
| 4 | Android document-tree workspace selection | User chooses a local SD card or Documents folder with persistent grants, avoiding fragile direct shared-storage assumptions | 5-8 days | High / high, identity, grants, atomic save and migration | Low, allow local providers; do not require cloud providers | None |
| 5 | Fast local launcher shortcuts for recent/pinned canvases | Open a lesson directly from Android home screen; retain stable IDs across renames | 2-4 days | Medium-high / medium, exported intent validation and missing-file UX | None | None |
| 6 | Left-handed configurable edge toolbar and larger pen controls | Reduce palm collisions and travel on a tablet; preserve existing responsive layout | 2-3 days | Medium / low-medium, hit targets and gesture testing | None | Low |
| 7 | Local diagnostic recording, explicitly enabled | Capture event intervals, pressure/tool transitions and frame intervals for reproducible S Pen reports without uploading drawings | 2-3 days | Medium / low-medium, bounded ring buffer and privacy | None; export on request only | None |
| 8 | Optional short haptic confirmation for preset or barrel mode changes | Confirm mode changes without looking away from the pen tip; never vibrate per sample | 1 day | Medium-low / low, accessibility preference | None | None |

Stabilize recovery and restore before adding storage features. Pen presets and
screen-awake mode are the best independent usability improvements afterward.

## Rejected, and why

- Cloud sync, remote libraries/catalog, live collaboration, online AI/handwriting
  recognition, remote fonts and link hosting: require runtime network services.
- Replacing the engine's input pipeline with Android Ink or a new renderer:
  requires an engine rewrite and risks selection, undo, shapes and serialization.
- Arbitrary canvas rotation or a new brush engine: not a wrapper-only change in
  this pinned integration. Document for a future upstream update, not this fork.
- Reproposing templates, export choices or basic backup: those already exist.

## Product limits observed

Pen-only drawing mode suppresses primary touch for drawing tools, so navigation
while writing depends on tool choice and interception behavior; test two-finger
pinch before advertising seamless palm rejection. It is not hardware palm
classification. Portrait A4 is fixed. Current private backup omissions and
restore behavior are described in 01-bridge-offline.md, not hidden by the UI's
"Export all backup" label. Fonts, large image imports, memory and split-screen
require Android acceptance rather than desktop assumptions.
