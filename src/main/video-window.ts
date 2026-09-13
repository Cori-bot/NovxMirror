import { screen } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { runPS, runPSResult, toPowerShellSingleQuoted, escapePath } from './powershell';
import { gstHwndFile, gstAspectFile, getIcoPath } from './paths';
import {
  state,
  VIDEO_MARGIN,
  DEFAULT_VIDEO_ASPECT,
  MAX_PORTRAIT_RATIO,
  GST_SHOW_RETRY_DELAY,
  GST_SHOW_MAX_ATTEMPTS,
} from './state';
import type { Theme, VideoAspect, VideoBounds, VideoCrop } from './types';

export function getVideoCropConfigForResolution(_w: number, _h: number): VideoCrop {
  return { left: 6, right: 6, top: 2, bottom: 0 };
}

export function usesDarkNativeChrome(theme: Theme = state.currentTheme): boolean {
  return theme !== 'light';
}

export function sanitizeDeviceName(value: string): string {
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function canOpenExternalUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com';
  } catch {
    return false;
  }
}

export function readVideoAspect(pid: number): VideoAspect {
  try {
    const raw = readFileSync(gstAspectFile(pid), 'utf8');
    const parsed = JSON.parse(raw) as { width?: number; height?: number };
    const width = Number(parsed.width);
    const height = Number(parsed.height);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_VIDEO_ASPECT };
}

export function normalizeVideoAspect(aspect: VideoAspect | null | undefined): VideoAspect {
  const width = Number(aspect?.width) || DEFAULT_VIDEO_ASPECT.width;
  const height = Number(aspect?.height) || DEFAULT_VIDEO_ASPECT.height;
  const ratio = width / height;

  if (ratio > 0 && ratio < 1 && ratio > MAX_PORTRAIT_RATIO) {
    return { ...DEFAULT_VIDEO_ASPECT };
  }

  return { width, height };
}

export function getPreferredVideoAspect(): VideoAspect {
  if (state.streamAspect) return state.streamAspect;
  if (state.gstPid) {
    const detected = readVideoAspect(state.gstPid);
    if (detected.width > 0 && detected.height > 0) {
      return normalizeVideoAspect(detected);
    }
  }
  return { ...DEFAULT_VIDEO_ASPECT };
}

function hwndSnippet(pid: number): string {
  const hf = escapePath(gstHwndFile(pid));
  return `
$hf = '${hf}'
if (-not (Test-Path $hf)) { exit 0 }
$hw = [IntPtr][long](Get-Content $hf -Raw)
if ($hw -eq [IntPtr]::Zero) { exit 0 }`;
}

