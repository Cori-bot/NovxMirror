import { runPSResult } from './powershell';
import { recWarn } from './recordingLog';

/** Inverse of the Windows per-app mixer slider (1 if unread / already at 100%). */
export function recordingGainFromSessionVolume(volume: number, muted: boolean): number {
  if (muted) return 1;
  if (!Number.isFinite(volume) || volume <= 0) return 1;
  if (volume >= 0.98) return 1;
  return Math.min(20, 1 / volume);
}

/** Windows per-app mixer volume (0–1) and mute for a process. */
export function readProcessSessionVolume(
  pid: number,
  timeoutMs = 1800,
): Promise<{ volume: number; muted: boolean }> {
  return new Promise((resolve) => {
    const fallback = { volume: 1, muted: false };
    const timer = setTimeout(() => {
      resolve(fallback);
    }, timeoutMs);
    runPSResult(
      `
Add-Type -TypeDefinition @"
using System;
using System.Globalization;
using System.Runtime.InteropServices;
public static class NovxSessVol {
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    void EnumAudioEndpoints(int a, int b, out IntPtr c);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IntPtr ppDevice);
  }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, int clsCtx, IntPtr p, out IntPtr pp);
  }
  [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionManager2 {
    int GetAudioSessionControl(IntPtr g, int f, out IntPtr s);
    int GetSimpleAudioVolume(IntPtr g, int f, out IntPtr v);
    int GetSessionEnumerator(out IntPtr pp);
  }
  [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionEnumerator {
    int GetCount(out int n);
    int GetSession(int i, out IntPtr s);
  }
  [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl2 {
    void GetState(out int s);
    void GetDisplayName(out IntPtr n);
    void SetDisplayName(IntPtr n, Guid e);
    void GetIconPath(out IntPtr p);
    void SetIconPath(IntPtr p, Guid e);
    void GetGroupingParam(out Guid g);
    void SetGroupingParam(Guid g, Guid e);
    void RegisterAudioSessionNotification(IntPtr c);
    void UnregisterAudioSessionNotification(IntPtr c);
    void GetSessionIdentifier(out IntPtr id);
    void GetSessionInstanceIdentifier(out IntPtr id);
    int GetProcessId(out uint pid);
  }
  [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface ISimpleAudioVolume {
    int SetMasterVolume(float v, Guid e);
    int GetMasterVolume(out float v);
    int SetMute(bool m, Guid e);
    int GetMute(out bool m);
  }
  public static string Read(uint pid) {
    var t = Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"));
    var enm = (IMMDeviceEnumerator)Activator.CreateInstance(t);
    IntPtr devp;
    enm.GetDefaultAudioEndpoint(0, 1, out devp);
    var dev = (IMMDevice)Marshal.GetObjectForIUnknown(devp);
    var mgrIid = typeof(IAudioSessionManager2).GUID;
    IntPtr mgrp;
    dev.Activate(ref mgrIid, 23, IntPtr.Zero, out mgrp);
    var mgr = (IAudioSessionManager2)Marshal.GetObjectForIUnknown(mgrp);
    IntPtr enp;
    mgr.GetSessionEnumerator(out enp);
    var list = (IAudioSessionEnumerator)Marshal.GetObjectForIUnknown(enp);
    int n;
    list.GetCount(out n);
    for (int i = 0; i < n; i++) {
      IntPtr sp;
      list.GetSession(i, out sp);
      var ctl = (IAudioSessionControl2)Marshal.GetObjectForIUnknown(sp);
      uint p;
      ctl.GetProcessId(out p);
      if (p != pid) continue;
      var vol = (ISimpleAudioVolume)ctl;
      float v;
      vol.GetMasterVolume(out v);
      bool mute;
      vol.GetMute(out mute);
      return (mute ? "1" : "0") + " " + v.ToString(CultureInfo.InvariantCulture);
    }
    return "0 1";
  }
}
"@
try { [NovxSessVol]::Read(${String(pid)}) } catch { "0 1" }
`,
      (err, stdout) => {
        clearTimeout(timer);
        if (err) {
          recWarn(`session volume: ${err.message}`);
          resolve(fallback);
          return;
        }
        const parts = String(stdout).trim().split(/\s+/);
        const muted = parts[0] === '1';
        const volume = Number.parseFloat(parts[1] ?? '1');
        if (!Number.isFinite(volume) || volume < 0) {
          resolve(fallback);
          return;
        }
        resolve({ volume: Math.min(1, volume), muted });
      },
    );
  });
}
