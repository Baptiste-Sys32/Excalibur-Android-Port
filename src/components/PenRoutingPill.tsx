import { memo } from "react";

type PenRoutingPillProps = {
  penMode: boolean;
  penDetected: boolean;
  onToggle: (next: boolean) => void;
};

function PenRoutingPill({ penMode, penDetected, onToggle }: PenRoutingPillProps) {
  return (
    <div className="draw-pen-pill" role="group" aria-label="Pen input mode">
      <button
        className="draw-pen-pill-toggle"
        type="button"
        aria-pressed={penMode}
        aria-label={
          penMode
            ? "Pen mode: pen draws, touch is off. Activate to allow touch drawing."
            : "Pen mode off: pen and touch draw. Activate for pen-only drawing."
        }
        onClick={() => onToggle(!penMode)}
      >
        <span className="draw-pen-pill-dot" aria-hidden="true" data-on={penDetected ? "true" : "false"} />
        <span>{penMode ? "Pen only" : "Pen + touch"}</span>
      </button>
      <span className="draw-pen-pill-live" role="status" aria-live="polite">
        {penMode ? "Touch input off" : "Touch input on"}
      </span>
    </div>
  );
}

export default memo(PenRoutingPill);
