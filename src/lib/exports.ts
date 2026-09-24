export type ExportFormat = "excalidraw" | "png" | "svg" | "pdf";

export type ExportCenterOptions = {
  formats: ExportFormat[];
  scale: 1 | 2 | 3;
  background: boolean;
  shareAfter: boolean;
};

export const DEFAULT_EXPORT_CENTER_OPTIONS: ExportCenterOptions = {
  formats: ["excalidraw", "png", "svg", "pdf"],
  scale: 1,
  background: true,
  shareAfter: false,
};
