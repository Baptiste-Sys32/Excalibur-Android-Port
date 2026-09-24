import { useEffect, useRef, useState } from "react";

export type SheetRequest =
  | {
      kind: "prompt";
      title: string;
      message?: string;
      initialValue: string;
      placeholder?: string;
      confirmLabel: string;
    }
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
    };

type DialogSheetProps = {
  request: SheetRequest;
  onResolve: (value: string | boolean | null) => void;
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function DialogSheet({ request, onResolve }: DialogSheetProps) {
  const [value, setValue] = useState(
    request.kind === "prompt" ? request.initialValue : "",
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (request.kind === "prompt") {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      const cancel = dialogRef.current?.querySelector<HTMLButtonElement>(
        "[data-sheet-cancel]",
      );
      (cancel ?? dialogRef.current)?.focus();
    }
  }, [request]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();

      if (event.key === "Escape") {
        event.preventDefault();
        onResolve(null);
        return;
      }

      if (event.key === "Enter" && request.kind === "prompt") {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "INPUT") {
          event.preventDefault();
          onResolve(value);
        }
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onResolve, request.kind, value]);

  const cancelValue = request.kind === "prompt" ? null : false;

  return (
    <div
      className="draw-directory-modal-backdrop"
      onClick={() => onResolve(cancelValue)}
    >
      <div
        ref={dialogRef}
        className="draw-directory-modal draw-directory-modal--sheet"
        role={request.kind === "confirm" && request.danger ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-label={request.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="draw-directory-modal-header">
          <div>
            <strong>{request.title}</strong>
            {request.message ? <p>{request.message}</p> : null}
          </div>
          <button
            className="draw-directory-close"
            type="button"
            data-sheet-cancel
            onClick={() => onResolve(cancelValue)}
          >
            Close
          </button>
        </div>

        <div className="draw-directory-modal-body">
          {request.kind === "prompt" ? (
            <input
              ref={inputRef}
              className="draw-directory-input"
              aria-label={request.title}
              type="text"
              inputMode="text"
              placeholder={request.placeholder}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          ) : null}

          <div className="draw-directory-header-actions draw-directory-footer-actions">
            <button
              className="draw-directory-close"
              type="button"
              onClick={() => onResolve(cancelValue)}
            >
              Cancel
            </button>
            <button
              className={
                request.kind === "confirm" && request.danger
                  ? "draw-directory-close draw-directory-danger-action"
                  : "draw-directory-close draw-directory-primary-action"
              }
              type="button"
              onClick={() =>
                onResolve(
                  request.kind === "prompt" ? value : true,
                )
              }
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
