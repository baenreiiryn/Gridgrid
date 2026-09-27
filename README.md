# Gridgrid

Gridgrid is a free, open-source desktop multi-session browser aimed at idle games and websites.

The first preset is **Huntera**, but the core is intentionally generic: each panel runs as an isolated persistent Chromium session with its own cookies, cache and local storage.

## v0.1 foundation

- Multiple independent accounts in one desktop window
- Persistent sessions using Electron `persist:` partitions
- Workspaces to group accounts
- Grid, columns, rows and focus layouts
- Per-account reload, mute and zoom
- Editable URL and account name
- Approximate RAM usage per renderer process
- Local JSON configuration; no Gridgrid account, cloud or license server
- Windows NSIS build configuration

## Stack

- Electron
- `WebContentsView` (not the deprecated `BrowserView`)
- TypeScript
- Vite

## Run from source

```bash
npm install
npm run dev
```

## Build

```bash
npm run dist:win
```

The Windows installer will be written to `release/`.

## Roadmap

- Preset manager for Huntera and other browser idle games
- Import/export workspaces
- Reorder accounts and workspaces
- Free-form drag layout
- Keyboard shortcuts
- Better CPU/RAM metrics
- Optional updater through GitHub Releases
- Session data cleanup when an account is deleted

Gridgrid is a session organizer, not an automation/bot engine. Users are responsible for complying with the rules of the sites they open.
