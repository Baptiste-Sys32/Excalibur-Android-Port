import { memo, type ReactNode } from "react";

import {
  A4_PAGE_SIZE,
  isA4MarginLocked,
  isPageTemplateEnabled,
  type PageSettings,
  type PageViewport,
} from "../lib/pageSettings";

type PageTile = {
  key: string;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PageTemplateOverlayProps = {
  pageSettings: PageSettings;
  viewport: PageViewport | null;
};

const MAX_VISIBLE_PAGES = 160;
const GUIDE_SPACING = 32;
const STAFF_GROUP_SPACING = 104;
const STAFF_LINE_SPACING = 10;

const screenPoint = (sceneCoordinate: number, scroll: number, zoom: number) =>
  (sceneCoordinate + scroll) * zoom;

const buildA4VerticalTiles = (viewport: PageViewport) => {
  const zoom = Math.max(0.01, viewport.zoom || 1);
  const sceneTop = -viewport.scrollY;
  const sceneBottom = sceneTop + viewport.height / zoom;
  const startRow = Math.floor(sceneTop / A4_PAGE_SIZE.height) - 1;
  const endRow = Math.ceil(sceneBottom / A4_PAGE_SIZE.height) + 1;
  const tiles: PageTile[] = [];

  for (let row = startRow; row <= endRow; row += 1) {
    if (tiles.length >= MAX_VISIBLE_PAGES) {
      return tiles;
    }

    const sceneY = row * A4_PAGE_SIZE.height;

    tiles.push({
      key: `${row}:0`,
      row,
      column: 0,
      x: screenPoint(0, viewport.scrollX, zoom),
      y: screenPoint(sceneY, viewport.scrollY, zoom),
      width: A4_PAGE_SIZE.width * zoom,
      height: A4_PAGE_SIZE.height * zoom,
    });
  }

  return tiles;
};

type GuidePatternSpec = {
  id: string;
  tileWidth: number;
  tileHeight: number;
  offsetX: number;
  offsetY: number;
  content: ReactNode;
};

const patternIdFor = (template: PageSettings["template"]) =>
  `draw-guide-pattern-${template}`;

const normalizePatternOffset = (value: number, step: number) => {
  if (!(step > 0)) {
    return 0;
  }
  return ((value % step) + step) % step;
};

// All guide templates are periodic on the 32-unit scene grid, so each one is
// a single repeating tile anchored to scene coordinates. The tile grid shifts
// with the viewport scroll, which keeps guides glued to canvas content while
// panning instead of swimming.
const buildGuidePattern = (
  template: PageSettings["template"],
  zoom: number,
  scrollX: number,
  scrollY: number,
): GuidePatternSpec | null => {
  const step = GUIDE_SPACING * zoom;
  const id = patternIdFor(template);

  switch (template) {
    case "lined": {
      if (step < 5) {
        return null;
      }
      return {
        id,
        tileWidth: 8,
        tileHeight: step,
        offsetX: 0,
        offsetY: normalizePatternOffset(scrollY * zoom, step),
        content: (
          <line
            x1={0}
            y1={0}
            x2={8}
            y2={0}
            className="draw-page-overlay-guide"
          />
        ),
      };
    }
    case "grid": {
      if (step < 5) {
        return null;
      }
      return {
        id,
        tileWidth: step,
        tileHeight: step,
        offsetX: normalizePatternOffset(scrollX * zoom, step),
        offsetY: normalizePatternOffset(scrollY * zoom, step),
        content: (
          <>
            <line
              x1={0}
              y1={0}
              x2={step}
              y2={0}
              className="draw-page-overlay-guide"
            />
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={step}
              className="draw-page-overlay-guide"
            />
          </>
        ),
      };
    }
    case "dotted": {
      if (step < 8) {
        return null;
      }
      const radius = Math.min(1.35, Math.max(0.65, step / 18));
      return {
        id,
        tileWidth: step,
        tileHeight: step,
        offsetX: normalizePatternOffset(scrollX * zoom, step),
        offsetY: normalizePatternOffset(scrollY * zoom, step),
        content: (
          <circle cx={0} cy={0} r={radius} className="draw-page-overlay-dot" />
        ),
      };
    }
    case "isometric": {
      if (step < 7) {
        return null;
      }
      return {
        id,
        tileWidth: step,
        tileHeight: step,
        offsetX: normalizePatternOffset(scrollX * zoom, step),
        offsetY: normalizePatternOffset(scrollY * zoom, step),
        content: (
          <>
            <line
              x1={0}
              y1={0}
              x2={step}
              y2={step}
              className="draw-page-overlay-guide"
            />
            <line
              x1={0}
              y1={step}
              x2={step}
              y2={0}
              className="draw-page-overlay-guide"
            />
          </>
        ),
      };
    }
    case "music": {
      const lineStep = STAFF_LINE_SPACING * zoom;
      if (lineStep < 3) {
        return null;
      }
      const groupStep = STAFF_GROUP_SPACING * zoom;
      const base = STAFF_GROUP_SPACING * 0.55 * zoom;
      const lines: ReactNode[] = [];

      for (let lineIndex = 0; lineIndex < 5; lineIndex += 1) {
        const y = (base + lineIndex * lineStep) % groupStep;
        lines.push(
          <line
            key={lineIndex}
            x1={0}
            y1={y}
            x2={8}
            y2={y}
            className="draw-page-overlay-guide"
          />,
        );
      }

      return {
        id,
        tileWidth: 8,
        tileHeight: groupStep,
        offsetX: 0,
        offsetY: normalizePatternOffset(scrollY * zoom, groupStep),
        content: <>{lines}</>,
      };
    }
    case "blank-a4":
    case "off":
      return null;
  }
};

const renderGuidePatternDef = (pattern: GuidePatternSpec) => (
  <pattern
    key={pattern.id}
    id={pattern.id}
    width={pattern.tileWidth}
    height={pattern.tileHeight}
    x={pattern.offsetX}
    y={pattern.offsetY}
    patternUnits="userSpaceOnUse"
  >
    {pattern.content}
  </pattern>
);

const renderInfiniteGuides = (
  viewport: PageViewport,
  pageSettings: PageSettings,
) => {
  const zoom = Math.max(0.01, viewport.zoom || 1);
  const pattern = buildGuidePattern(
    pageSettings.template,
    zoom,
    viewport.scrollX,
    viewport.scrollY,
  );

  if (!pattern) {
    return null;
  }

  return (
    <>
      <defs>{renderGuidePatternDef(pattern)}</defs>
      <rect
        x={0}
        y={0}
        width={viewport.width}
        height={viewport.height}
        fill={`url(#${pattern.id})`}
      />
    </>
  );
};

export const PageTemplateOverlay = memo(function PageTemplateOverlay({
  pageSettings,
  viewport,
}: PageTemplateOverlayProps) {
  if (!viewport || !isPageTemplateEnabled(pageSettings)) {
    return null;
  }

  return (
    <svg
      className="draw-page-overlay"
      width={viewport.width}
      height={viewport.height}
      aria-hidden="true"
    >
      {pageSettings.mode === "infinite" ? (
        renderInfiniteGuides(viewport, pageSettings)
      ) : (
        <A4VerticalTemplate pageSettings={pageSettings} viewport={viewport} />
      )}
    </svg>
  );
});

function A4VerticalTemplate({
  pageSettings,
  viewport,
}: PageTemplateOverlayProps & { viewport: PageViewport }) {
  const tiles = buildA4VerticalTiles(viewport);
  const zoom = Math.max(0.01, viewport.zoom || 1);
  const pageLeft = screenPoint(0, viewport.scrollX, zoom);
  const pageRight = pageLeft + A4_PAGE_SIZE.width * zoom;
  const marginLocked = isA4MarginLocked(pageSettings);
  const pattern = buildGuidePattern(
    pageSettings.template,
    zoom,
    viewport.scrollX,
    viewport.scrollY,
  );

  return (
    <>
      {marginLocked ? (
        <>
          <rect
            className="draw-page-overlay-margin"
            x={0}
            y={0}
            width={Math.max(0, pageLeft)}
            height={viewport.height}
          />
          <rect
            className="draw-page-overlay-margin"
            x={Math.max(0, pageRight)}
            y={0}
            width={Math.max(0, viewport.width - Math.max(0, pageRight))}
            height={viewport.height}
          />
        </>
      ) : null}

      {pattern ? <defs>{renderGuidePatternDef(pattern)}</defs> : null}

      {tiles.map((tile) => (
        <g key={tile.key}>
          {pattern ? (
            <rect
              x={tile.x}
              y={tile.y}
              width={tile.width}
              height={tile.height}
              fill={`url(#${pattern.id})`}
            />
          ) : null}
          <rect
            className="draw-page-overlay-border"
            x={tile.x}
            y={tile.y}
            width={tile.width}
            height={tile.height}
          />
        </g>
      ))}
    </>
  );
}
