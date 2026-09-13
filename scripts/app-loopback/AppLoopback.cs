using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

/// <summary>
/// Windows Application Loopback (VAD\Process_Loopback) — same API as OBS
/// "Application Audio Capture". Isolates the UxPlay process tree (not the PC mix).
/// The Windows per-app mixer slider is applied before this tap; do not attach
/// ISimpleAudioVolume here (ReleaseComObject on that RCW killed capture).
/// </summary>
internal static class Program
{
    const string ProcessLoopbackDevice = "VAD\\Process_Loopback";
    const int AudioClientActivationTypeProcessLoopback = 1;
    const int ProcessLoopbackIncludeTree = 0;
    const int VtBlob = 65;
    const int ShareModeShared = 0;
    const int StreamLoopback = 0x00020000;
    const int StreamEventCallback = 0x00040000;
    const int StreamAutoConvertPcm = unchecked((int)0x80000000);
    const int BufferFlagSilent = 0x2;
    const ushort WaveFormatPcm = 1;
    const int SampleRate = 48000;
    const ushort Channels = 2;
    const ushort BitsPerSample = 16;

    static readonly Guid IidAudioClient = new Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2");
    static readonly Guid IidAudioCaptureClient = new Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317");

    [MTAThread]
    static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("usage: novx-applog <pid> <out.wav>");
            return 2;
        }
        uint pid;
        if (!uint.TryParse(args[0], out pid) || pid == 0)
        {
            Console.Error.WriteLine("invalid pid");
            return 2;
        }
        var outPath = args[1];

        CoInitializeEx(IntPtr.Zero, 2);

        var format = new WaveFormatEx
        {
            wFormatTag = WaveFormatPcm,
            nChannels = Channels,
            nSamplesPerSec = SampleRate,
            wBitsPerSample = BitsPerSample,
            nBlockAlign = (ushort)(Channels * BitsPerSample / 8),
            nAvgBytesPerSec = (uint)(SampleRate * Channels * BitsPerSample / 8),
            cbSize = 0,
        };

        var activation = new AudioClientActivationParams
        {
            ActivationType = AudioClientActivationTypeProcessLoopback,
            TargetProcessId = pid,
            ProcessLoopbackMode = ProcessLoopbackIncludeTree,
        };
        var blob = Marshal.AllocHGlobal(Marshal.SizeOf(activation));
        var propMem = Marshal.AllocHGlobal(24);
        var formatMem = Marshal.AllocHGlobal(Marshal.SizeOf(format));
        IActivateAudioInterfaceAsyncOperation asyncOp = null;
        IAudioClient client = null;
        IAudioCaptureClient capture = null;
        EventWaitHandle frameEvent = null;
        FileStream wav = null;
        try
        {
            Marshal.StructureToPtr(activation, blob, false);
            var prop = new PropVariantBlob
            {
                vt = VtBlob,
                blobSize = (uint)Marshal.SizeOf(activation),
                blobData = blob,
            };
            Marshal.StructureToPtr(prop, propMem, false);
            Marshal.StructureToPtr(format, formatMem, false);

            var handler = new ActivationHandler();
            var iid = IidAudioClient;
            var hr = ActivateAudioInterfaceAsync(
                ProcessLoopbackDevice,
                ref iid,
                propMem,
                handler,
                out asyncOp);
            if (hr != 0)
            {
                Console.Error.WriteLine("ActivateAudioInterfaceAsync failed 0x" + hr.ToString("X8"));
                return 1;
            }
            if (!handler.Done.Wait(8000))
            {
                Console.Error.WriteLine("activate timeout");
                return 1;
            }
            if (handler.ActivateHr != 0 || handler.Client == null)
            {
                Console.Error.WriteLine("activate result 0x" + handler.ActivateHr.ToString("X8"));
                return 1;
            }

            client = (IAudioClient)handler.Client;
            hr = client.Initialize(
                ShareModeShared,
                StreamLoopback | StreamEventCallback | StreamAutoConvertPcm,
                0,
                0,
                formatMem,
                IntPtr.Zero);
            if (hr != 0)
            {
                Console.Error.WriteLine("IAudioClient.Initialize failed 0x" + hr.ToString("X8"));
                return 1;
            }

            var captureIid = IidAudioCaptureClient;
            IntPtr capturePtr;
            hr = client.GetService(ref captureIid, out capturePtr);
            if (hr != 0 || capturePtr == IntPtr.Zero)
            {
                Console.Error.WriteLine("GetService IAudioCaptureClient failed 0x" + hr.ToString("X8"));
                return 1;
            }
            capture = (IAudioCaptureClient)Marshal.GetObjectForIUnknown(capturePtr);
            Marshal.Release(capturePtr);

            frameEvent = new EventWaitHandle(false, EventResetMode.AutoReset);
            hr = client.SetEventHandle(frameEvent.SafeWaitHandle.DangerousGetHandle());
            if (hr != 0)
            {
                Console.Error.WriteLine("SetEventHandle failed 0x" + hr.ToString("X8"));
                return 1;
            }

            wav = new FileStream(outPath, FileMode.Create, FileAccess.ReadWrite, FileShare.Read);
            WriteWavHeader(wav, format, 0);

            MixerGain mixer = new MixerGain(pid);
            hr = client.Start();
            if (hr != 0)
            {
                Console.Error.WriteLine("IAudioClient.Start failed 0x" + hr.ToString("X8"));
                return 1;
            }

            Console.Error.WriteLine("READY");
            Console.Error.Flush();

            var stop = new ManualResetEventSlim(false);
            var stdinThread = new Thread(() =>
            {
                try
                {
                    using (var input = Console.OpenStandardInput())
                    {
                        var buf = new byte[8];
                        while (input.Read(buf, 0, buf.Length) > 0) { }
                    }
                }
                catch
                {
                    // stdin closed
                }
                stop.Set();
            });
            stdinThread.IsBackground = true;
            stdinThread.Start();

            var waitHandles = new WaitHandle[] { frameEvent, stop.WaitHandle };
            long dataBytes = 0;
            var blockAlign = format.nBlockAlign;
            while (!stop.IsSet)
            {
                var which = WaitHandle.WaitAny(waitHandles, 200);
                if (which == 1) break;
                dataBytes += DrainPackets(capture, wav, blockAlign, mixer);
            }

            client.Stop();
            wav.Flush();
            wav.Seek(0, SeekOrigin.Begin);
            WriteWavHeader(wav, format, dataBytes);
            wav.Flush();
            Console.Error.WriteLine("DONE bytes=" + dataBytes);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.GetType().Name + ": " + ex.Message);
            return 1;
        }
        finally
        {
            if (wav != null) wav.Dispose();
            if (frameEvent != null) frameEvent.Dispose();
            if (capture != null) Marshal.ReleaseComObject(capture);
            if (client != null) Marshal.ReleaseComObject(client);
            if (asyncOp != null) Marshal.ReleaseComObject(asyncOp);
            Marshal.FreeHGlobal(formatMem);
            Marshal.FreeHGlobal(propMem);
            Marshal.FreeHGlobal(blob);
        }
    }

    static long DrainPackets(IAudioCaptureClient capture, Stream wav, ushort blockAlign, MixerGain mixer)
    {
        long written = 0;
        uint frames;
        float gain = 1f;
        try { gain = mixer.CurrentGain(); } catch { }
        while (capture.GetNextPacketSize(out frames) == 0 && frames > 0)
        {
            IntPtr data;
            uint got;
            uint flags;
            ulong devPos;
            ulong qpc;
            var hr = capture.GetBuffer(out data, out got, out flags, out devPos, out qpc);
            if (hr != 0) break;
            var bytes = (int)(got * blockAlign);
            if (bytes > 0)
            {
                var buffer = new byte[bytes];
                if ((flags & BufferFlagSilent) == 0 && data != IntPtr.Zero)
                {
                    Marshal.Copy(data, buffer, 0, bytes);
                    if (gain > 1.02f) ApplyInt16Gain(buffer, gain);
                }
                wav.Write(buffer, 0, bytes);
                written += bytes;
            }
            capture.ReleaseBuffer(got);
        }
        return written;
    }

    static void ApplyInt16Gain(byte[] buffer, float gain)
    {
        for (var i = 0; i + 1 < buffer.Length; i += 2)
        {
            var sample = (short)(buffer[i] | (buffer[i + 1] << 8));
            var scaled = (int)(sample * gain);
            if (scaled > short.MaxValue) scaled = short.MaxValue;
            if (scaled < short.MinValue) scaled = short.MinValue;
            buffer[i] = (byte)scaled;
            buffer[i + 1] = (byte)(scaled >> 8);
        }
    }

    static void WriteWavHeader(Stream stream, WaveFormatEx format, long dataBytes)
    {
        var header = 44;
        using (var writer = new BinaryWriter(stream, System.Text.Encoding.ASCII, true))
        {
            writer.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));
            writer.Write(unchecked((int)(Math.Min(int.MaxValue, header - 8 + dataBytes))));
            writer.Write(System.Text.Encoding.ASCII.GetBytes("WAVE"));
            writer.Write(System.Text.Encoding.ASCII.GetBytes("fmt "));
            writer.Write(16);
            writer.Write(format.wFormatTag);
            writer.Write(format.nChannels);
            writer.Write(format.nSamplesPerSec);
            writer.Write(format.nAvgBytesPerSec);
            writer.Write(format.nBlockAlign);
            writer.Write(format.wBitsPerSample);
            writer.Write(System.Text.Encoding.ASCII.GetBytes("data"));
            writer.Write(unchecked((int)Math.Min(int.MaxValue, dataBytes)));
        }
    }

    [DllImport("ole32.dll")]
    static extern int CoInitializeEx(IntPtr pvReserved, int dwCoInit);

    [DllImport("mmdevapi.dll", ExactSpelling = true, PreserveSig = true)]
    static extern int ActivateAudioInterfaceAsync(
        [MarshalAs(UnmanagedType.LPWStr)] string deviceInterfacePath,
        ref Guid riid,
        IntPtr activationParams,
        IActivateAudioInterfaceCompletionHandler completionHandler,
        out IActivateAudioInterfaceAsyncOperation activationOperation);

    [StructLayout(LayoutKind.Sequential)]
    struct AudioClientActivationParams
    {
        public int ActivationType;
        public uint TargetProcessId;
        public int ProcessLoopbackMode;
    }

    [StructLayout(LayoutKind.Explicit, Size = 24)]
    struct PropVariantBlob
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public uint blobSize;
        [FieldOffset(16)] public IntPtr blobData;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct WaveFormatEx
    {
        public ushort wFormatTag;
        public ushort nChannels;
        public uint nSamplesPerSec;
        public uint nAvgBytesPerSec;
        public ushort nBlockAlign;
        public ushort wBitsPerSample;
        public ushort cbSize;
    }

    [ComImport, Guid("41D949AB-9862-444A-80F6-C261334DA5EB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IActivateAudioInterfaceCompletionHandler
    {
        [PreserveSig]
        int ActivateCompleted(IActivateAudioInterfaceAsyncOperation activateOperation);
    }

    [ComImport, Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IActivateAudioInterfaceAsyncOperation
    {
        [PreserveSig]
        int GetActivateResult(out int activateResult, [MarshalAs(UnmanagedType.IUnknown)] out object activatedInterface);
    }

    [ComImport, Guid("94ea2b94-e9cc-49e0-c0ff-ee64ca8f5b90"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAgileObject { }

    [ComImport, Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioClient
    {
        [PreserveSig] int Initialize(int shareMode, int streamFlags, long bufferDuration, long periodicity, IntPtr format, IntPtr sessionGuid);
        [PreserveSig] int GetBufferSize(out uint bufferSize);
        [PreserveSig] int GetStreamLatency(out long latency);
        [PreserveSig] int GetCurrentPadding(out uint padding);
        [PreserveSig] int IsFormatSupported(int shareMode, IntPtr format, out IntPtr closestMatch);
        [PreserveSig] int GetMixFormat(out IntPtr deviceFormat);
        [PreserveSig] int GetDevicePeriod(out long defaultPeriod, out long minimumPeriod);
        [PreserveSig] int Start();
        [PreserveSig] int Stop();
        [PreserveSig] int Reset();
        [PreserveSig] int SetEventHandle(IntPtr eventHandle);
        [PreserveSig] int GetService(ref Guid iid, out IntPtr ppv);
    }

    [ComImport, Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioCaptureClient
    {
        [PreserveSig] int GetBuffer(out IntPtr data, out uint numFramesToRead, out uint flags, out ulong devicePosition, out ulong qpcPosition);
        [PreserveSig] int ReleaseBuffer(uint numFramesRead);
        [PreserveSig] int GetNextPacketSize(out uint numFramesInNextPacket);
    }

    [ComVisible(true)]
    [ClassInterface(ClassInterfaceType.None)]
    sealed class ActivationHandler : IActivateAudioInterfaceCompletionHandler, IAgileObject
    {
        public readonly ManualResetEventSlim Done = new ManualResetEventSlim(false);
        public int ActivateHr = unchecked((int)0x8000FFFF);
        public object Client;

        public int ActivateCompleted(IActivateAudioInterfaceAsyncOperation activateOperation)
        {
            try
            {
                object unk;
                int hrOp;
                var hr = activateOperation.GetActivateResult(out hrOp, out unk);
                ActivateHr = hr != 0 ? hr : hrOp;
                Client = unk;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("ActivateCompleted: " + ex.Message);
            }
            Done.Set();
            return 0;
        }
    }

    sealed class MixerGain
    {
        const float MinVolume = 0.02f;
        readonly uint _pid;
        readonly List<object> _keep = new List<object>();
        ISimpleAudioVolume _vol;
        int _retry;
        float _gain = 1f;
        float _logged = -1f;

        public MixerGain(uint pid)
        {
            _pid = pid;
            TryAttach();
        }

        public float CurrentGain()
        {
            try
            {
                if (_vol == null)
                {
                    if (_retry > 0)
                    {
                        _retry--;
                        return _gain;
                    }
                    TryAttach();
                    if (_vol == null)
                    {
                        _retry = 5;
                        return _gain;
                    }
                }
                float v;
                if (_vol.GetMasterVolume(out v) != 0) return _gain;
                bool mute;
                if (_vol.GetMute(out mute) == 0 && mute) return 1f;
                if (!(v > 0f) || v >= 0.995f)
                {
                    _gain = 1f;
                    LogIfNeeded(v, 1f);
                    return 1f;
                }
                if (v < MinVolume) v = MinVolume;
                _gain = 1f / v;
                LogIfNeeded(v, _gain);
                return _gain;
            }
            catch
            {
                _vol = null;
                _retry = 5;
                return _gain;
            }
        }

        void LogIfNeeded(float volume, float gain)
        {
            if (Math.Abs(volume - _logged) < 0.02f) return;
            _logged = volume;
            Console.Error.WriteLine("mixer volume=" + volume.ToString("0.000") + " recGain=" + gain.ToString("0.000"));
        }

        void TryAttach()
        {
            try
            {
                var t = Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"));
                if (t == null) return;
                var enm = (IMMDeviceEnumerator)Activator.CreateInstance(t);
                _keep.Add(enm);
                IntPtr devp;
                if (enm.GetDefaultAudioEndpoint(0, 1, out devp) != 0 || devp == IntPtr.Zero) return;
                var dev = (IMMDevice)Marshal.GetObjectForIUnknown(devp);
                _keep.Add(dev);
                var mgrIid = typeof(IAudioSessionManager2).GUID;
                IntPtr mgrp;
                if (dev.Activate(ref mgrIid, 23, IntPtr.Zero, out mgrp) != 0 || mgrp == IntPtr.Zero) return;
                var mgr = (IAudioSessionManager2)Marshal.GetObjectForIUnknown(mgrp);
                _keep.Add(mgr);
                IntPtr enp;
                if (mgr.GetSessionEnumerator(out enp) != 0 || enp == IntPtr.Zero) return;
                var list = (IAudioSessionEnumerator)Marshal.GetObjectForIUnknown(enp);
                _keep.Add(list);
                int n;
                list.GetCount(out n);
                for (var i = 0; i < n; i++)
                {
                    IntPtr sp;
                    if (list.GetSession(i, out sp) != 0 || sp == IntPtr.Zero) continue;
                    var ctl = (IAudioSessionControl2)Marshal.GetObjectForIUnknown(sp);
                    _keep.Add(ctl);
                    uint p;
                    if (ctl.GetProcessId(out p) != 0 || p != _pid) continue;
                    _vol = (ISimpleAudioVolume)ctl;
                    _keep.Add(_vol);
                    Console.Error.WriteLine("mixer session attached pid=" + _pid);
                    return;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("mixer attach: " + ex.Message);
            }
        }
    }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        void EnumAudioEndpoints(int a, int b, out IntPtr c);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IntPtr ppDevice);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr pActivationParams, out IntPtr ppInterface);
    }

    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionManager2
    {
        [PreserveSig] int GetAudioSessionControl(IntPtr guid, int flags, out IntPtr session);
        [PreserveSig] int GetSimpleAudioVolume(IntPtr guid, int flags, out IntPtr volume);
        [PreserveSig] int GetSessionEnumerator(out IntPtr enumerator);
    }

    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionEnumerator
    {
        [PreserveSig] int GetCount(out int sessionCount);
        [PreserveSig] int GetSession(int sessionNumber, out IntPtr session);
    }

    [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionControl2
    {
        void GetState(out int state);
        void GetDisplayName(out IntPtr name);
        void SetDisplayName(IntPtr name, Guid eventContext);
        void GetIconPath(out IntPtr path);
        void SetIconPath(IntPtr path, Guid eventContext);
        void GetGroupingParam(out Guid grouping);
        void SetGroupingParam(Guid grouping, Guid eventContext);
        void RegisterAudioSessionNotification(IntPtr client);
        void UnregisterAudioSessionNotification(IntPtr client);
        void GetSessionIdentifier(out IntPtr id);
        void GetSessionInstanceIdentifier(out IntPtr id);
        [PreserveSig] int GetProcessId(out uint pid);
    }

    [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ISimpleAudioVolume
    {
        [PreserveSig] int SetMasterVolume(float level, Guid eventContext);
        [PreserveSig] int GetMasterVolume(out float level);
        [PreserveSig] int SetMute(bool mute, Guid eventContext);
        [PreserveSig] int GetMute(out bool mute);
    }
}
