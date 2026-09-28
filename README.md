# Gridgrid

## v0.3.0

- Windows NSIS installer: no Node.js installation is required to use Gridgrid
- Desktop and Start Menu shortcuts
- GitHub Releases updater using `electron-updater`
- Automatic update check after launch and every 6 hours
- Automatic background download with progress in the Gridgrid status bar
- One-click **Reiniciar e instalar** after an update finishes downloading
- Windows release workflow publishes `Gridgrid-Setup-<version>.exe` and `latest.yml`

### Install for normal use

Download the latest **Gridgrid Setup** from GitHub Releases and run the installer. The packaged Electron app contains the runtime it needs, so Node.js and a CMD window are **not required**.

After the first installation, future versions are detected and downloaded from GitHub Releases by Gridgrid itself.

### Development

Node.js is only required when working on Gridgrid's source code:

```bash
npm install
npm run dev
```

## v0.2.2

- Workspace creation no longer uses Chromium `prompt()`
- New in-app dialog for creating workspaces
- Same dialog is used to rename a workspace
- Opening workspace dialogs temporarily hides embedded game views so the dialog always stays visible
- Existing workspaces, accounts and login sessions are preserved


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
