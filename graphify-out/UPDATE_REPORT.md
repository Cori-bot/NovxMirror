# NOVX Mirror Knowledge Graph — Update Report

Generated: 2026-04-26 17:25:13

## Summary

- **Files Updated:** 3 new/changed
- **Total Nodes:** 26
- **Total Edges:** 0
- **Corpus Size:** ~25,823 words across 54 files

## Key Nodes (from updated README.md)

1. **NOVX Mirror** — Main project
2. **Bonjour Service Discovery** — mDNS device detection
3. **UxPlay.exe AirPlay Receiver** — Protocol handling
4. **GStreamer** — Video/audio decoding
5. **Electron Main Process** — OS integration

## Architecture Concepts

- **IPC Bridge** — Main <-> Renderer communication
- **UxPlay Manager** — Receiver lifecycle control
- **Settings Manager** — Config persistence
- **React Renderer** — UI layer
- **Win32 API** — Native window control

## Code Quality Stack

- ESLint, Prettier, Husky (pre-commit checks)

---

Next steps: Run `/graphify query "How does AirPlay stream get decoded?"` to trace the full pipeline through the graph.
