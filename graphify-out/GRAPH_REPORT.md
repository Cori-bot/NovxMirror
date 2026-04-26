# Graph Report - .  (2026-04-26)

## Corpus Check
- Corpus is ~23,531 words - fits in a single context window. You may not need a graph.

## Summary
- 213 nodes · 310 edges · 34 communities detected
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 74 edges (avg confidence: 0.81)
- Token cost: 2,800 input · 1,950 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Win32 Video Window Control|Win32 Video Window Control]]
- [[_COMMUNITY_Project Stack and Tech Docs|Project Stack and Tech Docs]]
- [[_COMMUNITY_UxPlay Manager and Logging|UxPlay Manager and Logging]]
- [[_COMMUNITY_Renderer UI and Pages|Renderer UI and Pages]]
- [[_COMMUNITY_IPC Event Orchestration|IPC Event Orchestration]]
- [[_COMMUNITY_Asset and Path Utilities|Asset and Path Utilities]]
- [[_COMMUNITY_ESLint Plugin Config|ESLint Plugin Config]]
- [[_COMMUNITY_Bonjour mDNS Discovery|Bonjour mDNS Discovery]]
- [[_COMMUNITY_Settings and Secrets|Settings and Secrets]]
- [[_COMMUNITY_NOVX Logo Assets|NOVX Logo Assets]]
- [[_COMMUNITY_Freeze Overlay Control|Freeze Overlay Control]]
- [[_COMMUNITY_Select Component|Select Component]]
- [[_COMMUNITY_Device Notifications|Device Notifications]]
- [[_COMMUNITY_Freeze Overlay Renderer|Freeze Overlay Renderer]]
- [[_COMMUNITY_App Footer|App Footer]]
- [[_COMMUNITY_Success Toast|Success Toast]]
- [[_COMMUNITY_Timer Hook|Timer Hook]]
- [[_COMMUNITY_Vite Build Config|Vite Build Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Main Entry|Main Entry]]
- [[_COMMUNITY_App State|App State]]
- [[_COMMUNITY_Main Types|Main Types]]
- [[_COMMUNITY_Freeze Preload|Freeze Preload]]
- [[_COMMUNITY_Preload Types|Preload Types]]
- [[_COMMUNITY_Renderer Entry|Renderer Entry]]
- [[_COMMUNITY_Freeze Entry|Freeze Entry]]
- [[_COMMUNITY_Renderer Types|Renderer Types]]
- [[_COMMUNITY_Section Component|Section Component]]
- [[_COMMUNITY_Stats Panel|Stats Panel]]
- [[_COMMUNITY_Theme Chips|Theme Chips]]
- [[_COMMUNITY_Top Navigation|Top Navigation]]
- [[_COMMUNITY_i18n Translations|i18n Translations]]
- [[_COMMUNITY_App Store|App Store]]
- [[_COMMUNITY_Settings Store|Settings Store]]

