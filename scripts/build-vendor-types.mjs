// Regenerates TypeScript declarations for the vendored Excalidraw packages.
//
// Why this exists: the app typechecks against vendor/*/dist/types, but that
// directory is gitignored build output. A fresh clone therefore fails
// `tsc -b` with "Cannot find module" errors for every @excalidraw/* import.
// This script rebuilds those declarations from the pinned vendored source so
// CI (and fresh checkouts) are hermetic.
//
// How it works: a single tsc program over the four package entry points with
// rootDir=vendor emits declarations that mirror the layout each package.json
// `exports` map expects. The vendored sources carry pre-existing type errors
// under newer tsc versions, so a nonzero tsc exit is tolerated as long as the
// expected declaration files are actually emitted (the app consumes them with
// skipLibCheck and never typechecks their contents).

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = resolve(rootDir, "vendor");
const tmpDir = resolve(rootDir, "node_modules/.tmp/vendor-types");
const tscBin = resolve(rootDir, "node_modules/typescript/bin/tsc");

const PACKAGES = ["common", "math", "element", "excalidraw"];

// Declaration files the app's typecheck hard-requires. Kept in sync with the
// `types`/`exports` fields of vendor/*/package.json.
const MARKERS = [
  "common/dist/types/common/src/index.d.ts",
  "math/dist/types/math/src/index.d.ts",
  "element/dist/types/element/src/index.d.ts",
  "excalidraw/dist/types/excalidraw/index.d.ts",
  "excalidraw/dist/types/element/src/types.d.ts",
];

const run = () => {
  rmSync(tmpDir, { force: true, recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  try {
    execFileSync(
      process.execPath,
      [
        tscBin,
        "vendor/common/src/index.ts",
        "vendor/math/src/index.ts",
        "vendor/element/src/index.ts",
        "vendor/element/src/visualdebug.ts",
        "vendor/excalidraw/index.tsx",
        "--declaration",
        "--emitDeclarationOnly",
        "--outDir",
        tmpDir,
        "--rootDir",
        "vendor",
        "--jsx",
        "react-jsx",
        "--target",
        "ES2022",
        "--module",
        "ESNext",
        "--moduleResolution",
        "Bundler",
        "--skipLibCheck",
        "--esModuleInterop",
      ],
      { cwd: rootDir, stdio: "inherit" },
    );
  } catch (error) {
    console.warn(
      "Vendor sources have pre-existing type errors; continuing to layout check.",
    );
    if (error?.stdout) {
      process.stdout.write(String(error.stdout).slice(0, 2000));
    }
  }

  // Lay out tmp/<pkg>/... -> vendor/<pkg>/dist/types/<pkg>/...,
  // plus the shared copies the excalidraw package re-exports.
  const layout = [
    ["common", "common/dist/types/common"],
    ["math", "math/dist/types/math"],
    ["element", "element/dist/types/element"],
    ["excalidraw", "excalidraw/dist/types/excalidraw"],
    ["common", "excalidraw/dist/types/common"],
    ["math", "excalidraw/dist/types/math"],
    ["element", "excalidraw/dist/types/element"],
  ];

  for (const [fromPkg, toDir] of layout) {
    const from = resolve(tmpDir, fromPkg);
    if (!existsSync(from)) {
      throw new Error(`Missing emitted declarations for package ${fromPkg}`);
    }
    const target = resolve(vendorDir, toDir);
    rmSync(target, { force: true, recursive: true });
    mkdirSync(target, { recursive: true });
    cpSync(from, target, { recursive: true });
  }

  const missing = MARKERS.filter(
    (marker) => !existsSync(resolve(vendorDir, marker)),
  );
  if (missing.length > 0) {
    throw new Error(
      `Vendor type layout incomplete, missing: ${missing.join(", ")}`,
    );
  }

  rmSync(tmpDir, { force: true, recursive: true });
  console.info("Vendored type declarations rebuilt and verified.");
};

run();
