import { App as AppPlugin } from "@capacitor/app";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import {
  CaptureUpdateAction,
  Excalidraw,
  MIME_TYPES,
  WelcomeScreen,
  loadLibraryFromBlob,
} from "@excalidraw/excalidraw";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { BackupCenterModal } from "./components/BackupCenterModal";
import { CanvasManagerModal } from "./components/CanvasManagerModal";
import { DrawMainMenu } from "./components/DrawMainMenu";
import { ExportCenterModal } from "./components/ExportCenterModal";
import { ImportAssistantModal } from "./components/ImportAssistantModal";
import { PageSettingsModal } from "./components/PageSettingsModal";
import { PageTemplateOverlay } from "./components/PageTemplateOverlay";
import StylusHoverOverlay from "./components/StylusHoverOverlay";
import { TemplatePickerModal } from "./components/TemplatePickerModal";
import { isNativePlatform } from "./lib/capacitor";
import type { ExportFormat } from "./lib/exports";
import type { ImportFile, ImportPlan } from "./lib/imports";
import {
  MAX_IMAGE_PIXELS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_FILE_COUNT,
  MAX_IMPORT_TOTAL_BYTES,
} from "./lib/limits";
import {
  DEFAULT_PAGE_SETTINGS,
  getPageTemplateOption,
  isPageTemplateEnabled,
  normalizePageSettings,
  type PageSettings,
  type PageViewport,
} from "./lib/pageSettings";
import { CANVAS_TEMPLATES, type CanvasTemplate } from "./lib/templates";

import {
  addIntentOpenListener,
  addStylusChangeListener,
  getPendingOpenSafe,
  getStylusSnapshotSafe,
  openStorageDirectorySafe,
  type NativeStylusSnapshot,
  type PendingOpenFile,
  type PendingOpenPayload,
} from "./lib/androidBridge";
import {
  DEFAULT_SETTINGS,
  deleteCustomTemplate,
  createBackupZip,
  deleteSavedScene,
  duplicateSavedScene,
  getSavedSceneThumbnail,
  listSavedScenesFromDevice,
  listCanvasVersions,
  listCustomTemplates,
  loadAppBootstrap,
  loadSceneFromBlobData,
  loadSceneFromPath,
  loadSceneFromSavedDeviceFile,
  makeSceneTitle,
  persistLibrary,
  persistSavedSceneThumbnail,
  persistSettings,
  renameSavedScene,
  renameCustomTemplate,
  restoreBackupZip,
  restoreCanvasVersion,
  saveCanvasVersion,
  saveBlobExport,
  saveCustomTemplate,
  saveImportedLibraryFile,
  saveImportedSceneFile,
  saveRecoverySnapshot,
  setSavedScenePinned,
  saveTextExport,
  sceneHasContent,
  serializeLibrary,
  serializeScene,
  suggestedFilename,
  writeAutosave,
  writeDegradedAutosave,
  clearDegradedAutosave,
  type CanvasVersionMeta,
  type CustomCanvasTemplate,
  type DrawSettings,
  type SavedSceneFile,
  type SavedExport,
  type ScenePayload,
  type SceneSnapshotMeta,
} from "./lib/persistence";
import {
  newImageElement,
  syncInvalidIndices,
} from "@excalidraw/element";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  LibraryItems,
} from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawImageElement,
  OrderedExcalidrawElement,
  Theme,
} from "@excalidraw/excalidraw/element/types";

const AUTOSAVE_DEBOUNCE_MS = 700;
const SNAPSHOT_INTERVAL_MS = 3 * 60 * 1000;
const AUTOSAVE_WARNING_INTERVAL_MS = 30 * 1000;

type ExportScenePayload = {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

type AutosaveStatus = "idle" | "saving" | "saved" | "degraded" | "failed";

type AutosaveHealth = {
  status: AutosaveStatus;
  updatedAt: string | null;
  message?: string;
};

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

const decodeBase64ToBytes = (data: string) => {
  if (!BASE64_PATTERN.test(data) || data.length % 4 !== 0) {
    throw new Error("Incoming file is not valid base64");
  }

  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array(Math.floor((data.length * 3) / 4) - padding);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let offset = 0;

  for (let index = 0; index + 4 <= data.length; index += 4) {
    const first = alphabet.indexOf(data[index]);
    const second = alphabet.indexOf(data[index + 1]);
    const third = alphabet.indexOf(data[index + 2]);
    const fourth = alphabet.indexOf(data[index + 3]);

    if (
      first < 0 ||
      second < 0 ||
      (third < 0 && data[index + 2] !== "=") ||
      (fourth < 0 && data[index + 3] !== "=") ||
      (data[index + 2] === "=" && data[index + 3] !== "=")
    ) {
      throw new Error("Incoming file is not valid base64");
    }

    const triplet =
      (first << 18) |
      (second << 12) |
      (Math.max(third, 0) << 6) |
      Math.max(fourth, 0);
    bytes[offset] = (triplet >> 16) & 0xff;
    offset += 1;

    if (data[index + 2] !== "=") {
      bytes[offset] = (triplet >> 8) & 0xff;
      offset += 1;
    }

    if (data[index + 3] !== "=") {
      bytes[offset] = triplet & 0xff;
      offset += 1;
    }
  }

  return bytes;
};

const pendingOpenToBlob = (
  pendingOpen: Pick<PendingOpenPayload, "data" | "encoding" | "mimeType" | "name">,
  fallbackMimeType: string,
) => {
  const mimeType = pendingOpen.mimeType || fallbackMimeType;

  if (pendingOpen.encoding === "base64") {
    const estimatedBytes = Math.floor((pendingOpen.data.length * 3) / 4);
    if (estimatedBytes > MAX_IMPORT_FILE_BYTES) {
      throw new Error("Incoming file exceeds size limit");
    }

    const bytes = decodeBase64ToBytes(pendingOpen.data);
    return new Blob([bytes], { type: mimeType });
  }

  if (new TextEncoder().encode(pendingOpen.data).byteLength > MAX_IMPORT_FILE_BYTES) {
    throw new Error("Incoming file exceeds size limit");
  }

  return new Blob([pendingOpen.data], { type: mimeType });
};

const createScenePayload = (api: ExcalidrawImperativeAPI): ScenePayload => ({
  elements: api
    .getSceneElementsIncludingDeleted() as readonly OrderedExcalidrawElement[],
  appState: api.getAppState(),
  files: api.getFiles(),
});

const createExportPayload = (
  api: ExcalidrawImperativeAPI,
): ExportScenePayload => ({
  elements: api.getSceneElements() as readonly OrderedExcalidrawElement[],
  appState: api.getAppState(),
  files: api.getFiles(),
});

const shareSavedExport = async (savedExport: SavedExport, title: string) => {
  if (!savedExport.uri) {
    return;
  }

  await Share.share({
    title,
    dialogTitle: title,
    url: savedExport.uri,
  });
};

const blobToDataUrl = async (blob: Blob) =>
  new Promise<DataURL>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not load image data"));
        return;
      }
      resolve(reader.result as DataURL);
    };
    reader.readAsDataURL(blob);
  });

const loadImageDimensions = async (dataUrl: DataURL) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error("Could not decode image dimensions"));
        return;
      }
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => reject(new Error("Could not decode image"));
    image.src = dataUrl;
  });

const isLibraryImport = (file: Pick<ImportFile, "name" | "mimeType">) => {
  const name = file.name.toLowerCase();
  const mimeType = file.mimeType.toLowerCase();
  return name.endsWith(".excalidrawlib") || mimeType.includes("excalidrawlib");
};

const isImageImport = (file: Pick<ImportFile, "name" | "mimeType">) => {
  const name = file.name.toLowerCase();
  const mimeType = file.mimeType.toLowerCase();
  return (
    mimeType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(name)
  );
};

const isSvgImport = (file: Pick<ImportFile, "name" | "mimeType">) => {
  const name = file.name.toLowerCase();
  const mimeType = file.mimeType.toLowerCase();
  return mimeType.includes("svg") || name.endsWith(".svg");
};

const UNSAFE_SVG_PATTERNS = [
  /<script/i,
  /<foreignobject/i,
  /<iframe/i,
  /<embed/i,
  /<object/i,
  /javascript:/i,
  /\son[a-z]+\s*=/i,
];