export function startGStreamerWatcher(pid: number, timeoutSecs = 3600): void {
  const hwndFile = escapePath(gstHwndFile(pid));
  const aspectFile = escapePath(gstAspectFile(pid));
  const smallIconFile = escapePath(getIcoPath('tray-icon.ico'));
  const largeIconFile = escapePath(getIcoPath('icon.ico'));
  const darkMode = usesDarkNativeChrome() ? 1 : 0;
  runPS(`
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class NovxW {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    public delegate IntPtr WndProcDelegate(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
    [DllImport("user32.dll")] public static extern IntPtr GetWindowLong(IntPtr h, int n);
    [DllImport("user32.dll")] public static extern IntPtr SetWindowLong(IntPtr h, int n, IntPtr v);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] public static extern IntPtr SetWindowLongPtr(IntPtr h, int n, IntPtr v);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr i, int x, int y, int cx, int cy, uint f);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool SetWindowText(IntPtr hWnd, string text);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", EntryPoint = "SetClassLongPtrW")] public static extern IntPtr SetClassLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr LoadImage(IntPtr hInst, string name, uint type, int cx, int cy, uint fuLoad);
    [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);
    [DllImport("user32.dll")] public static extern IntPtr SetCursor(IntPtr hCursor);
    [DllImport("user32.dll", EntryPoint = "SetClassLongPtrW")] public static extern IntPtr SetClassCursor(IntPtr hWnd, int nIndex, IntPtr val);
    [DllImport("user32.dll")] public static extern IntPtr CallWindowProc(IntPtr lpPrevWndFunc, IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct MONITORINFO {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }
    static Dictionary<long, IntPtr> OriginalWndProcByHwnd = new Dictionary<long, IntPtr>();
    static WndProcDelegate CornerOnlyWndProcInstance = CornerOnlyWndProc;
    public static double TargetRatio = 9.0 / 19.5;

    public static void EnsureCornerOnlyResize(IntPtr hWnd) {
        long key = hWnd.ToInt64();
        if (OriginalWndProcByHwnd.ContainsKey(key)) return;
        IntPtr procPtr = Marshal.GetFunctionPointerForDelegate(CornerOnlyWndProcInstance);
        IntPtr previous = SetWindowLongPtr(hWnd, -4, procPtr);
        if (previous != IntPtr.Zero) {
            OriginalWndProcByHwnd[key] = previous;
        }
    }

    static void ConstrainSizing(IntPtr hWnd, int edge, IntPtr rectPtr) {
        if (TargetRatio < 0.05) return;
        RECT proposed = (RECT)Marshal.PtrToStructure(rectPtr, typeof(RECT));
        RECT wr, cr;
        if (!GetWindowRect(hWnd, out wr) || !GetClientRect(hWnd, out cr)) return;
        int ncW = (wr.Right - wr.Left) - (cr.Right - cr.Left);
        int ncH = (wr.Bottom - wr.Top) - (cr.Bottom - cr.Top);
        int clientW = Math.Max(80, proposed.Right - proposed.Left - ncW);
        int clientH = Math.Max(80, proposed.Bottom - proposed.Top - ncH);
        int oldW = Math.Max(1, cr.Right - cr.Left);
        int oldH = Math.Max(1, cr.Bottom - cr.Top);
        if (Math.Abs(clientW - oldW) >= Math.Abs(clientH - oldH)) {
            clientH = Math.Max(80, (int)Math.Round(clientW / TargetRatio));
        } else {
            clientW = Math.Max(80, (int)Math.Round(clientH * TargetRatio));
        }
        int outerW = clientW + ncW;
        int outerH = clientH + ncH;
        if (edge == 1 || edge == 4 || edge == 7) proposed.Left = proposed.Right - outerW;
        else proposed.Right = proposed.Left + outerW;
        if (edge == 3 || edge == 4 || edge == 5) proposed.Top = proposed.Bottom - outerH;
        else proposed.Bottom = proposed.Top + outerH;
        Marshal.StructureToPtr(proposed, rectPtr, false);
    }

    public static void FitToWorkArea(IntPtr hWnd) {
        if (IsZoomed(hWnd)) ShowWindow(hWnd, 9);
        RECT wr, cr;
        if (!GetWindowRect(hWnd, out wr) || !GetClientRect(hWnd, out cr)) return;
        int ncW = (wr.Right - wr.Left) - (cr.Right - cr.Left);
        int ncH = (wr.Bottom - wr.Top) - (cr.Bottom - cr.Top);
        MONITORINFO mi = new MONITORINFO();
        mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        IntPtr mon = MonitorFromWindow(hWnd, 2);
        if (mon == IntPtr.Zero || !GetMonitorInfo(mon, ref mi)) return;
        RECT work = mi.rcWork;
        int margin = 8;
        int maxW = Math.Max(220, work.Right - work.Left - 2 * margin);
        int maxH = Math.Max(240, work.Bottom - work.Top - 2 * margin);
        int clientW, clientH;
        if (TargetRatio >= 1) {
            clientW = maxW;
            clientH = Math.Max(1, (int)Math.Round(clientW / TargetRatio));
            if (clientH > maxH) {
                clientH = maxH;
                clientW = Math.Max(1, (int)Math.Round(clientH * TargetRatio));
            }
        } else {
            clientH = maxH;
            clientW = Math.Max(1, (int)Math.Round(clientH * TargetRatio));
            if (clientW > maxW) {
                clientW = maxW;
                clientH = Math.Max(1, (int)Math.Round(clientW / TargetRatio));
            }
        }
        int outerW = clientW + ncW;
        int outerH = clientH + ncH;
        int x = work.Left + (work.Right - work.Left - outerW) / 2;
        int y = work.Top + (work.Bottom - work.Top - outerH) / 2;
        SetWindowPos(hWnd, IntPtr.Zero, x, y, outerW, outerH, 0x0044);
    }

    static RECT LastOuter;
    static int LastClientW;
    static int LastClientH;
    static bool HaveLast;
    static long LastHwndKey;

    public static void EnforceClientAspect(IntPtr hWnd) {
        if (TargetRatio < 0.05) return;
        if (IsZoomed(hWnd)) {
            FitToWorkArea(hWnd);
            HaveLast = false;
            return;
        }
        RECT wr, cr;
        if (!GetWindowRect(hWnd, out wr) || !GetClientRect(hWnd, out cr)) return;
        long key = hWnd.ToInt64();
        if (key != LastHwndKey) {
            HaveLast = false;
            LastHwndKey = key;
        }
        int ncW = (wr.Right - wr.Left) - (cr.Right - cr.Left);
        int ncH = (wr.Bottom - wr.Top) - (cr.Bottom - cr.Top);
        int clientW = Math.Max(1, cr.Right - cr.Left);
        int clientH = Math.Max(1, cr.Bottom - cr.Top);
        double current = (double)clientW / (double)clientH;
        double err = Math.Abs(current - TargetRatio) / TargetRatio;
        if (err <= 0.012) {
            LastOuter = wr;
            LastClientW = clientW;
            LastClientH = clientH;
            HaveLast = true;
            return;
        }
        bool driveWidth = true;
        if (HaveLast) {
            driveWidth = Math.Abs(clientW - LastClientW) >= Math.Abs(clientH - LastClientH);
        } else if (TargetRatio < 1) {
            driveWidth = false;
        }
        int newW, newH;
        if (driveWidth) {
            newW = Math.Max(80, clientW);
            newH = Math.Max(80, (int)Math.Round(newW / TargetRatio));
        } else {
            newH = Math.Max(80, clientH);
            newW = Math.Max(80, (int)Math.Round(newH * TargetRatio));
        }
        int outerW = newW + ncW;
        int outerH = newH + ncH;
        int x = wr.Left;
        int y = wr.Top;
        if (HaveLast) {
            int dL = Math.Abs(wr.Left - LastOuter.Left);
            int dR = Math.Abs(wr.Right - LastOuter.Right);
            int dT = Math.Abs(wr.Top - LastOuter.Top);
            int dB = Math.Abs(wr.Bottom - LastOuter.Bottom);
            if (dL > dR) x = wr.Right - outerW;
            if (dT > dB) y = wr.Bottom - outerH;
        }
        SetWindowPos(hWnd, IntPtr.Zero, x, y, outerW, outerH, 0x0044);
        LastOuter.Left = x;
        LastOuter.Top = y;
        LastOuter.Right = x + outerW;
        LastOuter.Bottom = y + outerH;
        LastClientW = newW;
        LastClientH = newH;
        HaveLast = true;
    }

    static IntPtr CornerOnlyWndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam) {
        long key = hWnd.ToInt64();
        IntPtr previous;
        if (!OriginalWndProcByHwnd.TryGetValue(key, out previous)) {
            return IntPtr.Zero;
        }
        if (msg == 0x0214) {
            ConstrainSizing(hWnd, wParam.ToInt32(), lParam);
            return new IntPtr(1);
        }
        if (msg == 0x0112) {
            int cmd = wParam.ToInt32() & 0xFFF0;
            if (cmd == 0xF030) {
                FitToWorkArea(hWnd);
                return IntPtr.Zero;
            }
        }
        if (msg == 0x00A3) {
            FitToWorkArea(hWnd);
            return IntPtr.Zero;
        }
        IntPtr result = CallWindowProc(previous, hWnd, msg, wParam, lParam);
        if (msg == 0x0084) {
            int hit = result.ToInt32();
            if (hit == 10 || hit == 11 || hit == 12 || hit == 15) {
                return new IntPtr(1);
            }
        }
        return result;
    }

    public static IntPtr FindWindowByPid(uint pid) {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate (IntPtr hWnd, IntPtr lParam) {
            uint windowPid;
            GetWindowThreadProcessId(hWnd, out windowPid);
            if (windowPid == pid && GetParent(hWnd) == IntPtr.Zero && IsWindow(hWnd)) {
                found = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@
$hf = '${hwndFile}'
$af = '${aspectFile}'
$smallIconFile = '${smallIconFile}'
$largeIconFile = '${largeIconFile}'
$deadline = (Get-Date).AddSeconds(${String(timeoutSecs)})
$lastHwnd = [IntPtr]::Zero
$smallIcon = [IntPtr]::Zero
$largeIcon = [IntPtr]::Zero
if (Test-Path $smallIconFile) {
    $t = [NovxW]::LoadImage([IntPtr]::Zero, $smallIconFile, 1, 16, 16, 0x00008010)
    if ($t -ne [IntPtr]::Zero) { $smallIcon = $t }
}
if (Test-Path $largeIconFile) {
    $t = [NovxW]::LoadImage([IntPtr]::Zero, $largeIconFile, 1, 48, 48, 0x00008010)
    if ($t -ne [IntPtr]::Zero) { $largeIcon = $t }
}
while ((Get-Date) -lt $deadline) {
    $p = Get-Process -Id ${String(pid)} -ErrorAction SilentlyContinue
    if (-not $p) {
        Remove-Item $hf -ErrorAction SilentlyContinue
        Remove-Item $af -ErrorAction SilentlyContinue
        break
    }
    $hw = [NovxW]::FindWindowByPid([uint32]${String(pid)})
    if ($hw -ne [IntPtr]::Zero -and $hw -ne $lastHwnd) {
        $dark = ${String(darkMode)}
        try { [NovxW]::DwmSetWindowAttribute($hw, 20, [ref]$dark, 4) | Out-Null } catch {}
        try { [NovxW]::DwmSetWindowAttribute($hw, 19, [ref]$dark, 4) | Out-Null } catch {}
        try { [NovxW]::EnsureCornerOnlyResize($hw) } catch {}
        [NovxW]::SetClassCursor($hw, -12, [IntPtr]::Zero) | Out-Null
        if ($smallIcon -ne [IntPtr]::Zero) {
            [NovxW]::SetClassLongPtr($hw, -34, $smallIcon) | Out-Null
            [NovxW]::SendMessage($hw, 0x0080, [IntPtr]0, $smallIcon) | Out-Null
            [NovxW]::SendMessage($hw, 0x0080, [IntPtr]2, $smallIcon) | Out-Null
        }
        if ($largeIcon -ne [IntPtr]::Zero) {
            [NovxW]::SetClassLongPtr($hw, -14, $largeIcon) | Out-Null
            [NovxW]::SendMessage($hw, 0x0080, [IntPtr]1, $largeIcon) | Out-Null
        }
        $hw.ToInt64() | Set-Content $hf
        $lastHwnd = $hw
    }
    if ($hw -ne [IntPtr]::Zero -and [NovxW]::IsWindow($hw)) {
        if (Test-Path $af) {
            try {
                $j = Get-Content $af -Raw | ConvertFrom-Json
                if ($j.width -gt 0 -and $j.height -gt 0) {
                    [NovxW]::TargetRatio = [double]$j.width / [double]$j.height
                }
            } catch {}
        }
        try { [NovxW]::EnforceClientAspect($hw) } catch {}
    }
    if ($hw -eq [IntPtr]::Zero -or ($lastHwnd -ne [IntPtr]::Zero -and -not [NovxW]::IsWindow($lastHwnd))) {
        Remove-Item $hf -ErrorAction SilentlyContinue
        Remove-Item $af -ErrorAction SilentlyContinue
        $lastHwnd = [IntPtr]::Zero
    }
    Start-Sleep -Milliseconds 16
}
`);
}

