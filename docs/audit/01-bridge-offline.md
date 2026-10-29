# Bridge, stylus and offline audit

## Stylus path and timing

MainActivity forwards both dispatch methods before WebView dispatch. The bridge
reads pointer index 0, rounds continuous axes to two decimals, compares against
the last emitted sample, then emits stylusChange. getStylusSnapshot returns that
same last emitted object, not every MotionEvent. App stores every delivered
sample in latestNativeStylusRef; only discrete display changes enter React state.
getSample reads the ref during the overlay's pointer-driven rAF flush.

The 32 ms gate applies only to unchanged discrete state. Similarity additionally
drops pressure changes below 0.05 and tilt changes below 3 degrees relative to
the last emitted sample. Changes accumulate relative to that sample, not the
last received event. Orientation-only changes are discarded. These thresholds
are diagnostics/display policy, not the engine's drawing input path.

Position is event.clientX/clientY, not native coordinates or scene coordinates.
Thus the native throttle does NOT cap position at 31.25 Hz. rAF coalesces web
pointer movement to display cadence, up to 60/120 Hz if WebView delivers it.
Pressure can update at most every 32 ms for continuous state, and can fall back
to web pressure after 300 ms if similarity suppresses repeated values. Synthetic
interval bounds are 2 frames at 60 Hz (33.33 ms), 4 at 120 Hz (33.33 ms).
These are calculated bounds, not measured hardware latency or dropped samples.

The wall clock timestamp is deliberately distinct from monotonic event time.
The overlay now rejects future timestamps after a backwards clock adjustment.
Native get and event deliveries have no sequence arbitration in App: an older
async get can overwrite a newer event. Proposed fix: monotonic sequence plus
session identity, with tests for initial-get/listener ordering. Medium severity.

Hover entry/move/exit all currently map to hovering=true. This can leave a stale
proximity bit, and the old hide timer trusted it indefinitely. The display now
expires after 500 ms of inactivity and stale eraser glyphs expire at 300 ms.
Disabled-at-mount activation now installs its effect, and listener registration
finishing after unmount now tears down its handles. An enabled stationary pen
can now hide until it moves; this is deliberate stale-display containment.

Barrel overrides latch through contact without button bits and release on
unpressed hover. Inverted eraser overrides are independent of barrel preference.
Switching directly between active override reasons can leave the original
reason latched until a later sample. No onPause/onResume reset exists in the
native plugin; destroy clears instance but retains latest snapshot and queue.
Medium severity: test pause while holding, flip, palm+pen multi-pointer ordering,
and screen-off before changing this state machine. Pointer 0 can be a finger
while another pointer is a pen. Proposed fix: select stylus pointer explicitly
and introduce a proximity/session reset that also restores temporary tools.

Pan/zoom use client coordinates for the ring and screen-quantized scroll for
page guides; no scene transform is needed for the ring. Device rotation is
layout rotation, not an engine viewport rotation feature. Verify resize,
split-screen and WebView offsets on hardware. No measured desync/latency claim.

## Bridge findings

- High: multi-file payload made firstPayload contain files, whose first element
  was firstPayload itself. JSON serialization can recurse to stack overflow.
  Fixed in 81db8768: separate envelope; Android serialization test passes.
- High: file reads run synchronously from onCreate/onNewIntent. A slow or hostile
  content provider can cause an ANR even with an 8 MiB byte ceiling. Proposed
  follow-up: bounded single-worker intake with application context, cancellation,
  URI grant lifetime handling, explicit per-file errors and ordering tests.
- High: per-file cap alone does not bound a batch or retained queue memory.
  Fixed in 81db8768: 32 attempted files, 64 MiB batch and raw queue budgets.
  Streaming checks must remain authoritative when provider size lies.
- Medium: provider getType/openInputStream and malformed extras can throw runtime
  exceptions. Intake guards added in 81db8768; per-file failures skip that file.
- Medium: MIME support is extension OR JSON/image MIME, not a strict MIME
  allowlist. Octet-stream works through a recognized extension. Parsing and
  image pixel limits remain necessary after transport validation.
- Medium: notifyListeners executes inside LOCK on the UI path. JSON serialization
  and bridge work can delay motion. Moving notifications outside the lock needs
  an ordering strategy and lifecycle tests first. Do not merely move the call.
- Low: instance is cleared only if it still owns the static slot, protecting a
  newly loaded instance from old destroy callbacks. Queue intentionally survives
  recreation but old retained listener events can duplicate its data. JS drains
  the queue on events rather than using their payload. No static Activity held
  after destroy through instance; retained payload memory remains a concern.

## Offline reachability

No fetch/WebSocket/XHR call in src. The image constructor decodes imported
images. MainMenu replaces upstream defaults; load/save/image export/backend
export actions are disabled through UIOptions. No collaboration trigger or
backend exporter is provided. Excalidraw+ and share-link defaults are absent.

