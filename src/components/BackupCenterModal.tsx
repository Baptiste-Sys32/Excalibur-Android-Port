import { useRef } from "react";

type BackupCenterModalProps = {
  workspaceLabel: string;
  busy: boolean;
  onClose: () => void;
  onExport: () => void;
  onRestore: (file: File) => void;
};

export function BackupCenterModal({
  workspaceLabel,
  busy,
  onClose,
  onExport,
  onRestore,
}: BackupCenterModalProps) {
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="draw-directory-modal-backdrop" onClick={onClose}>
      <div
        className="draw-directory-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Backup center"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={restoreInputRef}
          className="draw-hidden-input"
          type="file"
          accept=".zip,application/zip"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              onRestore(file);
            }
          }}
        />

        <div className="draw-directory-modal-header">
          <div>
            <strong>Backup Center</strong>
            <p>{workspaceLabel}/backups</p>
          </div>
          <button className="draw-directory-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="draw-directory-modal-body">
          <button
            className="draw-directory-entry draw-directory-entry--template"
            disabled={busy}
            type="button"
            onClick={onExport}
          >
            <span className="draw-directory-entry-text">
              <span className="draw-menu-button-label">Back up this workspace</span>
              <span className="draw-menu-button-meta">
                Canvases, exported libraries, exports and custom templates
              </span>
            </span>
          </button>

          <button
            className="draw-directory-entry draw-directory-entry--template"
            disabled={busy}
            type="button"
            onClick={() => restoreInputRef.current?.click()}
          >
            <span className="draw-directory-entry-text">
              <span className="draw-menu-button-label">Restore from backup</span>
              <span className="draw-menu-button-meta">
                Conflicting files are restored with a suffix
              </span>
            </span>
          </button>

          {busy ? (
            <p className="draw-directory-empty">Working on backup files...</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