type ShowCallback = (err: Error | null, shown: boolean) => void;

function showGStreamer(
  pid: number,
  x: number,
  y: number,
  w: number,
  h: number,
  callback: ShowCallback,
): void {
  const hf = escapePath(gstHwndFile(pid));
  const smallIconFile = escapePath(getIcoPath('tray-icon.ico'));
  const largeIconFile = escapePath(getIcoPath('icon.ico'));
  const windowTitle = toPowerShellSingleQuoted(state.gstWindowTitle || 'NovX Mirror');
  const darkMode = usesDarkNativeChrome() ? 1 : 0;
  runPS(
    `
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class NovxS {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    public delegate IntPtr WndProcDelegate(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr i, int x, int y, int cx, int cy, uint f);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool SetWindowText(IntPtr hWnd, string text);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", EntryPoint = "SetClassLongPtrW")] public static extern IntPtr SetClassLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr LoadImage(IntPtr hInst, string name, uint type, int cx, int cy, uint fuLoad);
    [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static extern IntPtr GetWindowLong(IntPtr h, int n);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] public static extern IntPtr SetWindowLong(IntPtr h, int n, IntPtr v);
    [DllImport("user32.dll")] public static extern IntPtr CallWindowProc(IntPtr lpPrevWndFunc, IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    static Dictionary<long, IntPtr> OriginalWndProcByHwnd = new Dictionary<long, IntPtr>();
    static WndProcDelegate CornerOnlyWndProcInstance = CornerOnlyWndProc;

    public static void EnsureCornerOnlyResize(IntPtr hWnd) {
        long key = hWnd.ToInt64();
        if (OriginalWndProcByHwnd.ContainsKey(key)) return;
        IntPtr procPtr = Marshal.GetFunctionPointerForDelegate(CornerOnlyWndProcInstance);
        IntPtr previous = SetWindowLong(hWnd, -4, procPtr);
        if (previous != IntPtr.Zero) {
            OriginalWndProcByHwnd[key] = previous;
        }
    }

    static IntPtr CornerOnlyWndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam) {
        long key = hWnd.ToInt64();
        IntPtr previous;
        if (!OriginalWndProcByHwnd.TryGetValue(key, out previous)) {
            return IntPtr.Zero;
        }
        IntPtr result = CallWindowProc(previous, hWnd, msg, wParam, lParam);
        if (msg == 0x0084) {
            int hit = result.ToInt32();
            if (hit == 10 || hit == 11 || hit == 12 || hit == 15) {
                return new IntPtr(1);
            }
        }
        return result;
    }

    public static IntPtr FindWindowByPid(uint pid) {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate (IntPtr hWnd, IntPtr lParam) {
            uint windowPid;
            GetWindowThreadProcessId(hWnd, out windowPid);
            if (windowPid == pid && GetParent(hWnd) == IntPtr.Zero && IsWindow(hWnd)) {
                found = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@
$hf = '${hf}'
$smallIconFile = '${smallIconFile}'
$largeIconFile = '${largeIconFile}'
$windowTitle = ${windowTitle}
$deadline = (Get-Date).AddMilliseconds(2000)
$hw = [IntPtr]::Zero
while ((Get-Date) -lt $deadline) {
    if (Test-Path $hf) {
        $raw = (Get-Content $hf -Raw).Trim()
        if ($raw) {
            $hw = [IntPtr][long]$raw
        }
    }
    if ($hw -eq [IntPtr]::Zero -or -not [NovxS]::IsWindow($hw)) {
        $hw = [NovxS]::FindWindowByPid([uint32]${String(pid)})
        if ($hw -ne [IntPtr]::Zero) {
            $hw.ToInt64() | Set-Content $hf
        }
    }
    if ($hw -ne [IntPtr]::Zero -and [NovxS]::IsWindow($hw)) { break }
    $hw = [IntPtr]::Zero
    Start-Sleep -Milliseconds 50
}
if ($hw -eq [IntPtr]::Zero -or -not [NovxS]::IsWindow($hw)) { exit 2 }
[NovxS]::SetWindowText($hw, $windowTitle) | Out-Null
$dark = ${String(darkMode)}
try { [NovxS]::DwmSetWindowAttribute($hw, 20, [ref]$dark, 4) | Out-Null } catch {}
try { [NovxS]::DwmSetWindowAttribute($hw, 19, [ref]$dark, 4) | Out-Null } catch {}
if (Test-Path $smallIconFile) {
    $smallIcon = [NovxS]::LoadImage([IntPtr]::Zero, $smallIconFile, 1, 16, 16, 0x00008010)
    if ($smallIcon -ne [IntPtr]::Zero) {
        [NovxS]::SetClassLongPtr($hw, -34, $smallIcon) | Out-Null
        [NovxS]::SendMessage($hw, 0x0080, [IntPtr]0, $smallIcon) | Out-Null
        [NovxS]::SendMessage($hw, 0x0080, [IntPtr]2, $smallIcon) | Out-Null
    }
}
if (Test-Path $largeIconFile) {
    $largeIcon = [NovxS]::LoadImage([IntPtr]::Zero, $largeIconFile, 1, 48, 48, 0x00008010)
    if ($largeIcon -ne [IntPtr]::Zero) {
        [NovxS]::SetClassLongPtr($hw, -14, $largeIcon) | Out-Null
        [NovxS]::SendMessage($hw, 0x0080, [IntPtr]1, $largeIcon) | Out-Null
    }
}
[NovxS]::SetWindowPos($hw, [IntPtr]::Zero, ${String(x)}, ${String(y)}, ${String(w)}, ${String(h)}, 0x0040) | Out-Null
Start-Sleep -Milliseconds 30
[NovxS]::ShowWindow($hw, 5) | Out-Null
[NovxS]::SetWindowText($hw, $windowTitle) | Out-Null
if (Test-Path $smallIconFile) {
    $smallIcon2 = [NovxS]::LoadImage([IntPtr]::Zero, $smallIconFile, 1, 16, 16, 0x00008010)
    if ($smallIcon2 -ne [IntPtr]::Zero) {
        [NovxS]::SetClassLongPtr($hw, -34, $smallIcon2) | Out-Null
        [NovxS]::SendMessage($hw, 0x0080, [IntPtr]0, $smallIcon2) | Out-Null
        [NovxS]::SendMessage($hw, 0x0080, [IntPtr]2, $smallIcon2) | Out-Null
    }
}
if (Test-Path $largeIconFile) {
    $largeIcon2 = [NovxS]::LoadImage([IntPtr]::Zero, $largeIconFile, 1, 48, 48, 0x00008010)
    if ($largeIcon2 -ne [IntPtr]::Zero) {
        [NovxS]::SetClassLongPtr($hw, -14, $largeIcon2) | Out-Null
        [NovxS]::SendMessage($hw, 0x0080, [IntPtr]1, $largeIcon2) | Out-Null
    }
}
[NovxS]::SetWindowPos($hw, [IntPtr](-1), 0, 0, 0, 0, 0x0043) | Out-Null
[NovxS]::SetForegroundWindow($hw) | Out-Null
Start-Sleep -Milliseconds 40
[NovxS]::SetWindowPos($hw, [IntPtr](-2), 0, 0, 0, 0, 0x0043) | Out-Null
exit 0
`,
    (err) => callback(err, !err),
  );
}

