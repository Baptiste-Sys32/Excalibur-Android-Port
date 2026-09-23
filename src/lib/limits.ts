// Central import limits for the web import planner.
//
// The native Android bridge enforces the same per-file ceiling in
// DrawBridgePlugin.MAX_IMPORT_BYTES. Keep both values aligned whenever either
// side changes so native shares and local file picks fail identically.
export const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_IMPORT_FILE_COUNT = 32;
export const MAX_IMPORT_TOTAL_BYTES = 64 * 1024 * 1024;
