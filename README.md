# Gridgrid

Gridgrid is a free, open-source desktop multi-session browser aimed at idle games and websites.

The first built-in preset is **Huntera**, but the core is generic: each panel runs as an isolated persistent Chromium session with its own cookies, cache and local storage.

## v0.2

- Account creation dialog with name, preset/site, URL and color
- Built-in Huntera preset plus custom-site sessions
- Drag-and-drop account ordering; the saved order is also used by the grid
- Workspace import/export using `.gridgrid.json`
- Exported workspaces intentionally exclude cookies and authentication data
- Window size/position and maximized state restore on reopen
- Google/OAuth popups work as real child windows instead of replacing the game panel
- Existing v0.1 sessions are migrated automatically
- Development command compiles Electron before launch

## Core features

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

## Workspace backups

Use **Exportar** in the top bar to save the active workspace and **Importar** to restore a workspace file.

Workspace backups contain layout and account configuration only. Login cookies, Google authentication sessions and other Chromium session storage are not exported.

## Roadmap

- More built-in game presets
- Reorder workspaces
- Optional free-form panel layout
- Keyboard shortcuts
- Better CPU/RAM metrics
- Optional updater through GitHub Releases
- Optional cleanup of Chromium session data when an account is deleted

Gridgrid is a session organizer, not an automation/bot engine. Users are responsible for complying with the rules of the sites they open.