const hasUnsafeSvgContent = async (blob: Blob) => {
  const text = await blob.text();
  return UNSAFE_SVG_PATTERNS.some((pattern) => pattern.test(text));
};

const isSceneImport = (file: Pick<ImportFile, "name" | "mimeType">) => {
  const name = file.name.toLowerCase();
  const mimeType = file.mimeType.toLowerCase();
  return (
    !isLibraryImport(file) &&
    !isImageImport(file) &&
    (name.endsWith(".excalidraw") ||
      name.endsWith(".json") ||
      mimeType.includes("json"))
  );
};

const createImportPlan = (importFiles: readonly ImportFile[]): ImportPlan => {
  let plannedBytes = 0;

  return importFiles.reduce<ImportPlan>(
    (plan, file, index) => {
      plannedBytes += file.size;

      if (
        file.size > MAX_IMPORT_FILE_BYTES ||
        index >= MAX_IMPORT_FILE_COUNT ||
        plannedBytes > MAX_IMPORT_TOTAL_BYTES
      ) {
        plan.oversized.push(file);
        return plan;
      }

      if (isLibraryImport(file)) {
        plan.libraries.push(file);
      } else if (isImageImport(file)) {
        plan.images.push(file);
      } else if (isSceneImport(file)) {
        plan.scenes.push(file);
      } else {
        plan.unsupported.push(file);
      }

      return plan;
    },
    {
      scenes: [],
      libraries: [],
      images: [],
      unsupported: [],
      oversized: [],
    },
  );
};

const supportedImportCount = (plan: ImportPlan) =>
  plan.scenes.length + plan.libraries.length + plan.images.length;

const estimatePendingOpenSize = (file: PendingOpenFile) => {
  if (typeof file.size === "number") {
    return file.size;
  }

  if (file.encoding !== "base64") {
    return new TextEncoder().encode(file.data).byteLength;
  }

  const padding = file.data.endsWith("==") ? 2 : file.data.endsWith("=") ? 1 : 0;
  return Math.floor((file.data.length * 3) / 4) - padding;
};

const pendingOpenFileToImportFile = (file: PendingOpenFile): ImportFile => {
  const fallbackMimeType = isLibraryImport(file)
    ? MIME_TYPES.excalidrawlib
    : isImageImport(file)
    ? file.mimeType || MIME_TYPES.binary
    : MIME_TYPES.excalidraw;
  const estimatedSize = estimatePendingOpenSize(file);

  if (estimatedSize > MAX_IMPORT_FILE_BYTES) {
    return {
      name: file.name,
      mimeType: file.mimeType || fallbackMimeType,
      blob: new Blob([], { type: file.mimeType || fallbackMimeType }),
      size: estimatedSize,
    };
  }

  const blob = pendingOpenToBlob(file, fallbackMimeType);
  return {
    name: file.name,
    mimeType: file.mimeType || fallbackMimeType,
    blob,
    size: file.size ?? blob.size,
  };
};

const pendingOpenFiles = (pendingOpen: PendingOpenPayload) =>
  pendingOpen.files?.length ? pendingOpen.files : [pendingOpen];

const shouldDeferPendingOpen = (pendingOpen: PendingOpenPayload | null) => {
  if (!pendingOpen) {
    return false;
  }

  const files = pendingOpenFiles(pendingOpen);
  return files.length > 1 || files.some((file) => isImageImport(file));
};

const makeElementId = () =>
  `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const formatExportTimestamp = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate(),
  )}-${pad(date.getHours())}${pad(date.getMinutes())}`;
};

const formatAutosaveStatus = (status: AutosaveStatus) =>
  status[0].toUpperCase() + status.slice(1);

