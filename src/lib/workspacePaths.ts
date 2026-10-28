const PREFIX = "saf:";
const AUTHORITY = "com.android.externalstorage.documents";

export const workspaceRootPath = (treeUri?: string) =>
  treeUri ? `${PREFIX}${encodeURIComponent(treeUri)}/Excalidraw` : "Excalidraw";

export const parseWorkspacePath = (value: unknown) => {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return null;
  const slash = value.indexOf("/");
  if (slash < 0) throw new Error("Invalid workspace path");
  const treeUri = decodeURIComponent(value.slice(PREFIX.length, slash));
  const uri = new URL(treeUri);
  if (uri.protocol !== "content:" || uri.hostname !== AUTHORITY || !uri.pathname.startsWith("/tree/")) {
    throw new Error("Only local Android document trees are supported");
  }
  const path = value.slice(slash + 1);
  const parts = path.split("/");
  if (parts[0] !== "Excalidraw" || parts.some(part =>
    !part || part === "." || part === ".." || part.includes("\\") ||
    part.startsWith(".excalibur-") || Array.from(part).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || part.length > 200)) {
    throw new Error("Invalid workspace path or filename (maximum 200 characters)");
  }
  return { treeUri, path };
};

export const displayWorkspacePath = (path: string) => {
  const address = parseWorkspacePath(path);
  return address ? `Local workspace/${address.path}` : path;
};
