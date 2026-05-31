# Excalibur Android Port

Excalibur is an Android-packaged port of the official Excalidraw editor. Built with React, TypeScript, Vite, and a thin Capacitor 5 app shell, it exposes custom native Android capabilities to the web drawing canvas via a dedicated Java bridge plugin, providing stylus-aware pressure and hover detection, offline asset sync, and file intent integrations.

## Key Features

* **Excalidraw Engine** - Full compatibility with the official drawing canvas, toolbar, library collections, and `.excalidraw` scene files.
* **Native Stylus Bridge** - A custom Java plugin that captures raw stylus inputs (tool type, pressure, tilt, button state, and hover event streams) and forwards them into the React drawing loop.
* **Offline-First Resilience** - Preloaded drawing bundle and custom asset compilation enabling full canvas offline support.
* **Android Integration** - System tray, file sharing intents, and custom `ACTION_VIEW` / `ACTION_SEND` handlers for opening `.excalidraw` and `.excalidrawlib` documents.

## License

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.