## God Nodes (most connected - your core abstractions)
1. `UxPlayManager` - 20 edges
2. `NOVX Mirror` - 17 edges
3. `ESLint Config (eslint.config.mjs)` - 12 edges
4. `escapePath()` - 9 edges
5. `NOVX Logo Design (organic blob, blue gradient)` - 9 edges
6. `gstHwndFile()` - 8 edges
7. `loadSettings()` - 8 edges
8. `startGStreamerWatcher()` - 8 edges
9. `showGStreamer()` - 8 edges
10. `useT()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `NOVX Mirror` --references--> `NOVX Logo Design (organic blob, blue gradient)`  [INFERRED]
  README.md → assets/novx-logo.svg
- `getBonjourMessage()` --calls--> `loadSettings()`  [INFERRED]
  src\main\bonjour.ts → src\main\settings.ts
- `ESLint Rule: no-floating-promises (error)` --conceptually_related_to--> `React 18 + TypeScript (Renderer)`  [INFERRED]
  eslint.config.mjs → README.md
- `ESLint (typescript-eslint, react-hooks)` --references--> `ESLint Config (eslint.config.mjs)`  [EXTRACTED]
  README.md → eslint.config.mjs
- `NOVX Logo SVG (assets/)` --semantically_similar_to--> `NOVX Logo SVG (renderer/src/assets/)`  [INFERRED] [semantically similar]
  assets/novx-logo.svg → src/renderer/src/assets/novx-logo.svg

## Hyperedges (group relationships)
- **Electron IPC Bridge (main / preload / renderer)** — readme_main_process, readme_preload, readme_renderer [INFERRED 0.88]
- **Code Quality Toolchain (ESLint + Prettier + Husky)** — readme_eslint, readme_prettier, readme_husky, readme_lint_staged [EXTRACTED 0.95]
- **NOVX Logo Asset Set (SVG source + PNG sizes)** — novx_logo_svg_assets, novx_logo_16, novx_logo_32, novx_logo_48, novx_logo_256, novx_logo_512, novx_logo_app [INFERRED 0.90]

## Communities

### Community 0 - "Win32 Video Window Control"
Cohesion: 0.14
Nodes (30): gstAspectFile(), gstBoundsFile(), gstHwndFile(), escapePath(), runPS(), runPSResult(), toPowerShellSingleQuoted(), applyNativeWindowTheme() (+22 more)

### Community 1 - "Project Stack and Tech Docs"
Cohesion: 0.11
Nodes (25): ESLint Rule: no-floating-promises (error), AirPlay Receiver, Apple Bonjour (mDNS Discovery), Electron, electron-vite, ESLint (typescript-eslint, react-hooks), FreezeOverlay React Component, GStreamer (+17 more)

### Community 2 - "UxPlay Manager and Logging"
Cohesion: 0.17
Nodes (3): shouldIgnoreExpectedShutdownLine(), shouldIgnoreLogLine(), UxPlayManager

### Community 3 - "Renderer UI and Pages"
Cohesion: 0.11
Nodes (10): App(), ErrorBanner(), HomePage(), Onboarding(), PageOverlay(), SettingsPage(), Titlebar(), getTranslations() (+2 more)

### Community 4 - "IPC Event Orchestration"
Cohesion: 0.14
Nodes (9): createFreezeOverlay(), subscribe(), bindUxPlayEvents(), onStartReceiverFromTray(), registerIpcHandlers(), startUxPlay(), getVideoCropConfigForResolution(), resolutionToDimensions() (+1 more)

### Community 5 - "Asset and Path Utilities"
Cohesion: 0.3
Nodes (8): getIcoPath(), getMainWindowIcon(), getTrayMenuIcon(), getTrayWindowIcon(), projectRoot(), createTray(), getTrayMessages(), updateTrayMenu()

### Community 6 - "ESLint Plugin Config"
Cohesion: 0.18
Nodes (11): ESLint Config (eslint.config.mjs), eslint-config-prettier, eslint-plugin-import, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-react-refresh, ESLint Rule: consistent-type-imports (error), tsconfig.node.json (+3 more)

### Community 7 - "Bonjour mDNS Discovery"
Cohesion: 0.22
Nodes (5): checkBonjourService(), getBonjourMessage(), installBonjour(), queryOne(), onInstall()

### Community 8 - "Settings and Secrets"
Cohesion: 0.53
Nodes (7): asString(), decryptSettingSecret(), encryptSettingSecret(), loadSettings(), normalizeReceiverName(), normalizeSettings(), saveSettings()

### Community 9 - "NOVX Logo Assets"
Cohesion: 0.25
Nodes (9): NOVX Logo 16px PNG, NOVX Logo 256px PNG, NOVX Logo 32px PNG, NOVX Logo 48px PNG, NOVX Logo 512px PNG, NOVX Logo App PNG (installer/tray size), NOVX Logo Design (organic blob, blue gradient), NOVX Logo SVG (assets/) (+1 more)

### Community 10 - "Freeze Overlay Control"
Cohesion: 0.52
Nodes (5): closeFreezeForReset(), closeFreezeOverlay(), setFreezeState(), stopNativeFollow(), toggleFreeze()

### Community 11 - "Select Component"
Cohesion: 0.4
Nodes (2): commit(), onListKey()

### Community 12 - "Device Notifications"
Cohesion: 0.8
Nodes (4): notifyDeviceConnected(), notifyDeviceDisconnected(), shouldNotify(), tr()

### Community 13 - "Freeze Overlay Renderer"
Cohesion: 0.5
Nodes (0): 

### Community 14 - "App Footer"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Success Toast"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Timer Hook"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Vite Build Config"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Tailwind Config"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Main Entry"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "App State"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Main Types"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Freeze Preload"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Preload Types"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Renderer Entry"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Freeze Entry"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Renderer Types"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Section Component"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Stats Panel"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Theme Chips"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Top Navigation"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "i18n Translations"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "App Store"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Settings Store"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **23 isolated node(s):** `Electron`, `electron-vite`, `Themes (light/dark/midnight)`, `FreezeOverlay React Component`, `uxplay-manager.ts` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App Footer`** (2 nodes): `AppFooter()`, `AppFooter.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Success Toast`** (2 nodes): `SuccessToast.tsx`, `SuccessToast()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Timer Hook`** (2 nodes): `useTimer.ts`, `useTimer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Build Config`** (1 nodes): `electron.vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Main Entry`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App State`** (1 nodes): `state.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Main Types`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Freeze Preload`** (1 nodes): `freeze.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Preload Types`** (1 nodes): `index.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Renderer Entry`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Freeze Entry`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Renderer Types`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Section Component`** (1 nodes): `Section.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Stats Panel`** (1 nodes): `StatsPanel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Chips`** (1 nodes): `ThemeChips.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Top Navigation`** (1 nodes): `TopNav.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `i18n Translations`** (1 nodes): `translations.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Store`** (1 nodes): `app.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Settings Store`** (1 nodes): `settings.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createMainWindow()` connect `IPC Event Orchestration` to `Settings and Secrets`, `Asset and Path Utilities`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `UxPlayManager` connect `UxPlay Manager and Logging` to `IPC Event Orchestration`, `Asset and Path Utilities`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `loadSettings()` connect `Settings and Secrets` to `IPC Event Orchestration`, `Bonjour mDNS Discovery`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `escapePath()` (e.g. with `hwndSnippet()` and `startGStreamerWatcher()`) actually correct?**
  _`escapePath()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `NOVX Logo Design (organic blob, blue gradient)` (e.g. with `NOVX Logo 16px PNG` and `NOVX Logo 32px PNG`) actually correct?**
  _`NOVX Logo Design (organic blob, blue gradient)` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Electron`, `electron-vite`, `Themes (light/dark/midnight)` to the rest of the system?**
  _23 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Win32 Video Window Control` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._