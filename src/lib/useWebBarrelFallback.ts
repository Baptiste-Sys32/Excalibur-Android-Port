import { useEffect, useRef } from "react";

import type { NativeStylusSnapshot } from "./androidBridge";

// Best-effort S Pen barrel-button fallback for environments without the
// native bridge (web builds, or native with the bridge preference off).
// Decodes pen barrel holds from web PointerEvent button bits and feeds them
// into the same snapshot handler as native snapshots. NOTE: web buttons bit
// 2 is the barrel button here; Android buttonState bit 32 is the barrel
// button there. The two domains must never share one constant.
export const useWebBarrelFallback = (
  active: boolean,
  onSnapshot: (snapshot: NativeStylusSnapshot) => void,
) => {
  const handlerRef = useRef(onSnapshot);
  handlerRef.current = onSnapshot;

  useEffect(() => {
    if (!active) {
      return;
    }

    let held = false;

    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "pen") {
        return;
      }

      const nextHeld = (event.buttons & 2) !== 0;
      if (nextHeld === held) {
        return;
      }
      held = nextHeld;

      handlerRef.current({
        toolType: "stylus",
        pointerType: "pen",
        hovering: event.buttons === 0,
        pressure: event.pressure,
        tiltX: event.tiltX ?? 0,
        tiltY: event.tiltY ?? 0,
        buttonState: nextHeld ? 32 : 0,
        timestamp: Date.now(),
      });
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("pointerup", onPointer);
    window.addEventListener("pointercancel", onPointer);

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("pointerup", onPointer);
      window.removeEventListener("pointercancel", onPointer);
    };
  }, [active]);
};