export function applyNativeWindowTheme(pid: number | null): void {
  if (!pid) return;
  const darkMode = usesDarkNativeChrome() ? 1 : 0;
  runPS(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NovxTheme {
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
    [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
}
"@
${hwndSnippet(pid)}
if ($hw -eq [IntPtr]::Zero -or -not [NovxTheme]::IsWindow($hw)) { exit 0 }
$dark = ${String(darkMode)}
try { [NovxTheme]::DwmSetWindowAttribute($hw, 20, [ref]$dark, 4) | Out-Null } catch {}
try { [NovxTheme]::DwmSetWindowAttribute($hw, 19, [ref]$dark, 4) | Out-Null } catch {}
`);
}

type RectCallback = (rect: VideoBounds | null) => void;

export function getNativeContentRect(pid: number, callback: RectCallback): void {
  const hf = escapePath(gstHwndFile(pid));
  runPSResult(
    `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NovxClientRect {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
}
"@
$hf = '${hf}'
$hw = [IntPtr]::Zero
if (Test-Path $hf) {
    $raw = (Get-Content $hf -Raw).Trim()
    if ($raw) { $hw = [IntPtr][long]$raw }
}
if ($hw -eq [IntPtr]::Zero -or -not [NovxClientRect]::IsWindow($hw)) { exit 2 }
$rect = New-Object NovxClientRect+RECT
if (-not [NovxClientRect]::GetClientRect($hw, [ref]$rect)) { exit 3 }
$pt = New-Object NovxClientRect+POINT
$pt.X = 0
$pt.Y = 0
if (-not [NovxClientRect]::ClientToScreen($hw, [ref]$pt)) { exit 4 }
@{
  x = $pt.X
  y = $pt.Y
  width = $rect.Right - $rect.Left
  height = $rect.Bottom - $rect.Top
} | ConvertTo-Json -Compress
`,
    (err, stdout) => {
      if (err || !stdout?.trim()) {
        callback(null);
        return;
      }
      try {
        callback(JSON.parse(stdout.trim()) as VideoBounds);
      } catch {
        callback(null);
      }
    },
  );
}

type CaptureCallback = (err: Error | null, rect: VideoBounds | null) => void;

export function captureNativeWindowImage(
  pid: number,
  outputPath: string,
  callback: CaptureCallback,
): void {
  const out = escapePath(outputPath);
  getNativeContentRect(pid, (rect) => {
    if (!rect) {
      callback(new Error('Fenetre video introuvable'), null);
      return;
    }
    runPSResult(
      `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NovxCapture {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hDC, uint nFlags);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
}
"@
${hwndSnippet(pid)}
if (-not [NovxCapture]::IsWindow($hw)) { exit 2 }

$windowRect = New-Object NovxCapture+RECT
$clientRect = New-Object NovxCapture+RECT
if (-not [NovxCapture]::GetWindowRect($hw, [ref]$windowRect)) { exit 3 }
if (-not [NovxCapture]::GetClientRect($hw, [ref]$clientRect)) { exit 4 }
$clientPoint = New-Object NovxCapture+POINT
$clientPoint.X = 0
$clientPoint.Y = 0
if (-not [NovxCapture]::ClientToScreen($hw, [ref]$clientPoint)) { exit 5 }

$windowWidth = $windowRect.Right - $windowRect.Left
$windowHeight = $windowRect.Bottom - $windowRect.Top
if ($windowWidth -le 0 -or $windowHeight -le 0) { exit 6 }

$windowBmp = New-Object System.Drawing.Bitmap $windowWidth, $windowHeight
$windowGraphics = [System.Drawing.Graphics]::FromImage($windowBmp)
$windowHdc = $windowGraphics.GetHdc()
$printed = $false
try {
    $printed = [NovxCapture]::PrintWindow($hw, $windowHdc, 2)
    if (-not $printed) {
        $printed = [NovxCapture]::PrintWindow($hw, $windowHdc, 0)
    }
} finally {
    $windowGraphics.ReleaseHdc($windowHdc)
    $windowGraphics.Dispose()
}

if (-not $printed) {
    $fallbackGraphics = [System.Drawing.Graphics]::FromImage($windowBmp)
    $fallbackGraphics.CopyFromScreen($windowRect.Left, $windowRect.Top, 0, 0, $windowBmp.Size)
    $fallbackGraphics.Dispose()
}

$clientX = [Math]::Max(0, $clientPoint.X - $windowRect.Left)
$clientY = [Math]::Max(0, $clientPoint.Y - $windowRect.Top)
$clientWidth = [Math]::Min(${String(rect.width)}, $windowWidth - $clientX)
$clientHeight = [Math]::Min(${String(rect.height)}, $windowHeight - $clientY)
if ($clientWidth -le 0 -or $clientHeight -le 0) {
    $windowBmp.Dispose()
    exit 7
}

$clientCropRect = New-Object System.Drawing.Rectangle($clientX, $clientY, $clientWidth, $clientHeight)
$clientBmp = $windowBmp.Clone($clientCropRect, $windowBmp.PixelFormat)
$windowBmp.Dispose()

function Test-NovxBlackLine {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [string]$Direction,
        [int]$Index,
        [int]$Threshold = 18
    )
    if ($Direction -eq 'left' -or $Direction -eq 'right') {
        for ($y = 0; $y -lt $Bitmap.Height; $y++) {
            $pixel = $Bitmap.GetPixel($Index, $y)
            if ($pixel.R -gt $Threshold -or $pixel.G -gt $Threshold -or $pixel.B -gt $Threshold) {
                return $false
            }
        }
        return $true
    }
    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
        $pixel = $Bitmap.GetPixel($x, $Index)
        if ($pixel.R -gt $Threshold -or $pixel.G -gt $Threshold -or $pixel.B -gt $Threshold) {
            return $false
        }
    }
    return $true
}

