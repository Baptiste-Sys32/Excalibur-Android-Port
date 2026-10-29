import { registerPlugin } from "@capacitor/core";
import { Directory, Filesystem as CapacitorFilesystem } from "@capacitor/filesystem";
import { isAndroid } from "./capacitor";
import { parseWorkspacePath, workspaceRootPath } from "./workspacePaths";

export type WorkspaceInfo = { treeUri?: string; name: string; available: boolean; cancelled?: boolean };
interface WorkspaceBridge {
  getWorkspace(): Promise<WorkspaceInfo>;
  selectWorkspace(): Promise<WorkspaceInfo>;
  resetWorkspace(): Promise<WorkspaceInfo>;
  openDirectory(): Promise<{ opened: boolean }>;
  filesystem(options: { treeUri: string; path: string; operation: string; destination?: string; data?: string; encoding?: string }): Promise<Record<string, unknown>>;
}
const bridge = registerPlugin<WorkspaceBridge>("Workspace");
let current: WorkspaceInfo = { name: "Documents/Excalidraw", available: true };
export const currentWorkspace = () => current;
export const publicStorageRoot = () => workspaceRootPath(current.treeUri);
export const initializeWorkspace = async () => {
  if (isAndroid) current = await bridge.getWorkspace();
  return current;
};
export const chooseWorkspace = async () => {
  const result = await bridge.selectWorkspace();
  if (!result.cancelled) current = result;
  return result;
};
export const resetWorkspace = async () => (current = await bridge.resetWorkspace());
export const openWorkspaceDirectory = () => bridge.openDirectory();

export const writeWorkspaceFile = async (path: string, data: string) => {
  const address = parseWorkspacePath(path);
  if (!address) throw new Error("Not a workspace path");
  await bridge.filesystem({ ...address, operation: "write", data });
};
export const prepareWorkspaceShare = async (path: string, fallbackUri: string) => {
  const address = parseWorkspacePath(path);
  if (!address) return fallbackUri;
  const result = await bridge.filesystem({ ...address, operation: "prepareShare" });
  if (typeof result.uri !== "string") throw new Error("Cannot prepare workspace share");
  return result.uri;
};

// Public paths carry their tree identity. Old canvases remain rooted even if the
// active workspace changes. App-private Capacitor operations pass through intact.
export const Filesystem = new Proxy(CapacitorFilesystem, {
  get(target, property) {
    const original = Reflect.get(target, property);
    if (typeof original !== "function") return original;
    return (options: Record<string, unknown>) => {
      const path = options.path ?? options.from;
      const address = parseWorkspacePath(path);
      if (!address) return original.call(target, options);
      if (options.directory !== Directory.Documents) throw new Error("Workspace path used outside public storage");
      const destination = parseWorkspacePath(options.to);
      if ((property === "rename" || property === "copy") &&
          (!destination || destination.treeUri !== address.treeUri ||
           (options.toDirectory && options.toDirectory !== Directory.Documents))) {
        throw new Error("Cross-workspace moves are not supported");
      }
      return bridge.filesystem({ ...address, operation: String(property),
        destination: destination?.path,
        encoding: typeof options.encoding === "string" ? options.encoding : undefined });
    };
  },
});
