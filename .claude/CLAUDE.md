# NOVX Mirror

Stack : Electron, React, TypeScript, Vite, electron-vite
Commands : `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`
Package manager : pnpm

## Structure
```
src/main/       — Electron main process
src/preload/    — preload scripts (IPC bridge)
src/renderer/   — React UI
```

## Conventions
- IPC via preload (jamais nodeIntegration direct)
- Build targets : main + preload + renderer séparément
- electron-builder pour packaging