Vendored reachable paths include library URL import (data/library.ts), remote
image conversion (data/blob.ts), font fallback (fonts/ExcalidrawFontFace.ts),
publish-library POST, embed frames, AI stream fetch, help links and hyperlink
navigation. WASM loaders also fetch, legitimately from bundled local assets.
PlantUML conversion here is local PlantUML-to-Mermaid, not a server renderer.
The upstream packaged distribution includes backend config; its presence is
not evidence that the wrapper initializes Firebase. Do not copy its key into
reports or misidentify it as an app-owned credential.

Hardening and runtime verification results are in LOG.md. The INTERNET decision
and airplane-mode acceptance must include actual launch, draw, save/reopen,
fonts and export tests, not just a successful APK compile. Capacitor's local
server uses shouldInterceptRequest and packaged asset responses, not a socket
server; that supports testing removal but does not itself prove device support.

## Data findings

High: recovery pruning limits metadata to eight, not directory storage. A crash
between file and Preferences write leaves an orphan; a crash after Preferences
write but before deletion also does. removeDataFile swallows all delete failures.
There is no byte budget and each scene can embed images. Proposed fix: serialize
snapshot operations, reconcile only recognized generated names against validated
metadata, delete old unreferenced snapshots after a grace period, keep a byte
budget and surface failures. Test crash points and low storage first.

High: restore verifies manifest identity/version, entry scope, byte lengths and
ZIP CRC before applying files, but is not staged or transactional. Public
conflicts are renamed, private app-data entries overwrite their paths. Failure
mid-restore leaves earlier writes applied and no partial summary. The broad
app-data scope also permits unexpected private paths. Proposed fix: schema-based
path allowlist, validate scene/index shapes and references, stage files, preserve
previous-valid indexes and journal a resumable commit/rollback.

High: public text/binary saves use chunked direct writes. A partial failure can
truncate an existing canvas. Prior version capture is best-effort and swallowed.
Private writes use temp + byte-size verification + rename, protecting the old
copy until rename. No fsync or previous-valid index copy is guaranteed. Process
kill can leave temp files. Atomic rename semantics and disk-full behavior need
real filesystem tests. Do not silently call this crash-proof.

Medium: legacy migration marks complete in finally despite swallowed copy
failures, so it violates the documented retry rule. Sources are not deleted.
Medium: backup omits private library, autosave, recovery, versions, settings and
thumbnail data. It exports only the two private indexes plus custom templates
alongside public files. A restored canvas index can reference absent versions.
Medium: corrupt/unreadable autosave starts fresh with notice; bootstrap does not
load degraded autosave or automatically choose a recovery snapshot.

These storage changes are deferred deliberately: require a verified device
backup and failure-injection fixtures, not a broad migration in this audit.

Offline hardening adds CSP before application scripts: resources are local,
data or blob only, remote connections/fonts/images and all frames are blocked.
Embeddables and AI are explicitly disabled through public props. src CSS hides
remote-library browsing, publish and external help links. The misleading
lib-dropdown--remove test ID identifies Publish in this pin, not local Remove.
External anchor capture and onLinkOpen block browser navigation. CSP is the
resource boundary, CSS is only UI containment. INTERNET remains unchanged
pending comparative runtime checks. Native plugins are not governed by CSP;
no runtime networking plugin has been enabled by this change.

## Source anchors (final audit)

- Native intake/queue: android/app/src/main/java/com/badeparday/excalidrawpersonal/DrawBridgePlugin.java:307
- Throttle: android/app/src/main/java/com/badeparday/excalidrawpersonal/DrawBridgePlugin.java:339
- Similarity thresholds: android/app/src/main/java/com/badeparday/excalidrawpersonal/DrawBridgePlugin.java:545
- Private atomic writes: src/lib/persistence.ts:308
- Migration completion after failures: src/lib/persistence.ts:402
- Recovery pruning: src/lib/persistence.ts:836
- Direct public writes: src/lib/persistence.ts:899
- Private backup selection: src/lib/persistence.ts:1987
- Restore validation/application: src/lib/persistence.ts:2118

The ring also hides whenever web buttons are nonzero, so it is not the renderer
for a pressure-bearing contact stroke. The engine still consumes web input
independently; native display throttling is not evidence of dropped ink points.

Comparative no-INTERNET experiment (3dae8672, temporary manifest only) passed
on API 36 with WebView 133.0.6943.137: local launch/bridge/fonts, rectangle
capture/autosave and PNG/SVG/PDF exports in airplane mode. aapt showed INTERNET
absent. Production retains it until provider/share and physical-device matrix
acceptance; the assertion that Capacitor always requires it is not supported by
this experiment. See LOG.md for exact observations and DEVICE-CHECKLIST.md for
remaining steps. CSP still blocks external resources with the permission present.
