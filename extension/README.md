# EODB browser extension

The app as a browser extension: a sealed, signed, local database that runs in a background service worker, with content scripts that can read any page you're on.

## Install (load unpacked)

1. Build the package: `node extension/package.mjs` — this writes `extension/dist/eodb-extension.zip` containing the extension plus the engine it runs on.
2. Unzip it.
3. Chrome/Edge: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick the unzipped folder.
4. Firefox: `about:debugging` → **This Firefox** → **Load Temporary Add-on** → pick `manifest.json` from the unzipped folder.

## What's inside

- `background.js` — the service worker that boots `engine.mjs` (the same engine the web app and headless node run), backed by IndexedDB, always syncing.
- `content.js` — injected into every page; reads the page *only when asked* and hands its text/title/url back.
- `popup.html` / `sidepanel.html` — status + "read this page".
- The engine + its vendor/pharos deps are copied in at package time, so the extension is self-contained.

## Notes

- The extension stores everything locally and sealed, exactly like the web app. Nothing is sent anywhere automatically.
- Mounting the full app UI (files, tables, chat) in the side panel is the next step; the side panel currently reads the current page and shows node status.