$trimLeft = 0
while ($trimLeft -lt ($clientBmp.Width - 1) -and (Test-NovxBlackLine -Bitmap $clientBmp -Direction 'left' -Index $trimLeft)) {
    $trimLeft++
}
$trimRight = 0
while ($trimRight -lt ($clientBmp.Width - $trimLeft - 1) -and (Test-NovxBlackLine -Bitmap $clientBmp -Direction 'right' -Index ($clientBmp.Width - 1 - $trimRight))) {
    $trimRight++
}
$trimTop = 0
while ($trimTop -lt ($clientBmp.Height - 1) -and (Test-NovxBlackLine -Bitmap $clientBmp -Direction 'top' -Index $trimTop)) {
    $trimTop++
}
$trimBottom = 0
while ($trimBottom -lt ($clientBmp.Height - $trimTop - 1) -and (Test-NovxBlackLine -Bitmap $clientBmp -Direction 'bottom' -Index ($clientBmp.Height - 1 - $trimBottom))) {
    $trimBottom++
}

$finalBmp = $clientBmp
if (($trimLeft + $trimRight) -gt 0 -or ($trimTop + $trimBottom) -gt 0) {
    $finalWidth = [Math]::Max(1, $clientBmp.Width - $trimLeft - $trimRight)
    $finalHeight = [Math]::Max(1, $clientBmp.Height - $trimTop - $trimBottom)
    $trimRect = New-Object System.Drawing.Rectangle($trimLeft, $trimTop, $finalWidth, $finalHeight)
    $finalBmp = $clientBmp.Clone($trimRect, $clientBmp.PixelFormat)
    $clientBmp.Dispose()
}

