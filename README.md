# NOVX Mirror

<div align="center">
  <img src="assets/novx-logo-512.png" alt="NOVX Mirror" width="120" />
  
  **AirPlay Receiver for Windows**
  
  Mirror your iPhone or iPad screen on Windows with a powerful, native desktop experience.
  
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![Windows](https://img.shields.io/badge/platform-Windows-brightgreen.svg)](https://github.com/Cori-bot/NovxMirror/releases)
  [![GitHub release](https://img.shields.io/github/v/release/Corridor/NovxMirror)](https://github.com/Cori-bot/NovxMirror/releases)
</div>

---

## ✨ Features

- 📱 **Full AirPlay Support** — Receive screen mirroring from iPhone and iPad devices
- 🎨 **Custom UI** — Beautiful Electron interface with light, dark, and midnight themes
- 🌍 **Multi-Language** — English, French, and German localization
- ⚙️ **Fine-Tuned Settings** — Configure receiver name, FPS, resolution, audio, and PIN protection
- 🎥 **Native Video Window** — Dedicated external window with screenshot and reset controls
- 📊 **Smart Logging** — Built-in log viewer with filtering for UxPlay and GStreamer noise
- 💾 **Local Storage** — All settings persist locally on your machine

---

## 🚀 Quick Start

### Prerequisites

Before getting started, make sure you have:
- **Windows 10 or later**
- **Apple Bonjour** installed and running ([Download](https://support.apple.com/kb/DL999))
- **UxPlay and GStreamer** bundled in `bin/` (included in the repo)

### Installation & Development

```bash
# Clone and install dependencies
git clone https://github.com/Cori-bot/NovxMirror.git
cd NovxMirror
pnpm install

# Start development server (hot reload enabled)
pnpm dev
```

For real device testing, ensure your Windows firewall allows `uxplay.exe`:
- Bonjour service is running
- `bin/uxplay.exe` and GStreamer plugins are present
- Your device and Windows machine are on the same network

If you're just testing the UI flow, the development build is sufficient.

---

## 🔧 How It Works

The AirPlay mirroring process involves several coordinated components:

```
┌─────────────────────────────────────────────────────────────┐
│                        iPhone / iPad                        │
│                  (wants to mirror screen)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                    1. Bonjour Service Discovery
                         │ (mDNS broadcast)
                         ↓
┌────────────────────────────────────────────────────────────┐
│              NOVX Mirror (Windows Application)             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Electron Main Process (Node.js backend)             │   │
│  │                                                     │   │
│  │ • Bonjour Manager — Listens for device discovery    │   │
│  │ • UxPlay Manager — Spawns & manages UxPlay.exe      │   │
│  │ • IPC Bridge — Communication with React UI          │   │
│  │ • Settings Manager — Persists config & state        │   │
│  │ • Win32 API — Controls native video window          │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                  │
│         ┌───────────────┼───────────────┐                  │
│         ↓               ↓               ↓                  │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│   │  UxPlay.exe  │ │  GStreamer   │ │ PowerShell   │       │
│   │              │ │  (decoding)  │ │ (video win)  │       │
│   │ (AirPlay     │ │              │ │              │       │
│   │  receiver)   │ │ • VP9/H.264  │ │ • WinForms   │       │
│   │              │ │ • AAC audio  │ │ • Win32 API  │       │
│   └──────────────┘ └──────────────┘ └──────────────┘       │
│         │               │                  │               │
│         └───────────────┼──────────────────┘               │
│                         │  (decoded video + audio stream)  │
│                         ↓                                  │
│   ┌────────────────────────────────────────────────────┐   │
│   │ React Renderer (UI)                                │   │
│   │ • Home page — Live preview & stats                 │   │
│   │ • Settings — Receiver config                       │   │
│   │ • Logs — Filter and debug output                   │   │
│   │ • System tray integration                          │   │
│   └────────────────────────────────────────────────────┘   │
│                         │                                  │
└────────────────────────────────────────────────────────────┘
                          │
                          ↓
               ┌──────────────────────┐
               │   Display (Monitor)  │
               │   + System Tray      │
               └──────────────────────┘
```

### Technical Flow

1. **Discovery** — Bonjour broadcasts the Windows machine as an AirPlay receiver
2. **Connection** — iPhone detects and connects to NOVX Mirror
3. **Streaming** — UxPlay.exe acts as the AirPlay receiver, handling the protocol
4. **Decoding** — GStreamer decodes VP9/H.264 video and AAC audio
5. **Rendering** — Electron/React displays the stream in a native window with controls
6. **Recording** — Optional screenshot capture and frame rate monitoring

---

## 📦 Build & Distribution

### Development Commands

```bash
pnpm dev          # Start with hot reload
pnpm build        # Build Windows installer + portable .exe
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript type checking
pnpm check        # Run both lint and typecheck
pnpm format       # Format code with Prettier
```

### Output

Running `pnpm build` generates:
- **`dist/NOVX Mirror Setup.exe`** — Windows installer
- **`dist/NOVX Mirror.exe`** — Portable standalone executable

Both are 64-bit and include all dependencies (UxPlay, GStreamer, etc.).

---

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Electron + Node.js | App lifecycle, IPC, file I/O, OS integration |
| **Frontend** | React 18 + TypeScript | UI components and state management |
| **Styling** | Tailwind CSS v3 | Responsive design and theming |
| **State** | Zustand | Lightweight global state management |
| **Build Tool** | electron-vite | Fast development and production builds |
| **Quality** | ESLint, Prettier, Husky | Code consistency and pre-commit checks |
| **Streaming** | UxPlay + GStreamer | AirPlay reception and media decoding |

### Directory Structure

```
novx-mirror/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry & lifecycle
│   │   ├── windows.ts           # Electron window management
│   │   ├── ipc.ts               # Main ↔ Renderer communication
│   │   ├── settings.ts          # Persistent configuration
│   │   ├── state.ts             # Runtime state
│   │   ├── bonjour.ts           # mDNS service discovery
│   │   ├── logger.ts            # Structured logging
│   │   ├── uxplay-manager.ts    # UxPlay.exe control
│   │   ├── video-window.ts      # Native video window
│   │   └── powershell.ts        # Win32 integration
│   │
│   ├── renderer/                # React frontend
│   │   ├── src/
│   │   │   ├── pages/           # HomePage, SettingsPage
│   │   │   ├── components/      # Reusable UI components
│   │   │   ├── store/           # Zustand state stores
│   │   │   ├── i18n/            # Translations (en, fr, de)
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   ├── lib/             # Utilities
│   │   │   └── styles/          # Global CSS + Tailwind
│   │   └── freeze-overlay/      # Screen capture overlay
│   │
│   └── preload/                 # Context bridge (type-safe IPC)
│
├── bin/                         # Native binaries
│   ├── uxplay.exe               # AirPlay receiver executable
│   └── gstreamer/               # GStreamer plugins & DLLs
│
├── assets/                      # Images, icons, fonts
├── installer.nsh                # NSIS installer configuration
└── package.json
```

---

## 🔐 Security & Performance Notes

- **Windows-Only** — Optimized for and tested on Windows 10+
- **Local Storage** — All settings and logs are stored locally (no cloud sync)
- **Native Binaries** — UxPlay and GStreamer are included in `bin/` and run as native processes
- **Firewall Rules** — Users may need to allow `uxplay.exe` through Windows Firewall
- **PIN Protection** — Optional PIN for AirPlay connections (configured in settings)

---

## 🛠️ Development Workflow

### Pre-commit Checks

Husky automatically runs before each commit:
- **ESLint** — Fix code style issues
- **Prettier** — Format code
- **TypeScript** — Type checking

This ensures code quality before it's committed.

### Testing

For real device testing:
1. Ensure Bonjour is running: `Services → Apple Bonjour`
2. Check that your Windows machine and iOS device are on the same network
3. Open Control Center on iPhone/iPad → Screen Mirroring → Select "NOVX Mirror"

---

## 📄 License & Credits

**License:** MIT (see LICENSE file)

**Built with:**
- [UxPlay](https://github.com/FDH2/UxPlay) — Open-source AirPlay receiver
- [Electron](https://www.electronjs.org/) — Cross-platform desktop framework
- [GStreamer](https://gstreamer.freedesktop.org/) — Multimedia framework
- [React](https://react.dev/) — UI library
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS

---

<div align="center">
  
  Made with ❤️ for Windows users who want AirPlay on their desktop
  
  [Releases](https://github.com/Cori-bot/NovxMirror/releases) • [Issues](https://github.com/Cori-bot/NovxMirror/issues) • [GitHub](https://github.com/Cori-bot/NovxMirror)
  
</div>
