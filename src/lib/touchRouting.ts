// Pen-only touch routing predicate.
//
// When enabled, single-primary touch input must never reach Excalidraw while
// a content-creating tool is active. Selection, lasso, and hand tools stay
// touch-capable so canvas navigation keeps working. Multi-touch gestures are
// intentionally blocked too: allowing a second finger through while the first
// was swallowed would produce stray single-touch strokes, so in pen-only draw
// mode touch does nothing at all. Pure function — no DOM, no React.

const DRAWING_TOOL_TYPES: ReadonlySet<string> = new Set([
  "freedraw",
  "highlighter",
  "rectangle",
  "ellipse",
  "diamond",
  "arrow",
  "line",
  "text",
  "image",
  "eraser",
]);

export type TouchRoutingInput = {
  penOnlyTouchNeverDraws: boolean;
  pointerType: string;
  isPrimary: boolean;
  activeToolType?: string;
};

export const shouldInterceptTouch = (input: TouchRoutingInput): boolean =>
  input.penOnlyTouchNeverDraws &&
  input.pointerType === "touch" &&
  input.isPrimary &&
  !!input.activeToolType &&
  DRAWING_TOOL_TYPES.has(input.activeToolType);