function App() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [initialData, setInitialData] = useState<ExcalidrawInitialDataState | null>(
    null,
  );
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItems>([]);
  const [recents, setRecents] = useState<SceneSnapshotMeta[]>([]);
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_SETTINGS);
  const [sceneName, setSceneName] = useState("Untitled scene");
  const [theme, setTheme] = useState<Theme>("light");
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [autosaveHealth, setAutosaveHealth] = useState<AutosaveHealth>({
    status: "idle",
    updatedAt: null,
  });
  const [penMode, setPenMode] = useState(false);
  const [penDetected, setPenDetected] = useState(false);
  const [nativeStylus, setNativeStylus] = useState<NativeStylusSnapshot | null>(
    null,
  );
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [viewModeEnabled, setViewModeEnabled] = useState(false);
  const [gridModeEnabled, setGridModeEnabled] = useState(false);
  const [objectsSnapModeEnabled, setObjectsSnapModeEnabled] = useState(false);
  const [pageSettings, setPageSettings] =
    useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [pageViewport, setPageViewport] = useState<PageViewport | null>(null);
  const [canvasDirectoryOpen, setCanvasDirectoryOpen] = useState(false);
  const [canvasDirectoryLoading, setCanvasDirectoryLoading] = useState(false);
  const [savedCanvasFiles, setSavedCanvasFiles] = useState<SavedSceneFile[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomCanvasTemplate[]>(
    [],
  );
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [backupCenterOpen, setBackupCenterOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importAssistantPlan, setImportAssistantPlan] =
    useState<ImportPlan | null>(null);
  const [importAssistantBusy, setImportAssistantBusy] = useState(false);
  const [exportCenterOpen, setExportCenterOpen] = useState(false);
  const [exportCenterBusy, setExportCenterBusy] = useState(false);
  const [activeTimelineScene, setActiveTimelineScene] =
    useState<SavedSceneFile | null>(null);
  const [canvasVersions, setCanvasVersions] = useState<CanvasVersionMeta[]>([]);
  const [canvasVersionsLoading, setCanvasVersionsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const latestSceneRef = useRef<ScenePayload | null>(null);
  const currentSavedSceneRef = useRef<SavedSceneFile | null>(null);
  const deferredPendingOpenRef = useRef<PendingOpenPayload[]>([]);
  const refreshSavedScenesRef = useRef<(() => Promise<void>) | null>(null);
  const recentsRef = useRef<SceneSnapshotMeta[]>([]);
  const settingsRef = useRef<DrawSettings>(DEFAULT_SETTINGS);
  const pageSettingsRef = useRef<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const pageViewportRef = useRef<PageViewport | null>(null);
  const pageViewportPendingRef = useRef<PageViewport | null>(null);
  const pageViewportRafRef = useRef<number | null>(null);
  const libraryItemsRef = useRef<LibraryItems>([]);
  const autosaveTimerRef = useRef<number | null>(null);
  const persistInFlightRef = useRef<Promise<boolean> | null>(null);
  const thumbnailHydrationRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const lastAutosaveWarningAtRef = useRef(0);
  const hasMeaningfulChangeRef = useRef(false);
  const lastSnapshotAtRef = useRef(0);
  const lastSnapshotSignatureRef = useRef("");
  const forcedEraserToolRef = useRef<AppState["activeTool"] | null>(null);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    recentsRef.current = recents;
  }, [recents]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    pageSettingsRef.current = pageSettings;
  }, [pageSettings]);

  useEffect(() => {
    libraryItemsRef.current = libraryItems;
  }, [libraryItems]);

  useEffect(() => {
    document.documentElement.dataset.appTheme = theme;
    document.title = `${makeSceneTitle(sceneName)} · Escalidraw`;
  }, [sceneName, theme]);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    apiRef.current?.setToast({
      message,
      duration: Infinity,
    });

    toastTimerRef.current = window.setTimeout(() => {
      apiRef.current?.setToast(null);
      toastTimerRef.current = null;
    }, 10000);
  }, []);

  const showThrottledAutosaveWarning = useCallback(
    (message: string) => {
      const now = Date.now();
      if (now - lastAutosaveWarningAtRef.current < AUTOSAVE_WARNING_INTERVAL_MS) {
        return;
      }

      lastAutosaveWarningAtRef.current = now;
      showToast(message);
    },
    [showToast],
  );

  const runPersistCurrentScene = useCallback(
    async (forceSnapshot: boolean) => {
      const currentApi = apiRef.current;
      const payload = currentApi
        ? createScenePayload(currentApi)
        : latestSceneRef.current;

      if (!payload) {
        return false;
      }

      setAutosaveHealth({
        status: "saving",
        updatedAt: new Date().toISOString(),
      });
      const serialized = serializeScene(payload, pageSettingsRef.current);
      let fullSerialized: string | null = null;

      try {
        await writeAutosave(serialized);
        fullSerialized = serialized;
        await clearDegradedAutosave();
        const savedAt = new Date().toISOString();
        setLastAutosavedAt(savedAt);
        setAutosaveHealth({
          status: "saved",
          updatedAt: savedAt,
        });
      } catch {
        try {
          // Compact fallback keeps a degraded autosave available when file
          // payloads are too large, without touching the last complete copy.
          const degradedSerialized = serializeScene(
            {
              ...payload,
              files: {} as BinaryFiles,
            },
            pageSettingsRef.current,
          );
          await writeDegradedAutosave(degradedSerialized);
          const savedAt = new Date().toISOString();
          const message =
            "Autosave is degraded. Embedded files/images may need manual save/export.";
          setLastAutosavedAt(savedAt);
          setAutosaveHealth({
            status: "degraded",
            updatedAt: savedAt,
            message,
          });
          showThrottledAutosaveWarning(message);
        } catch {
          const message = "Autosave failed. Use Save to device or Export Center.";
          setAutosaveHealth({
            status: "failed",
            updatedAt: new Date().toISOString(),
            message,
          });
          showThrottledAutosaveWarning(message);
          return false;
        }
      }

      if (!sceneHasContent(payload) || !fullSerialized) {
        return true;
      }

      const shouldSnapshot =
        lastSnapshotSignatureRef.current !== fullSerialized &&
        (forceSnapshot ||
          Date.now() - lastSnapshotAtRef.current > SNAPSHOT_INTERVAL_MS);

      if (!shouldSnapshot) {
        return true;
      }

      try {
        const nextRecents = await saveRecoverySnapshot({
          serializedScene: fullSerialized,
          title: makeSceneTitle(payload.appState.name),
          elementCount: payload.elements.filter((element) => !element.isDeleted)
            .length,
          recents: recentsRef.current,
        });

        lastSnapshotAtRef.current = Date.now();
        lastSnapshotSignatureRef.current = fullSerialized;
        recentsRef.current = nextRecents;
        startTransition(() => setRecents(nextRecents));
      } catch {
        showToast("Recovery snapshot failed");
      }

      return true;
    },
    [showThrottledAutosaveWarning, showToast],
  );

  const persistCurrentScene = useCallback(
    async (forceSnapshot: boolean) => {
      const previous = persistInFlightRef.current;
      const run = (async () => {
        if (previous) {
          await previous.catch(() => undefined);
        }
        return runPersistCurrentScene(forceSnapshot);
      })();

      persistInFlightRef.current = run;
      try {
        return await run;
      } finally {
        if (persistInFlightRef.current === run) {
          persistInFlightRef.current = null;
        }
      }
    },
    [runPersistCurrentScene],
  );

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistCurrentScene(false);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [persistCurrentScene]);

  const handleLibraryChange = useCallback((nextLibraryItems: LibraryItems) => {
    setLibraryItems(nextLibraryItems);
    libraryItemsRef.current = nextLibraryItems;
    void persistLibrary(nextLibraryItems);
  }, []);

  const applySceneData = useCallback(
    async (sceneData: ExcalidrawInitialDataState, notice?: string) => {
      const currentApi = apiRef.current;
      if (!currentApi) {
        return;
      }

      const nextPageSettings = normalizePageSettings(
        (sceneData as ExcalidrawInitialDataState & { pageSettings?: PageSettings })
          .pageSettings,
      );
      const nextElements =
        (sceneData.elements as readonly OrderedExcalidrawElement[] | undefined) ??
        [];
      setPageSettings(nextPageSettings);
      pageSettingsRef.current = nextPageSettings;
      currentApi.history.clear();

      if (sceneData.libraryItems) {
        const nextLibraryItems = sceneData.libraryItems as LibraryItems;
        setLibraryItems(nextLibraryItems);
        libraryItemsRef.current = nextLibraryItems;
        await persistLibrary(nextLibraryItems);
        await Promise.resolve(
          currentApi.updateLibrary({ libraryItems: nextLibraryItems }),
        );
      }

      const files = Object.values(sceneData.files ?? {});
      if (files.length > 0) {
        currentApi.addFiles(files);
      }

      currentApi.updateScene({
        elements: nextElements,
        appState: {
          ...currentApi.getAppState(),
          ...(sceneData.appState ?? {}),
          openDialog: null,
          openSidebar: null,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      if ((sceneData.elements?.length ?? 0) > 0) {
        currentApi.scrollToContent(sceneData.elements as never, {
          fitToContent: true,
          animate: false,
        });
      }

      await persistCurrentScene(true);

      if (notice) {
        showToast(notice);
      }
    },
    [persistCurrentScene, showToast],
  );

  const stageCurrentSceneForImport = useCallback(async () => {
    const payload = latestSceneRef.current;
    if (!payload || !sceneHasContent(payload)) {
      return;
    }

    if (currentSavedSceneRef.current && hasMeaningfulChangeRef.current) {
      const serializedScene = serializeScene(payload, pageSettingsRef.current);
      await saveCanvasVersion(
        currentSavedSceneRef.current,
        serializedScene,
        `Before leaving ${currentSavedSceneRef.current.name}`,
        payload.elements.filter((element) => !element.isDeleted).length,
      ).catch(() => undefined);
    }

    await persistCurrentScene(true);
  }, [persistCurrentScene]);

  const insertImageFiles = useCallback(
    async (imageFiles: readonly ImportFile[]) => {
      const currentApi = apiRef.current;
      if (!currentApi || imageFiles.length === 0) {
        return 0;
      }

      const currentState = currentApi.getAppState();
      const zoom = currentState.zoom?.value || 1;
      const viewportCenter = {
        x: -currentState.scrollX + currentState.width / (2 * zoom),
        y: -currentState.scrollY + currentState.height / (2 * zoom),
      };
      const imageElements: ExcalidrawImageElement[] = [];
      const binaryFiles: BinaryFileData[] = [];

      for (const [index, file] of imageFiles.entries()) {
        try {
          if (isSvgImport(file) && (await hasUnsafeSvgContent(file.blob))) {
            continue;
          }

          const dataURL = await blobToDataUrl(file.blob);
          const dimensions = await loadImageDimensions(dataURL);

          if (dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
            continue;
          }
        const scale = Math.min(1, 640 / Math.max(dimensions.width, dimensions.height));
        const width = Math.max(1, Math.round(dimensions.width * scale));
        const height = Math.max(1, Math.round(dimensions.height * scale));
        const fileId = makeElementId() as BinaryFileData["id"];
        const offset = index * 28;

        binaryFiles.push({
          id: fileId,
          mimeType: (file.mimeType || MIME_TYPES.binary) as BinaryFileData["mimeType"],
          dataURL,
          created: Date.now(),
          lastRetrieved: Date.now(),
        });

        imageElements.push(
          newImageElement({
            type: "image",
            x: viewportCenter.x - width / 2 + offset,
            y: viewportCenter.y - height / 2 + offset,
            width,
            height,
            fileId,
            status: "saved",
          }),
        );
        } catch {
          continue;
        }
      }

      currentApi.addFiles(binaryFiles);
      currentApi.updateScene({
        elements: syncInvalidIndices([
          ...currentApi.getSceneElementsIncludingDeleted(),
          ...imageElements,
        ]),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      await persistCurrentScene(true);
      return imageElements.length;
    },
    [persistCurrentScene],
  );

  const executeImportPlan = useCallback(
    async (plan: ImportPlan) => {
      const currentApi = apiRef.current;
      if (!currentApi || supportedImportCount(plan) === 0) {
        showToast("No supported files found");
        return;
      }

      await stageCurrentSceneForImport();

      if (
        plan.scenes.length === 1 &&
        plan.libraries.length === 0 &&
        plan.images.length === 0
      ) {
        const scene = await loadSceneFromBlobData(
          plan.scenes[0].blob,
          libraryItemsRef.current,
        );

        currentSavedSceneRef.current = null;
        await applySceneData(
          {
            ...scene,
            libraryItems: libraryItemsRef.current,
          },
          `Opened ${plan.scenes[0].name}`,
        );
        return;
      }

      let copiedScenes = 0;
      let mergedLibraries = 0;
      let insertedImages = 0;

      const invalidFiles = new Set<ImportFile>();

      for (const sceneFile of plan.scenes) {
        try {
          await loadSceneFromBlobData(sceneFile.blob, libraryItemsRef.current);
        } catch {
          invalidFiles.add(sceneFile);
        }
      }

      for (const libraryFile of plan.libraries) {
        try {
          await loadLibraryFromBlob(libraryFile.blob);
        } catch {
          invalidFiles.add(libraryFile);
        }
      }

      for (const sceneFile of plan.scenes) {
        if (invalidFiles.has(sceneFile)) {
          continue;
        }
        await saveImportedSceneFile(sceneFile.name, await sceneFile.blob.text());
        copiedScenes += 1;
      }

      for (const libraryFile of plan.libraries) {
        if (invalidFiles.has(libraryFile)) {
          continue;
        }
        const nextLibraryItems = (await currentApi.updateLibrary({
          libraryItems: libraryFile.blob,
          merge: true,
          prompt: false,
        })) as LibraryItems;

        setLibraryItems(nextLibraryItems);
        libraryItemsRef.current = nextLibraryItems;
        await persistLibrary(nextLibraryItems);
        await saveImportedLibraryFile(libraryFile.name, await libraryFile.blob.text());
        mergedLibraries += 1;
      }

      insertedImages = await insertImageFiles(plan.images);

      const summary = [
        copiedScenes ? `${copiedScenes} canvas file${copiedScenes === 1 ? "" : "s"}` : "",
        mergedLibraries
          ? `${mergedLibraries} librar${mergedLibraries === 1 ? "y" : "ies"}`
          : "",
        insertedImages ? `${insertedImages} image${insertedImages === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      const skipped =
        plan.unsupported.length + plan.oversized.length + invalidFiles.size;

      if (summary.length) {
        showToast(
          `Imported ${summary.join(", ")}${
            skipped ? `; skipped ${skipped}` : ""
          }`,
        );
        await refreshSavedScenesRef.current?.();
      } else {
        showToast("No supported files found");
      }
    },
    [
      applySceneData,
      insertImageFiles,
      showToast,
      stageCurrentSceneForImport,
    ],
  );

  const processImportFiles = useCallback(
    async (importFiles: readonly ImportFile[]) => {
      if (!apiRef.current || importFiles.length === 0) {
        return;
      }

      const plan = createImportPlan(importFiles);
      const isSingleDirectScene =
        importFiles.length === 1 &&
        plan.scenes.length === 1 &&
        plan.libraries.length === 0 &&
        plan.images.length === 0 &&
        plan.unsupported.length === 0 &&
        plan.oversized.length === 0;

      if (isSingleDirectScene) {
        await executeImportPlan(plan);
        return;
      }

      setImportAssistantPlan(plan);
    },
    [executeImportPlan],
  );

  const handlePendingOpen = useCallback(
    async (pendingOpen: PendingOpenPayload) => {
      const currentApi = apiRef.current;
      if (!currentApi) {
        return;
      }

      try {
        const importFiles = pendingOpenFiles(pendingOpen).map(
          pendingOpenFileToImportFile,
        );
        await processImportFiles(importFiles);
      } catch {
        showToast(`Could not open ${pendingOpen.name}`);
      }
    },
    [processImportFiles, showToast],
  );

  const drainPendingOpenQueue = useCallback(async () => {
    const pendingOpens: PendingOpenPayload[] = [];

    for (;;) {
      const pendingOpen = await getPendingOpenSafe();
      if (!pendingOpen) {
        break;
      }
      pendingOpens.push(pendingOpen);
    }

    return pendingOpens;
  }, []);

  const handleQueuedPendingOpens = useCallback(
    async (pendingOpens: readonly PendingOpenPayload[]) => {
      for (const pendingOpen of pendingOpens) {
        await handlePendingOpen(pendingOpen);
      }
    },
    [handlePendingOpen],
  );

  const applyStylusSnapshot = useCallback((snapshot: NativeStylusSnapshot | null) => {
    setNativeStylus(snapshot);

    const currentApi = apiRef.current;
    if (!snapshot || !currentApi || !settingsRef.current.preferNativeStylusBridge) {
      return;
    }

    const currentState = currentApi.getAppState();

    if (
      !currentState.penDetected &&
      (snapshot.pointerType === "pen" || snapshot.toolType === "stylus")
    ) {
      currentApi.updateScene({
        appState: {
          penDetected: true,
          penMode: true,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }

    if (snapshot.toolType === "eraser") {
      if (!forcedEraserToolRef.current && currentState.activeTool.type !== "eraser") {
        forcedEraserToolRef.current = currentState.activeTool;
        currentApi.setActiveTool({ type: "eraser" });
      }
      return;
    }

    if (forcedEraserToolRef.current) {
      currentApi.setActiveTool(forcedEraserToolRef.current);
      forcedEraserToolRef.current = null;
    }
  }, []);

  const updatePenMode = useCallback(async (nextPenMode: boolean) => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    const currentState = currentApi.getAppState();

    currentApi.updateScene({
      appState: {
        penMode: nextPenMode,
        penDetected: nextPenMode || currentState.penDetected,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    const nextSettings = {
      ...settingsRef.current,
      forcePenMode: nextPenMode,
    };

    setSettings(nextSettings);
    settingsRef.current = nextSettings;
    await persistSettings(nextSettings);
  }, []);

  const updateStylusBridgePreference = useCallback(async (enabled: boolean) => {
    const nextSettings = {
      ...settingsRef.current,
      preferNativeStylusBridge: enabled,
    };

    setSettings(nextSettings);
    settingsRef.current = nextSettings;
    await persistSettings(nextSettings);
  }, []);

  const updatePenHoverRingPreference = useCallback(async (enabled: boolean) => {
    const nextSettings = {
      ...settingsRef.current,
      showPenHoverRing: enabled,
    };

    setSettings(nextSettings);
    settingsRef.current = nextSettings;
    await persistSettings(nextSettings);
  }, []);

  const toggleTheme = useCallback(() => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    const nextTheme: Theme = theme === "dark" ? "light" : "dark";

    currentApi.updateScene({
      appState: {
        theme: nextTheme,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    setTheme(nextTheme);
  }, [theme]);

  const toggleZenMode = useCallback(() => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    const nextValue = !zenModeEnabled;
    currentApi.updateScene({
      appState: {
        zenModeEnabled: nextValue,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setZenModeEnabled(nextValue);
  }, [zenModeEnabled]);

  const toggleViewMode = useCallback(() => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    const nextValue = !viewModeEnabled;
    currentApi.updateScene({
      appState: {
        viewModeEnabled: nextValue,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setViewModeEnabled(nextValue);
  }, [viewModeEnabled]);

  const toggleGridMode = useCallback(() => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    const nextValue = !gridModeEnabled;
    currentApi.updateScene({
      appState: {
        gridModeEnabled: nextValue,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setGridModeEnabled(nextValue);
  }, [gridModeEnabled]);

  const toggleSnapMode = useCallback(() => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    const nextValue = !objectsSnapModeEnabled;
    currentApi.updateScene({
      appState: {
        objectsSnapModeEnabled: nextValue,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setObjectsSnapModeEnabled(nextValue);
  }, [objectsSnapModeEnabled]);

  const flushPageViewport = useCallback(() => {
    pageViewportRafRef.current = null;
    const pending = pageViewportPendingRef.current;
    pageViewportPendingRef.current = null;

    if (!pending) {
      return;
    }

    const currentViewport = pageViewportRef.current;
    if (
      currentViewport &&
      currentViewport.scrollX === pending.scrollX &&
      currentViewport.scrollY === pending.scrollY &&
      currentViewport.width === pending.width &&
      currentViewport.height === pending.height &&
      currentViewport.zoom === pending.zoom
    ) {
      return;
    }

    pageViewportRef.current = pending;
    setPageViewport(pending);
  }, []);

  const syncPageViewportFromAppState = useCallback(
    (appState: AppState) => {
      if (!isPageTemplateEnabled(pageSettingsRef.current)) {
        if (pageViewportRafRef.current) {
          window.cancelAnimationFrame(pageViewportRafRef.current);
          pageViewportRafRef.current = null;
        }
        pageViewportPendingRef.current = null;
        if (pageViewportRef.current) {
          pageViewportRef.current = null;
          setPageViewport(null);
        }
        return;
      }

      // Quantize so sub-pixel scroll noise doesn't rebuild the overlay.
      const nextViewport: PageViewport = {
        scrollX: Math.round(appState.scrollX),
        scrollY: Math.round(appState.scrollY),
        width: Math.round(appState.width),
        height: Math.round(appState.height),
        zoom: Math.round((appState.zoom?.value || 1) * 1000) / 1000,
      };
      pageViewportPendingRef.current = nextViewport;

      if (pageViewportRafRef.current === null) {
        pageViewportRafRef.current = window.requestAnimationFrame(
          flushPageViewport,
        );
      }
    },
    [flushPageViewport],
  );

  const handleChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      setSceneName(makeSceneTitle(appState.name));
      setTheme(appState.theme);
      setPenMode(appState.penMode);
      setPenDetected(appState.penDetected);
      setZenModeEnabled(appState.zenModeEnabled);
      setViewModeEnabled(appState.viewModeEnabled);
      setGridModeEnabled(appState.gridModeEnabled);
      setObjectsSnapModeEnabled(appState.objectsSnapModeEnabled);
      syncPageViewportFromAppState(appState);

      latestSceneRef.current = {
        elements,
        appState,
        files,
      };

      const hasMeaningfulScene =
        elements.some((element) => !element.isDeleted) ||
        Object.keys(files).length > 0 ||
        Boolean(appState.name?.trim());

      if (hasMeaningfulScene) {
        hasMeaningfulChangeRef.current = true;
      }

      if (!hasMeaningfulChangeRef.current) {
        return;
      }

      scheduleAutosave();
    },
    [scheduleAutosave, syncPageViewportFromAppState],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const pendingOpens = await drainPendingOpenQueue();
        const immediateOpen =
          pendingOpens.find((pendingOpen) => !shouldDeferPendingOpen(pendingOpen)) ??
          null;
        deferredPendingOpenRef.current = pendingOpens.filter(
          (pendingOpen) => pendingOpen !== immediateOpen,
        );

        const nextBootstrap = await loadAppBootstrap(immediateOpen);

        if (cancelled) {
          return;
        }

        setInitialData(nextBootstrap.initialData);
        setLibraryItems(nextBootstrap.libraryItems);
        setCustomTemplates(nextBootstrap.customTemplates);
        setRecents(nextBootstrap.recents);
        setSettings(nextBootstrap.settings);
        setPageSettings(nextBootstrap.pageSettings);
        setBootstrapNotice(nextBootstrap.importNotice ?? null);
        libraryItemsRef.current = nextBootstrap.libraryItems;
        recentsRef.current = nextBootstrap.recents;
        settingsRef.current = nextBootstrap.settings;
        pageSettingsRef.current = nextBootstrap.pageSettings;
        setBootstrapped(true);
      } catch {
        if (cancelled) {
          return;
        }

        const safeInitialData: ExcalidrawInitialDataState = {
          appState: { showWelcomeScreen: true },
          libraryItems: [],
        };
        setInitialData(safeInitialData);
        setLibraryItems([]);
        setCustomTemplates([]);
        setRecents([]);
        setSettings(DEFAULT_SETTINGS);
        setPageSettings(DEFAULT_PAGE_SETTINGS);
        setBootstrapNotice("Startup recovery used a blank canvas.");
        libraryItemsRef.current = [];
        recentsRef.current = [];
        settingsRef.current = DEFAULT_SETTINGS;
        pageSettingsRef.current = DEFAULT_PAGE_SETTINGS;
        setBootstrapped(true);
      } finally {
        if (!cancelled) {
          await SplashScreen.hide().catch(() => undefined);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [drainPendingOpenQueue]);

  useEffect(() => {
    if (!api || !bootstrapNotice) {
      return;
    }

    showToast(bootstrapNotice);
    setBootstrapNotice(null);
  }, [api, bootstrapNotice, showToast]);

  useEffect(() => {
    if (!api || !bootstrapped || deferredPendingOpenRef.current.length === 0) {
      return;
    }

    const pendingOpens = deferredPendingOpenRef.current;
    deferredPendingOpenRef.current = [];
    void handleQueuedPendingOpens(pendingOpens);
  }, [api, bootstrapped, handleQueuedPendingOpens]);

  useEffect(() => {
    if (!bootstrapped || !api || !initialData) {
      return;
    }

    if (settings.forcePenMode) {
      api.updateScene({
        appState: {
          penMode: true,
          penDetected: true,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
  }, [api, bootstrapped, initialData, settings.forcePenMode]);

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    void getStylusSnapshotSafe().then((snapshot) => {
      if (snapshot) {
        applyStylusSnapshot(snapshot);
      }
    });
  }, [applyStylusSnapshot, bootstrapped]);

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    let disposed = false;

    const register = async () => {
      const intentListener = await addIntentOpenListener(() => {
        if (!disposed) {
          void drainPendingOpenQueue().then((pendingOpens) =>
            handleQueuedPendingOpens(pendingOpens),
          );
        }
      });
      const stylusListener = await addStylusChangeListener((snapshot) => {
        if (!disposed) {
          applyStylusSnapshot(snapshot);
        }
      });

      return () => {
        void intentListener.remove();
        void stylusListener.remove();
      };
    };

    let cleanup: () => void = () => {};

    void register().then((teardown) => {
      cleanup = teardown;
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [applyStylusSnapshot, bootstrapped, drainPendingOpenQueue, handleQueuedPendingOpens]);

  useEffect(() => {
    const listenerPromise = AppPlugin.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        void persistCurrentScene(true);
      }
    });

    return () => {
      void listenerPromise.then((listener) => listener.remove());
    };
  }, [persistCurrentScene]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (pageViewportRafRef.current !== null) {
        window.cancelAnimationFrame(pageViewportRafRef.current);
        pageViewportRafRef.current = null;
      }
    };
  }, []);

  const openFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const openDirectory = useCallback(async () => {
    if (!isNativePlatform) {
      openFiles();
      return;
    }

    const result = await openStorageDirectorySafe();
    if (result.opened) {
      return;
    }

    const reason = result.error?.trim();
    showToast(
      reason
        ? `Could not open Excalidraw directory: ${reason}`
        : "Could not open Excalidraw directory",
    );
  }, [openFiles, showToast]);

  const hydrateSavedSceneThumbnails = useCallback(
    async (savedScenes: SavedSceneFile[]) => {
      const generation = thumbnailHydrationRef.current;
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const updates = new Map<
        string,
        { thumbnailUri: string; elementCount?: number }
      >();

      for (const savedScene of savedScenes) {
        if (generation !== thumbnailHydrationRef.current) {
          return;
        }

        try {
          const cachedThumbnail = await getSavedSceneThumbnail(savedScene);
          if (cachedThumbnail) {
            updates.set(`${savedScene.location}:${savedScene.path}`, {
              thumbnailUri: cachedThumbnail,
            });
            continue;
          }

          const scene = await loadSceneFromSavedDeviceFile(savedScene, []);
          const elements = (
            (scene.elements as readonly OrderedExcalidrawElement[] | undefined) ??
            []
          ).filter((element) => !element.isDeleted);

          if (elements.length === 0) {
            continue;
          }

          const blob = await exportToBlob({
            elements: elements as never,
            appState: scene.appState,
            files: (scene.files ?? {}) as BinaryFiles,
            maxWidthOrHeight: 220,
            exportPadding: 12,
            mimeType: MIME_TYPES.png,
          });
          const thumbnailUri = await blobToDataUrl(blob);
          await persistSavedSceneThumbnail(savedScene, thumbnailUri);
          updates.set(`${savedScene.location}:${savedScene.path}`, {
            thumbnailUri,
            elementCount: elements.length,
          });
        } catch {
          // Thumbnail generation is best-effort and should not block the manager.
        }
      }

      if (generation !== thumbnailHydrationRef.current || updates.size === 0) {
        return;
      }

      setSavedCanvasFiles((currentFiles) =>
        currentFiles.map((currentFile) => {
          const update = updates.get(
            `${currentFile.location}:${currentFile.path}`,
          );
          return update ? { ...currentFile, ...update } : currentFile;
        }),
      );
    },
    [],
  );

  const refreshSavedScenes = useCallback(async () => {
    thumbnailHydrationRef.current += 1;
    setCanvasDirectoryLoading(true);

    try {
      const savedScenes = await listSavedScenesFromDevice();
      setSavedCanvasFiles(savedScenes);
      void hydrateSavedSceneThumbnails(savedScenes);
    } catch {
      setSavedCanvasFiles([]);
      showToast("Could not open Excalidraw/canvases");
    } finally {
      setCanvasDirectoryLoading(false);
    }
  }, [hydrateSavedSceneThumbnails, showToast]);

  refreshSavedScenesRef.current = refreshSavedScenes;

  const openCanvas = useCallback(async () => {
    setCanvasDirectoryOpen(true);
    setActiveTimelineScene(null);
    setCanvasVersions([]);
    await refreshSavedScenes();
  }, [refreshSavedScenes]);

  const openSavedCanvas = useCallback(
    async (savedScene: SavedSceneFile) => {
      try {
        await stageCurrentSceneForImport();

        const scene = await loadSceneFromSavedDeviceFile(
          savedScene,
          libraryItemsRef.current,
        );

        await applySceneData(
          {
            ...scene,
            libraryItems: libraryItemsRef.current,
          },
          `Opened ${savedScene.name}`,
        );

        currentSavedSceneRef.current = savedScene;
        hasMeaningfulChangeRef.current = false;
        setCanvasDirectoryOpen(false);
        setActiveTimelineScene(null);
      } catch {
        showToast(`Could not open ${savedScene.name}`);
      }
    },
    [applySceneData, showToast, stageCurrentSceneForImport],
  );

  const onLocalFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      event.target.value = "";

      if (selectedFiles.length === 0 || !apiRef.current) {
        return;
      }

      try {
        await processImportFiles(
          selectedFiles.map((file) => ({
            name: file.name,
            mimeType: file.type,
            blob: file,
            size: file.size,
          })),
        );
      } catch {
        showToast("Could not import selected files");
      }
    },
    [processImportFiles, showToast],
  );

  const saveSceneCopy = useCallback(async () => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    try {
      const payload = createScenePayload(currentApi);
      const defaultFilename = suggestedFilename(
        makeSceneTitle(payload.appState.name),
        ".excalidraw",
      );
      const requestedFilename =
        typeof window.prompt === "function"
          ? window.prompt("Save to device as:", defaultFilename)
          : defaultFilename;

      if (requestedFilename === null) {
        showToast("Save canceled");
        return;
      }

      const filenameSource = requestedFilename.trim() || defaultFilename;
      const savedExport = await saveTextExport(
        suggestedFilename(filenameSource, ".excalidraw"),
        serializeScene(payload, pageSettingsRef.current),
        MIME_TYPES.excalidraw,
      );

      if (!savedExport.downloaded) {
        const savedScenes = await listSavedScenesFromDevice().catch(() => []);
        currentSavedSceneRef.current =
          savedScenes.find((savedScene) => savedScene.path === savedExport.path) ??
          savedScenes.find((savedScene) => savedScene.name === savedExport.filename) ??
          null;
        if (canvasDirectoryOpen) {
          setSavedCanvasFiles(savedScenes);
          void hydrateSavedSceneThumbnails(savedScenes);
        }
      }

      showToast(
        savedExport.downloaded
          ? `Downloaded ${savedExport.filename}`
          : `Saved to ${savedExport.path}`,
      );
    } catch (error) {
      const reason =
        error instanceof Error && error.message ? ` (${error.message})` : "";
      showToast(`Could not save this scene${reason}`);
    }
  }, [canvasDirectoryOpen, hydrateSavedSceneThumbnails, showToast]);

  const shareSceneCopy = useCallback(async () => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    try {
      const payload = createScenePayload(currentApi);
      const savedExport = await saveTextExport(
        suggestedFilename(makeSceneTitle(payload.appState.name), ".excalidraw"),
        serializeScene(payload, pageSettingsRef.current),
        MIME_TYPES.excalidraw,
      );

      if (!savedExport.uri) {
        showToast(`Downloaded ${savedExport.filename}`);
        return;
      }

      await shareSavedExport(savedExport, "Share Escalidraw scene");
    } catch {
      showToast("Could not prepare scene for sharing");
    }
  }, [showToast]);

  const exportLibrary = useCallback(async () => {
    try {
      const savedExport = await saveTextExport(
        suggestedFilename(`${makeSceneTitle(sceneName)}-library`, ".excalidrawlib"),
        serializeLibrary(libraryItemsRef.current),
        MIME_TYPES.excalidrawlib,
      );

      showToast(
        savedExport.downloaded
          ? `Downloaded ${savedExport.filename}`
          : `Saved to ${savedExport.path}`,
      );
    } catch {
      showToast("Could not export the library");
    }
  }, [sceneName, showToast]);

  const exportPng = useCallback(async () => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");

      const exportPayload = createExportPayload(currentApi);
      const blob = await exportToBlob({
        elements: exportPayload.elements,
        appState: exportPayload.appState,
        files: exportPayload.files,
        mimeType: MIME_TYPES.png,
      });

      const savedExport = await saveBlobExport(
        suggestedFilename(makeSceneTitle(exportPayload.appState.name), ".png"),
        blob,
      );

      showToast(
        savedExport.downloaded
          ? `Downloaded ${savedExport.filename}`
          : `Saved to ${savedExport.path}`,
      );
    } catch {
      showToast("Could not export PNG");
    }
  }, [showToast]);

  const exportSvg = useCallback(async () => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    try {
      const { exportToSvg } = await import("@excalidraw/excalidraw");

      const exportPayload = createExportPayload(currentApi);
      const svgElement = await exportToSvg({
        elements: exportPayload.elements,
        appState: exportPayload.appState,
        files: exportPayload.files,
      });

      const savedExport = await saveBlobExport(
        suggestedFilename(makeSceneTitle(exportPayload.appState.name), ".svg"),
        new Blob([svgElement.outerHTML], { type: MIME_TYPES.svg }),
      );

      showToast(
        savedExport.downloaded
          ? `Downloaded ${savedExport.filename}`
          : `Saved to ${savedExport.path}`,
      );
    } catch {
      showToast("Could not export SVG");
    }
  }, [showToast]);

  const exportPdf = useCallback(async () => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    try {
      const { createA4PdfBlob } = await import("./lib/pdfExport");
      const exportPayload = createExportPayload(currentApi);
      const blob = await createA4PdfBlob(exportPayload, pageSettingsRef.current);
      const savedExport = await saveBlobExport(
        suggestedFilename(
          `${makeSceneTitle(exportPayload.appState.name)}-${formatExportTimestamp(
            new Date(),
          )}`,
          ".pdf",
        ),
        blob,
      );

      showToast(
        savedExport.downloaded
          ? `Downloaded ${savedExport.filename}`
          : `Saved to ${savedExport.path}`,
      );
    } catch {
      showToast("Could not export PDF");
    }
  }, [showToast]);

  const exportSelectedFormats = useCallback(
    async (formats: readonly ExportFormat[]) => {
      const currentApi = apiRef.current;
      if (!currentApi || formats.length === 0) {
        return;
      }

      setExportCenterBusy(true);
      try {
        const exportPayload = createExportPayload(currentApi);
        const title = makeSceneTitle(exportPayload.appState.name);
        const timestamp = formatExportTimestamp(new Date());
        let exportedCount = 0;
        let failedCount = 0;

        for (const format of formats) {
          try {
            if (format === "excalidraw") {
              await saveTextExport(
                suggestedFilename(`${title}-${timestamp}`, ".excalidraw"),
                serializeScene(createScenePayload(currentApi), pageSettingsRef.current),
                MIME_TYPES.excalidraw,
                { forceExports: true },
              );
              exportedCount += 1;
              continue;
            }

            if (format === "png") {
              const { exportToBlob } = await import("@excalidraw/excalidraw");
              const blob = await exportToBlob({
                elements: exportPayload.elements,
                appState: exportPayload.appState,
                files: exportPayload.files,
                mimeType: MIME_TYPES.png,
              });
              await saveBlobExport(
                suggestedFilename(`${title}-${timestamp}`, ".png"),
                blob,
              );
              exportedCount += 1;
              continue;
            }

            if (format === "svg") {
              const { exportToSvg } = await import("@excalidraw/excalidraw");
              const svgElement = await exportToSvg({
                elements: exportPayload.elements,
                appState: exportPayload.appState,
                files: exportPayload.files,
              });
              await saveBlobExport(
                suggestedFilename(`${title}-${timestamp}`, ".svg"),
                new Blob([svgElement.outerHTML], { type: MIME_TYPES.svg }),
              );
              exportedCount += 1;
              continue;
            }

            if (format === "pdf") {
              const { createA4PdfBlob } = await import("./lib/pdfExport");
              const blob = await createA4PdfBlob(
                exportPayload,
                pageSettingsRef.current,
              );
              await saveBlobExport(
                suggestedFilename(`${title}-${timestamp}`, ".pdf"),
                blob,
              );
              exportedCount += 1;
            }
          } catch {
            failedCount += 1;
          }
        }

        if (exportedCount === 0) {
          showToast("Export Center failed");
          return;
        }

        showToast(
          `Exported ${exportedCount} file${exportedCount === 1 ? "" : "s"}${
            failedCount ? `, ${failedCount} failed` : ""
          }`,
        );
        setExportCenterOpen(false);
      } finally {
        setExportCenterBusy(false);
      }
    },
    [showToast],
  );

  const restoreLatestAutosave = useCallback(async () => {
    const latestRecent = recentsRef.current[0];
    if (!latestRecent) {
      showToast("No recovery snapshots yet");
      return;
    }

    try {
      const scene = await loadSceneFromPath(
        latestRecent.path,
        libraryItemsRef.current,
      );
      await applySceneData(scene, `Restored ${latestRecent.title}`);
    } catch {
      showToast("Latest recovery snapshot is unavailable");
    }
  }, [applySceneData, showToast]);

  const refreshCustomTemplates = useCallback(async () => {
    try {
      setCustomTemplates(await listCustomTemplates());
    } catch {
      showToast("Could not load custom templates");
    }
  }, [showToast]);

  const saveCurrentAsTemplate = useCallback(async () => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    const payload = createScenePayload(currentApi);
    const defaultName = makeSceneTitle(payload.appState.name);
    const requestedName =
      typeof window.prompt === "function"
        ? window.prompt("Template name:", defaultName)
        : defaultName;

    if (requestedName === null) {
      showToast("Template save canceled");
      return;
    }

    const name = requestedName.trim() || defaultName;
    const requestedDescription =
      typeof window.prompt === "function"
        ? window.prompt("Template description:", "Custom canvas template")
        : "Custom canvas template";

    if (requestedDescription === null) {
      showToast("Template save canceled");
      return;
    }

    try {
      await saveCustomTemplate({
        name,
        description: requestedDescription,
        serializedScene: serializeScene(payload, pageSettingsRef.current),
      });
      await refreshCustomTemplates();
      showToast(`Saved template ${name}`);
    } catch {
      showToast("Could not save template");
    }
  }, [refreshCustomTemplates, showToast]);

  const renameTemplate = useCallback(
    async (template: CustomCanvasTemplate) => {
      const requestedName = window.prompt("Rename template:", template.name);
      if (requestedName === null) {
        return;
      }

      try {
        await renameCustomTemplate(template, requestedName);
        await refreshCustomTemplates();
        showToast("Template renamed");
      } catch {
        showToast(`Could not rename ${template.name}`);
      }
    },
    [refreshCustomTemplates, showToast],
  );

  const deleteTemplate = useCallback(
    async (template: CustomCanvasTemplate) => {
      if (!window.confirm(`Delete ${template.name}?`)) {
        return;
      }

      try {
        await deleteCustomTemplate(template);
        await refreshCustomTemplates();
        showToast(`Deleted ${template.name}`);
      } catch {
        showToast(`Could not delete ${template.name}`);
      }
    },
    [refreshCustomTemplates, showToast],
  );

  const applyTemplate = useCallback(
    async (template: CanvasTemplate | CustomCanvasTemplate) => {
      try {
        await stageCurrentSceneForImport();
        currentSavedSceneRef.current = null;
        await applySceneData(
          {
            ...template.initialData,
            appState: {
              ...template.initialData.appState,
              name: template.name,
            },
          },
          `Created ${template.name}`,
        );
        setTemplatePickerOpen(false);
      } catch {
        showToast(`Could not apply ${template.name}`);
      }
    },
    [applySceneData, showToast, stageCurrentSceneForImport],
  );

  const updatePageSettings = useCallback(
    (nextPageSettings: PageSettings) => {
      setPageSettings(nextPageSettings);
      pageSettingsRef.current = nextPageSettings;
      if (isPageTemplateEnabled(nextPageSettings)) {
        const appState = apiRef.current?.getAppState();
        if (appState) {
          syncPageViewportFromAppState(appState);
        }
      } else if (pageViewportRef.current) {
        pageViewportRef.current = null;
        setPageViewport(null);
      }
      hasMeaningfulChangeRef.current = true;
      scheduleAutosave();
      showToast(
        `Page template: ${getPageTemplateOption(nextPageSettings.template).name}`,
      );
    },
    [scheduleAutosave, showToast, syncPageViewportFromAppState],
  );

  const renameCanvas = useCallback(
    async (savedScene: SavedSceneFile) => {
      const requestedName = window.prompt("Rename canvas:", savedScene.name);
      if (requestedName === null) {
        return;
      }

      try {
        const renamedScene = await renameSavedScene(savedScene, requestedName);
        if (
          currentSavedSceneRef.current?.path === savedScene.path &&
          currentSavedSceneRef.current.location === savedScene.location
        ) {
          currentSavedSceneRef.current = renamedScene;
        }
        showToast(`Renamed to ${renamedScene.name}`);
        await refreshSavedScenes();
      } catch (error) {
        const reason =
          error instanceof Error && error.message ? ` (${error.message})` : "";
        showToast(`Could not rename canvas${reason}`);
      }
    },
    [refreshSavedScenes, showToast],
  );

  const duplicateCanvas = useCallback(
    async (savedScene: SavedSceneFile) => {
      try {
        const duplicatedScene = await duplicateSavedScene(savedScene);
        showToast(`Duplicated ${duplicatedScene.name}`);
        await refreshSavedScenes();
      } catch {
        showToast(`Could not duplicate ${savedScene.name}`);
      }
    },
    [refreshSavedScenes, showToast],
  );

  const togglePinnedCanvas = useCallback(
    async (savedScene: SavedSceneFile) => {
      try {
        const pinned = await setSavedScenePinned(savedScene, !savedScene.pinned);
        setSavedCanvasFiles((currentFiles) =>
          currentFiles.map((currentFile) =>
            currentFile.path === savedScene.path &&
            currentFile.location === savedScene.location
              ? { ...currentFile, pinned }
              : currentFile,
          ),
        );
        showToast(
          pinned ? `Pinned ${savedScene.name}` : `Unpinned ${savedScene.name}`,
        );
      } catch {
        showToast(`Could not update ${savedScene.name}`);
      }
    },
    [showToast],
  );

  const deleteCanvas = useCallback(
    async (savedScene: SavedSceneFile) => {
      if (!window.confirm(`Delete ${savedScene.name}?`)) {
        return;
      }

      try {
        const deleteSummary = await deleteSavedScene(savedScene);
        if (
          currentSavedSceneRef.current?.path === savedScene.path &&
          currentSavedSceneRef.current.location === savedScene.location
        ) {
          currentSavedSceneRef.current = null;
        }
        setSavedCanvasFiles((currentFiles) =>
          currentFiles.filter((currentFile) => currentFile.name !== savedScene.name),
        );
        setActiveTimelineScene(null);
        setCanvasVersions([]);
        showToast(
          deleteSummary.deleted > 1
            ? `Deleted ${savedScene.name} (${deleteSummary.deleted} copies)`
            : `Deleted ${savedScene.name}`,
        );
        await refreshSavedScenes();
      } catch (error) {
        const reason =
          error instanceof Error && error.message ? ` (${error.message})` : "";
        showToast(`Could not delete ${savedScene.name}${reason}`);
      }
    },
    [refreshSavedScenes, showToast],
  );

  const openCanvasTimeline = useCallback(
    async (savedScene: SavedSceneFile) => {
      setActiveTimelineScene(savedScene);
      setCanvasVersions([]);
      setCanvasVersionsLoading(true);

      try {
        setCanvasVersions(await listCanvasVersions(savedScene));
      } catch {
        showToast(`Could not load timeline for ${savedScene.name}`);
      } finally {
        setCanvasVersionsLoading(false);
      }
    },
    [showToast],
  );

  const restoreCanvasFromTimeline = useCallback(
    async (savedScene: SavedSceneFile, version: CanvasVersionMeta) => {
      if (!window.confirm(`Restore ${savedScene.name} from this version?`)) {
        return;
      }

      try {
        const scene = await restoreCanvasVersion(
          savedScene,
          version.id,
          libraryItemsRef.current,
        );
        await applySceneData(scene, `Restored ${savedScene.name}`);
        currentSavedSceneRef.current = savedScene;
        await refreshSavedScenes();
        await openCanvasTimeline(savedScene);
      } catch {
        showToast(`Could not restore ${savedScene.name}`);
      }
    },
    [applySceneData, openCanvasTimeline, refreshSavedScenes, showToast],
  );

  const exportBackup = useCallback(async () => {
    setBackupBusy(true);
    try {
      const savedBackup = await createBackupZip();
      showToast(
        savedBackup.downloaded
          ? `Downloaded ${savedBackup.filename}`
          : `Saved to ${savedBackup.path}`,
      );
    } catch {
      showToast("Could not create backup");
    } finally {
      setBackupBusy(false);
    }
  }, [showToast]);

  const restoreBackup = useCallback(
    async (file: File) => {
      setBackupBusy(true);
      try {
        const summary = await restoreBackupZip(file);
        showToast(
          `Restored ${summary.restored} file${summary.restored === 1 ? "" : "s"}`,
        );
        await refreshSavedScenes();
      } catch (error) {
        const reason =
          error instanceof Error && error.message ? ` (${error.message})` : "";
        showToast(`Could not restore backup${reason}`);
      } finally {
        setBackupBusy(false);
      }
    },
    [refreshSavedScenes, showToast],
  );

  if (!bootstrapped || !initialData) {
    return (
      <div className="draw-loading-shell">
        <div className="draw-loading-card">
          <div className="draw-loading-mark" />
          <p className="draw-loading-kicker">Personal Android build</p>
          <h1>Escalidraw</h1>
          <p>
            Loading the official editor with offline assets, local autosave, and
            Android packaging.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="draw-app-shell">
      <input
        ref={fileInputRef}
        className="draw-hidden-input"
        type="file"
        accept=".excalidraw,.excalidrawlib,.json,application/json,image/*,*/*"
        multiple
        onChange={onLocalFileSelected}
      />

      {canvasDirectoryOpen ? (
        <CanvasManagerModal
          activeTimelineScene={activeTimelineScene}
          loading={canvasDirectoryLoading}
          savedScenes={savedCanvasFiles}
          versions={canvasVersions}
          versionsLoading={canvasVersionsLoading}
          onClose={() => {
            thumbnailHydrationRef.current += 1;
            setCanvasDirectoryOpen(false);
          }}
          onDelete={(savedScene) => {
            void deleteCanvas(savedScene);
          }}
          onDuplicate={(savedScene) => {
            void duplicateCanvas(savedScene);
          }}
          onOpen={(savedScene) => {
            void openSavedCanvas(savedScene);
          }}
          onRefresh={() => {
            void refreshSavedScenes();
          }}
          onRename={(savedScene) => {
            void renameCanvas(savedScene);
          }}
          onRestoreVersion={(savedScene, version) => {
            void restoreCanvasFromTimeline(savedScene, version);
          }}
          onTimeline={(savedScene) => {
            void openCanvasTimeline(savedScene);
          }}
          onTogglePinned={(savedScene) => {
            void togglePinnedCanvas(savedScene);
          }}
        />
      ) : null}

      {templatePickerOpen ? (
        <TemplatePickerModal
          customTemplates={customTemplates}
          templates={CANVAS_TEMPLATES}
          onClose={() => setTemplatePickerOpen(false)}
          onDeleteCustom={(template) => {
            void deleteTemplate(template);
          }}
          onRenameCustom={(template) => {
            void renameTemplate(template);
          }}
          onSelect={(template) => {
            void applyTemplate(template);
          }}
        />
      ) : null}

      {pageSettingsOpen ? (
        <PageSettingsModal
          pageSettings={pageSettings}
          onClose={() => setPageSettingsOpen(false)}
          onChange={updatePageSettings}
        />
      ) : null}

      {backupCenterOpen ? (
        <BackupCenterModal
          busy={backupBusy}
          onClose={() => setBackupCenterOpen(false)}
          onExport={() => {
            void exportBackup();
          }}
          onRestore={(file) => {
            void restoreBackup(file);
          }}
        />
      ) : null}

      {importAssistantPlan ? (
        <ImportAssistantModal
          busy={importAssistantBusy}
          plan={importAssistantPlan}
          onClose={() => {
            if (!importAssistantBusy) {
              setImportAssistantPlan(null);
            }
          }}
          onConfirm={() => {
            const plan = importAssistantPlan;
            setImportAssistantBusy(true);
            void executeImportPlan(plan)
              .then(() => {
                setImportAssistantPlan(null);
              })
              .catch(() => {
                showToast("Could not import selected files");
              })
              .finally(() => {
                setImportAssistantBusy(false);
              });
          }}
        />
      ) : null}

      {exportCenterOpen ? (
        <ExportCenterModal
          busy={exportCenterBusy}
          onClose={() => {
            if (!exportCenterBusy) {
              setExportCenterOpen(false);
            }
          }}
          onExport={(formats) => {
            void exportSelectedFormats(formats);
          }}
        />
      ) : null}

      <PageTemplateOverlay pageSettings={pageSettings} viewport={pageViewport} />
      <StylusHoverOverlay stylus={nativeStylus} enabled={settings.showPenHoverRing} />

      <Excalidraw
        initialData={initialData}
        onExcalidrawAPI={setApi}
        onChange={handleChange}
        onLibraryChange={handleLibraryChange}
        autoFocus
        handleKeyboardGlobally
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: false,
            export: false,
            clearCanvas: true,
            changeViewBackgroundColor: true,
            toggleTheme: true,
          },
          tools: {
            image: true,
          },
        }}
      >
        <WelcomeScreen />
        <DrawMainMenu
          autosaveMessage={autosaveHealth.message}
          autosaveStatus={formatAutosaveStatus(autosaveHealth.status)}
          exportLibrary={exportLibrary}
          exportPdf={exportPdf}
          exportPng={exportPng}
          exportSvg={exportSvg}
          gridModeEnabled={gridModeEnabled}
          lastAutosavedAt={lastAutosavedAt}
          nativeStylus={nativeStylus}
          objectsSnapModeEnabled={objectsSnapModeEnabled}
          openBackupCenter={() => setBackupCenterOpen(true)}
          openCanvas={openCanvas}
          openExportCenter={() => setExportCenterOpen(true)}
          openFiles={openFiles}
          openDirectory={openDirectory}
          openPageSettings={() => setPageSettingsOpen(true)}
          openTemplates={() => setTemplatePickerOpen(true)}
          pageSettings={pageSettings}
          penDetected={penDetected}
          penMode={penMode}
          recentsCount={recents.length}
          restoreLatestAutosave={restoreLatestAutosave}
          saveCurrentAsTemplate={saveCurrentAsTemplate}
          saveSceneCopy={saveSceneCopy}
          settings={settings}
          shareSceneCopy={shareSceneCopy}
          theme={theme}
          toggleGridMode={toggleGridMode}
          toggleSnapMode={toggleSnapMode}
          toggleTheme={toggleTheme}
          toggleViewMode={toggleViewMode}
          toggleZenMode={toggleZenMode}
          updatePenMode={updatePenMode}
          updatePenHoverRingPreference={updatePenHoverRingPreference}
          updateStylusBridgePreference={updateStylusBridgePreference}
          viewModeEnabled={viewModeEnabled}
          zenModeEnabled={zenModeEnabled}
        />
      </Excalidraw>
    </div>
  );
}

export default App;
