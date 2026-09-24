import { memo, useEffect, useRef, useState } from "react";

import type { NativeStylusSnapshot } from "../lib/androidBridge";

type StylusHoverOverlayProps = {
  stylus: NativeStylusSnapshot | null;
  enabled: boolean;
};

type HoverSample = {
  x: number;
  y: number;
  pressure: number;
  pointerType: string;
  buttons: number;
};

const HIDE_AFTER_MS = 500;

function StylusHoverOverlay({ stylus, enabled }: StylusHoverOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sampleRef = useRef<HoverSample | null>(null);
  const rafRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const stylusRef = useRef(stylus);
  stylusRef.current = stylus;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const scheduleFlush = () => {
      if (rafRef.current !== null) {
        return;
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const sample = sampleRef.current;
        const node = rootRef.current;
        if (!sample || !node) {
          return;
        }

        const snapshot = stylusRef.current;
        const pressure =
          snapshot &&
          snapshot.pointerType === "pen" &&
          Date.now() - snapshot.timestamp < 300
            ? snapshot.pressure
            : sample.pressure;
        const clamped = Math.min(1, Math.max(0, pressure || 0.5));
        const diameter = 10 + clamped * 18;

        node.style.transform = `translate3d(${sample.x}px, ${sample.y}px, 0)`;
        node.style.setProperty("--hover-diameter", `${diameter.toFixed(1)}px`);
        node.style.setProperty("--hover-opacity", (0.35 + clamped * 0.55).toFixed(2));
        node.dataset.tool =
          snapshot?.toolType === "eraser" ? "eraser" : "pen";
      });
    };

    const show = () => setVisible(true);
    const hide = () => setVisible(false);

    const armHideTimer = () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = window.setTimeout(() => {
        const snapshot = stylusRef.current;
        if (!snapshot?.hovering) {
          hide();
        }
      }, HIDE_AFTER_MS);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        sampleRef.current = null;
        hide();
        return;
      }
      if (event.buttons !== 0) {
        sampleRef.current = null;
        hide();
        return;
      }

      sampleRef.current = {
        x: event.clientX,
        y: event.clientY,
        pressure: event.pressure,
        pointerType: event.pointerType,
        buttons: event.buttons,
      };
      show();
      scheduleFlush();
      armHideTimer();
    };

    const onPointerLeave = () => {
      sampleRef.current = null;
      hide();
    };

    const host =
      document.querySelector(".draw-app-shell") ?? window;
    host.addEventListener("pointermove", onPointerMove as EventListener, {
      passive: true,
    });
    host.addEventListener("pointerleave", onPointerLeave);
    host.addEventListener("pointercancel", onPointerLeave);
    host.addEventListener("pointerup", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);

    return () => {
      host.removeEventListener("pointermove", onPointerMove as EventListener);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("pointercancel", onPointerLeave);
      host.removeEventListener("pointerup", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className="draw-stylus-hover"
      data-visible={visible ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="draw-stylus-hover-ring" />
      <div className="draw-stylus-hover-dot" />
    </div>
  );
}

export default memo(StylusHoverOverlay);
