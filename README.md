# Excalibur Android Port

An Android port of Excalidraw so you can run it locally on your device, no browser or connection needed. React, TypeScript, Vite, and a thin Capacitor 5 shell. A custom Java bridge plugin feeds native stylus data (pressure, tilt, hover, button state) into the web drawing canvas, with offline asset sync and file intent handling for `.excalidraw` files.

## What is Excalidraw

Excalidraw ([excalidraw.com](https://excalidraw.com)) is a virtual whiteboard for sketching diagrams with a hand-drawn look: flowcharts, wireframes, mind maps, quick architecture sketches. This repo wraps that canvas as an Android app: same drawing tools, plus stylus pressure and tilt, offline use, and opening `.excalidraw` files straight from other apps.

## Key Features

* **Excalidraw Engine** - Full compatibility with the official drawing canvas, toolbar, library collections, and `.excalidraw` scene files.
* **Native Stylus Bridge** - A custom Java plugin that captures raw stylus inputs (tool type, pressure, tilt, button state, and hover event streams) and forwards them into the React drawing loop.
* **Offline-First Resilience** - Preloaded drawing bundle and custom asset compilation enabling full canvas offline support.
* **Android integration** - File sharing intents and `ACTION_VIEW` / `ACTION_SEND` handlers for opening `.excalidraw` and `.excalidrawlib` documents.

## Build

```bash
npm install
npm run android:build:debug
```

This builds the web bundle, syncs it into the Capacitor shell, and assembles the debug APK. Needs the Android SDK and Java (defaults assume Android Studio paths, override with `ANDROID_HOME` and `JAVA_HOME`).

## Note

The drawing engine under `vendor/` and the prebuilt bundle under `public/excalidraw-assets/` come from the upstream Excalidraw project, including its public demo backend config. No personal keys in here.

## License

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.
