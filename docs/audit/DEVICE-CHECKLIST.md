# Device acceptance checklist

Use a copied test drawing and export a backup first for destructive storage
experiments. Emulator results do not certify S Pen firmware behavior. Record
model, Android/WebView version, refresh rate, build commit and observations.
Commit keys below refer to the subjects in LOG.md/git log; final hashes are
recorded at the end of LOG.md.

| Change | What to do | Correct result |
| --- | --- | --- |
| Hover lifecycle (0ce41f29) | Cold launch with ring off, enable it; hover, disable and re-enable | Ring follows without restart, with no duplicate listeners |
| Hover lifecycle (0ce41f29) | Hover in circles at 60 and 120 Hz; record frame intervals and compare pen/ring position on high-frame-rate video | Smooth position from web events, no persistent jump; report p50/p95 lag and maximum offset in px |
| Hover lifecycle (0ce41f29) | Flip pen to eraser and back; leave proximity, pause/resume, screen off/on, change system clock backwards | Eraser glyph changes appropriately; no stuck ring after 500 ms inactivity plus scheduling; pressure fallback recovers |
| Baseline stylus audit (1a315700) | Hold barrel, touch down while firmware omits bit, release on hover; switch between flipped eraser and barrel | No premature tool release or stuck override, previous manually selected tool respected |
| Baseline stylus audit (1a315700) | Palm plus pen, landscape rotation, split-screen resize, zoom 0.1x/1x/30x and pan with guides | Pen remains pen; no unwanted strokes, ring under tip; guides remain within about 0.5 px from scroll quantization alone |
| Native intake (81db8768) | Share two scenes, scene+image, 32 files, 33 files, repeated VIEW, malformed/empty files and provider permission denial | No crash; accepted files preserve names/content, bounded intake, unsupported files do not poison valid neighbors |
| Native intake (81db8768) | Share near 8 MiB and above 8 MiB, provider with unknown/false size, total over 64 MiB, rapid batches beyond queue budget | Streaming size cap holds; no unbounded queue; note oldest-batch loss (currently no UI warning) |
| Offline policy (5ea143c5) | Force stop, enable airplane mode, disable Wi-Fi/mobile data, cold launch; draw text, shapes, import local image/library, save, reopen and export PNG/SVG/PDF | Full local workflow works, fonts render, no network-dependent spinner or lost drawing |
| INTERNET experiment (3dae8672) | Compare production and temporary no-INTERNET APK on supported physical Android/WebView; inspect final merged permissions | Local launch, bridge, file picker, save/reopen/share and all exports work in both; no remote font dependency |
| Offline policy (5ea143c5) | Help, command palette, library panel/dropdown, embedded URL and hyperlink; try remote library hash and pasted remote image | Online UI unavailable, external requests blocked, local library import still usable |
| Storage audit (1a315700, unchanged) | Repeated autosaves/backgrounds, kill between file and metadata writes on a disposable profile, fill storage | Previous valid autosave survives temp-write failure; health warning visible; inventory orphan files (known retention gap) |
| Storage audit (1a315700, unchanged) | Restore a valid backup, corrupt CRC, traversal name, missing entry, low-storage failure mid-restore | Invalid archives rejected; record known partial-restore behavior and private index overwrite; original backup remains readable |
| Storage audit (1a315700, unchanged) | Verify private library/templates/versions/settings against exported backup | Explicitly record omitted categories; current backup is not full app-data coverage |
| Stability (bed46dfa, 3dae8672) | Large canvas/images, repeated manager open/search/close, timeline restore, Android back and process recreation | No OOM/ANR, status and unsaved drawing remain understandable |

## Measurement procedure

For stylus latency, record pen and screen at a known capture rate and measure
pen-to-ring frame displacement over at least 100 movements per refresh mode.
Convert using capture interval, report quantization uncertainty and p50/p95/max.
For event drops, use a development-only bounded counter at native dispatch,
accepted bridge emission, web pointer delivery and rAF flush; do not infer loss
from emission count alone because similarity/throttle intentionally suppress it.
Record pressure step response separately from position. Measure bridge UI-thread
cost with Android tracing, including a slow local content provider. No diagnostic
upload or scene recording is needed.

## Completed emulator checks

API 36, WebView 133.0.6943.137: production CSP launch, local fonts, drawing,
autosave/reopen and simple PNG/SVG/PDF export passed in airplane mode. A temporary
no-INTERNET variant passed the same basic path, with the absent permission
confirmed from the APK. Synthetic hover position and inactivity expiry passed.
Two Android regression tests passed. These do not certify pen flip, barrel
firmware, refresh-rate smoothness, provider behavior or large/image-rich exports.

## Feature 3: keep awake while writing

Commit subject: Add an opt-in screen timeout for active stylus writing.
Enable in Pen & touch, write with pen and flipped eraser. Correct: the screen
stays awake for 120 s after the last contact; hovering, mouse and finger do not
extend it. Background, disable or rotate/recreate: no stale window flag; resume
requires new contact. Verify against a short system screen timeout. The Activity
flag is used without wake-lock permission or a global timeout change.
