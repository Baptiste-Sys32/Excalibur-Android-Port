# Vendor refresh procedure

This procedure updates the vendored Excalidraw tree without losing local patches.
Do not perform an upstream refresh in the same commit as wrapper, storage,
native, or dependency changes.

## Current baseline

- Upstream SHA: `1caec99b290c75cda05385e637138998807a65ae`
- Vendored versions: `0.18.0` for common, element, math, and excalidraw packages.
- Recorded at Git commit: `d259a0c7`
- `git ls-files -s vendor` manifest digest:
  - `0f8aaf12a97dc8f37665224af91e66e727ad70a91d2ebe1437048aa65b3f11e8`
- Local toolchain at record time: Node `v24.14.0`, npm `11.20.0`.

## Local patch ledger

Preserve and reapply these intentional local vendor changes:

1. Fine/hairline stroke widths:
   - `vendor/common/src/constants.ts`
   - `vendor/excalidraw/actions/actionProperties.tsx`
   - `vendor/excalidraw/components/icons.tsx`
   - `vendor/excalidraw/locales/en.json`
   - related stroke-width tests.
2. Highlighter minimum stroke-width behavior:
   - `vendor/excalidraw/components/App.tsx`
3. Minimal wrapper compatibility edits already documented in `MIGRATION.md`.

## Refresh steps

1. Create a safety branch and annotated backup tag.
2. Check out the exact target upstream SHA in a temporary clone.
3. Build the required upstream packages in that clone.
4. Replace only:
   - `vendor/common`
   - `vendor/math`
   - `vendor/element`
   - `vendor/excalidraw`
5. Restore local `file:` dependency rewiring.
6. Reapply the local patch ledger above.
7. Reconcile `package.json`, vendor manifests, and `package-lock.json`.
8. Run:
   - `npm ci`
   - `npm run sync:excalidraw-assets`
   - `npx tsc -b`
   - `npm run lint`
   - `npm run build`
   - `npm run android:sync`
   - `npm run android:build:debug`
9. Verify the new vendor manifest digest and record it here.
10. Keep the old source state available through the backup tag.

## Acceptance

- The new vendor digest is recorded.
- Local stroke/highlighter behavior is preserved and tested.
- No wrapper behavior changes are bundled into the refresh commit.
- Reverting the refresh commit restores the previous vendor tree.
