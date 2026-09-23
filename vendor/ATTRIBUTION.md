# Upstream Attribution

This directory contains vendored source derived from Excalidraw upstream.

- Upstream project: https://github.com/excalidraw/excalidraw
- Upstream commit SHA: `1caec99b290c75cda05385e637138998807a65ae`
- Vendored package paths:
  - `vendor/excalidraw`
  - `vendor/common`
  - `vendor/math`
  - `vendor/element`

License:

- Upstream license file is preserved at `vendor/LICENSE.UPSTREAM`.

Local adjustments in this repository:

- Internal vendored package links use local `file:` dependencies for private/local development.
- App integration wiring uses local vendored package paths.

Baseline verification record:

- Recorded at Git commit: `d259a0c7`
- Upstream commit SHA: `1caec99b290c75cda05385e637138998807a65ae`
- Vendored package versions: `@excalidraw/common`, `@excalidraw/element`,
  `@excalidraw/math`, and `@excalidraw/excalidraw` are all `0.18.0`.
- `git ls-files -s vendor` manifest digest:
  - `0f8aaf12a97dc8f37665224af91e66e727ad70a91d2ebe1437048aa65b3f11e8`
- Local functional vendor patches must be preserved across upstream refreshes:
  - fine/hairline stroke widths and stroke-width UI/test/locale changes;
  - highlighter minimum stroke-width behavior;
  - related Excalidraw icon and test adjustments.
- Known manifest inconsistency: `vendor/element/package.json` declares registry
  `0.18.0` internal dependencies while `package-lock.json` records local links.
- Asset-sync source order: `vendor/excalidraw/dist/prod`, then
  `node_modules/@excalidraw/excalidraw/dist/prod`, into
  `public/excalidraw-assets`.
- Local toolchain at record time: Node `v24.14.0`, npm `11.20.0`.
