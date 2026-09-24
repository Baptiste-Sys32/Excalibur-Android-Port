import { useMemo, useState } from "react";

import type { CanvasTemplate } from "../lib/templates";
import type { CustomCanvasTemplate } from "../lib/persistence";

type TemplatePickerModalProps = {
  templates: readonly CanvasTemplate[];
  customTemplates: readonly CustomCanvasTemplate[];
  onClose: () => void;
  onSelect: (template: CanvasTemplate | CustomCanvasTemplate) => void;
  onRenameCustom: (template: CustomCanvasTemplate) => void;
  onDeleteCustom: (template: CustomCanvasTemplate) => void;
};

export function TemplatePickerModal({
  customTemplates,
  onClose,
  onDeleteCustom,
  onRenameCustom,
  onSelect,
  templates,
}: TemplatePickerModalProps) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleBundled = useMemo(
    () =>
      normalizedQuery
        ? templates.filter(
            (template) =>
              template.name.toLowerCase().includes(normalizedQuery) ||
              template.description.toLowerCase().includes(normalizedQuery),
          )
        : templates,
    [normalizedQuery, templates],
  );
  const visibleCustom = useMemo(
    () =>
      normalizedQuery
        ? customTemplates.filter(
            (template) =>
              template.name.toLowerCase().includes(normalizedQuery) ||
              template.description.toLowerCase().includes(normalizedQuery),
          )
        : customTemplates,
    [normalizedQuery, customTemplates],
  );
  return (
    <div className="draw-directory-modal-backdrop" onClick={onClose}>
      <div
        className="draw-directory-modal"
        role="dialog"
        aria-modal="true"
        aria-label="New from template"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="draw-directory-modal-header">
          <div>
            <strong>New from Template</strong>
            <p>Bundled local templates</p>
          </div>
          <button className="draw-directory-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="draw-directory-modal-body">
          <input
            aria-label="Search templates"
            className="draw-directory-search"
            placeholder="Search templates"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="draw-directory-section-label">Bundled</div>
          {visibleBundled.length === 0 ? (
            <p className="draw-directory-empty">No bundled templates match.</p>
          ) : (
            visibleBundled.map((template) => (
            <button
              key={template.id}
              className="draw-directory-entry draw-directory-entry--template"
              type="button"
              onClick={() => onSelect(template)}
            >
              <span className="draw-directory-entry-text">
                <span className="draw-menu-button-label">{template.name}</span>
                <span className="draw-menu-button-meta">
                  {template.description}
                </span>
              </span>
            </button>
            ))
          )}

          <div className="draw-directory-section-label">Custom</div>
          {visibleCustom.length === 0 ? (
            <p className="draw-directory-empty">
              {customTemplates.length === 0
                ? "No custom templates saved yet."
                : "No custom templates match."}
            </p>
          ) : (
            visibleCustom.map((template) => (
              <div
                key={template.id}
                className="draw-directory-entry draw-directory-entry--canvas"
              >
                <button
                  className="draw-directory-entry-main"
                  type="button"
                  onClick={() => onSelect(template)}
                >
                  <span className="draw-directory-thumbnail" aria-hidden="true">
                    {template.thumbnailUri ? (
                      <img src={template.thumbnailUri} alt="" />
                    ) : (
                      <span>{template.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="draw-directory-entry-text">
                    <span className="draw-menu-button-label">
                      {template.name}
                    </span>
                    <span className="draw-menu-button-meta">
                      {template.description}
                    </span>
                  </span>
                </button>
                <span className="draw-directory-entry-actions">
                  <button type="button" onClick={() => onRenameCustom(template)}>
                    Rename
                  </button>
                  <button
                    className="draw-directory-danger-action"
                    type="button"
                    onClick={() => onDeleteCustom(template)}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