$finalBmp.Save('${out}', [System.Drawing.Imaging.ImageFormat]::Png)
$finalBmp.Dispose()
`,
      (err) => callback(err, rect),
    );
  });
}

function resetNativeWindow(
  pid: number,
  bounds: VideoBounds = getNativeVideoBounds('center'),
): void {
  if (!pid) return;
  const target = bounds;
  const hf = escapePath(gstHwndFile(pid));
  runPS(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NovxReset {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr i, int x, int y, int cx, int cy, uint f);
}
"@
$hf = '${hf}'
if (-not (Test-Path $hf)) { exit 0 }
$raw = (Get-Content $hf -Raw).Trim()
if (-not $raw) { exit 0 }
$hw = [IntPtr][long]$raw
if ($hw -eq [IntPtr]::Zero -or -not [NovxReset]::IsWindow($hw)) { exit 0 }
[NovxReset]::ShowWindow($hw, 9) | Out-Null
Start-Sleep -Milliseconds 60
[NovxReset]::SetWindowPos($hw, [IntPtr]::Zero, ${String(target.x)}, ${String(target.y)}, ${String(target.width)}, ${String(target.height)}, 0x0040) | Out-Null
[NovxReset]::ShowWindow($hw, 5) | Out-Null
`);
}

export function getNativeVideoBounds(position: 'center' | 'right' = 'center'): VideoBounds {
  const referenceBounds =
    state.mainWindow && !state.mainWindow.isDestroyed()
      ? state.mainWindow.getBounds()
      : screen.getPrimaryDisplay().bounds;
  const display = screen.getDisplayMatching(referenceBounds);
  const workArea = display.workArea;
  const aspect = getPreferredVideoAspect();
  const ratio = Math.max(0.1, aspect.width / aspect.height);

  const maxWidth = Math.max(220, workArea.width - VIDEO_MARGIN * 2);
  const maxHeight = Math.max(240, workArea.height - VIDEO_MARGIN * 2);
  let height = maxHeight;
  let width = Math.round(height * ratio);

  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / ratio);
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * ratio);
  }

  const x =
    position === 'center'
      ? workArea.x + Math.round((workArea.width - width) / 2)
      : workArea.x + workArea.width - VIDEO_MARGIN - width;
  const y = workArea.y + Math.max(VIDEO_MARGIN, Math.round((workArea.height - height) / 2));

  return {
    x: Math.max(workArea.x + VIDEO_MARGIN, x),
    y: Math.max(workArea.y + VIDEO_MARGIN, y),
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

export function syncVisibleGStreamer(
  pid: number,
  attempt = 0,
  boundsOverride: VideoBounds | null = null,
): void {
  if (!pid) return;
  const area = boundsOverride ?? getNativeVideoBounds();
  showGStreamer(pid, area.x, area.y, area.width, area.height, (_err, shown) => {
    if (pid !== state.gstPid) return;
    if (shown) return;
    if (attempt + 1 >= GST_SHOW_MAX_ATTEMPTS) return;
    setTimeout(() => syncVisibleGStreamer(pid, attempt + 1, boundsOverride), GST_SHOW_RETRY_DELAY);
  });
}

/**
 * Adapte la taille au nouvel aspect SANS changer de moniteur :
 * centre de la fenêtre conservé, clamp dans le workArea du moniteur courant.
 * Ignore les fenêtres maximisées Windows — le watcher les convertit en
 * plus grand cadre au ratio de la vidéo (pas de bandes noires).
 */
export function refitVideoWindowInPlace(pid: number): void {
  if (!pid) return;
  const aspect = getPreferredVideoAspect();
  const ratio = Math.max(0.1, aspect.width / aspect.height);
  const hf = escapePath(gstHwndFile(pid));

  runPS(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NovxRefit {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct MONITORINFO {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr i, int x, int y, int cx, int cy, uint f);
    [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);
}
"@
$hf = '${hf}'
if (-not (Test-Path $hf)) { exit 0 }
$raw = (Get-Content $hf -Raw).Trim()
if (-not $raw) { exit 0 }
$hw = [IntPtr][long]$raw
if ($hw -eq [IntPtr]::Zero -or -not [NovxRefit]::IsWindow($hw)) { exit 0 }
if ([NovxRefit]::IsZoomed($hw)) { exit 0 }

$wr = New-Object NovxRefit+RECT
$cr = New-Object NovxRefit+RECT
if (-not [NovxRefit]::GetWindowRect($hw, [ref]$wr)) { exit 0 }
if (-not [NovxRefit]::GetClientRect($hw, [ref]$cr)) { exit 0 }

$outerW = $wr.Right - $wr.Left
$outerH = $wr.Bottom - $wr.Top
$clientW = $cr.Right - $cr.Left
$clientH = $cr.Bottom - $cr.Top
if ($clientW -le 0 -or $clientH -le 0) { exit 0 }

$ncW = $outerW - $clientW
$ncH = $outerH - $clientH
$cx = [int](($wr.Left + $wr.Right) / 2)
$cy = [int](($wr.Top + $wr.Bottom) / 2)

$mi = New-Object NovxRefit+MONITORINFO
$mi.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($mi)
$mon = [NovxRefit]::MonitorFromWindow($hw, 2)
if ($mon -eq [IntPtr]::Zero -or -not [NovxRefit]::GetMonitorInfo($mon, [ref]$mi)) { exit 0 }
$work = $mi.rcWork
$margin = ${String(VIDEO_MARGIN)}
$maxW = [Math]::Max(220, ($work.Right - $work.Left) - (2 * $margin))
$maxH = [Math]::Max(240, ($work.Bottom - $work.Top) - (2 * $margin))
$ratio = ${String(ratio)}

# Conserve l'aire approximative (via la plus grande dimension actuelle),
# puis clamp dans le moniteur — évite le recenter sur l'écran de l'UI.
$base = [Math]::Max($clientW, $clientH)
if ($ratio -ge 1) {
    $tw = [Math]::Min($maxW, $base)
    $th = [Math]::Max(1, [int][Math]::Round($tw / $ratio))
    if ($th -gt $maxH) {
        $th = $maxH
        $tw = [Math]::Max(1, [int][Math]::Round($th * $ratio))
    }
} else {
    $th = [Math]::Min($maxH, $base)
    $tw = [Math]::Max(1, [int][Math]::Round($th * $ratio))
    if ($tw -gt $maxW) {
        $tw = $maxW
        $th = [Math]::Max(1, [int][Math]::Round($tw / $ratio))
    }
}
$newOuterW = [Math]::Max(120, $tw + $ncW)
$newOuterH = [Math]::Max(120, $th + $ncH)
$nx = $cx - [int]($newOuterW / 2)
$ny = $cy - [int]($newOuterH / 2)
$nx = [Math]::Max($work.Left + $margin, [Math]::Min($nx, $work.Right - $margin - $newOuterW))
$ny = [Math]::Max($work.Top + $margin, [Math]::Min($ny, $work.Bottom - $margin - $newOuterH))

# 0x0044 = SWP_NOZORDER | SWP_NOACTIVATE
[NovxRefit]::SetWindowPos($hw, [IntPtr]::Zero, $nx, $ny, $newOuterW, $newOuterH, 0x0044) | Out-Null
`);
}

export function toggleVideoPinned(): void {
  if (!state.gstPid) return;
  state.videoIsPinned = !state.videoIsPinned;
  const hf = escapePath(gstHwndFile(state.gstPid));
  const zOrder = state.videoIsPinned ? -1 : -2;
  runPS(`
Add-Type @"
using System; using System.Runtime.InteropServices;
public class NovxPin {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr i, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
}
"@
$hf = '${hf}'
if (Test-Path $hf) {
  $raw = (Get-Content $hf -Raw).Trim()
  if ($raw) {
    $hw = [IntPtr][long]$raw
    if ($hw -ne [IntPtr]::Zero -and [NovxPin]::IsWindow($hw)) {
      [NovxPin]::SetWindowPos($hw, [IntPtr](${String(zOrder)}), 0, 0, 0, 0, 0x0043) | Out-Null
    }
  }
}
`);
}

export function takeScreenshot(targetDir: string): void {
  if (!state.gstPid) {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('app-error', {
        message: 'Aucun stream actif — connecte un iPhone avant de capturer.',
      });
    }
    return;
  }
  try {
    mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('app-error', {
        message: `Dossier de capture inaccessible: ${message}`,
      });
    }
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = `${targetDir.replace(/\\$/, '')}\\NovX-${stamp}.png`;
  captureNativeWindowImage(state.gstPid, target, (err) => {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) return;
    if (err) {
      state.mainWindow.webContents.send('app-error', {
        message: `Capture impossible: ${err.message}`,
      });
      return;
    }
    state.mainWindow.webContents.send('app-success', { type: 'screenshot-saved' });
  });
}

export function resetVideoWindow(): void {
  if (!state.gstPid) return;
  const centeredBounds = getNativeVideoBounds('center');
  resetNativeWindow(state.gstPid, centeredBounds);
  setTimeout(() => {
    if (state.gstPid) syncVisibleGStreamer(state.gstPid, 0, centeredBounds);
  }, 120);
}

export function createVideoChrome(deviceName: string, pid: number): void {
  state.gstPid = pid;
  state.currentDeviceName = sanitizeDeviceName(deviceName);
  state.gstWindowTitle = state.currentDeviceName
    ? `NovX Mirror - ${state.currentDeviceName}`
    : 'NovX Mirror';
  [120, 500, 1100, 2200, 3600].forEach((delay) => {
    setTimeout(() => {
      if (pid !== state.gstPid) return;
      syncVisibleGStreamer(pid);
    }, delay);
  });
}

export function persistVideoAspect(pid: number, aspect: VideoAspect): void {
  try {
    writeFileSync(
      gstAspectFile(pid),
      JSON.stringify({ width: aspect.width, height: aspect.height }),
    );
  } catch {
    // ignore
  }
}
