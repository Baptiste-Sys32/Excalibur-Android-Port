import ReactDOM from "react-dom/client";
import "@excalidraw/excalidraw/index.css";
import "./index.css";
import App from "./App";
import { isLocalNavigation } from "./lib/offline";

// Capture before React handlers can open an external browser. Local downloads
// and generated export blobs do not pass through external navigation.
document.addEventListener("click", (event) => {
  const anchor = event.target instanceof Element ? event.target.closest("a") : null;
  if (anchor && !anchor.hasAttribute("download") &&
      !isLocalNavigation(anchor.href, window.location.href)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

const baseAssetPath = import.meta.env.BASE_URL;
window.EXCALIDRAW_ASSET_PATH = [
  baseAssetPath,
  `${baseAssetPath}excalidraw-assets/`,
];

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
