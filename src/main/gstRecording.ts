import { spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { startAppLoopback, type AppLoopbackHandle } from './appLoopback';
import { resolveFfmpegPath } from './ffmpegBin';
import { even, getClientSize, startHwndFramePump } from './hwndFrameGrab';
import { probeMp4Audio } from './mp4AudioProbe';
import { recError, recLog, recWarn } from './recordingLog';
import { readGstHwnd } from './paths';
import { getScreenshotDirectory } from './settings';
import { state } from './state';
import type { NativeRecordingStartResult, NativeRecordingStopResult } from './types';
import { uxplay } from './uxplay-manager';

type RecSession = {
  ffmpeg: ChildProcess;
  stopGrab: () => void;
  audio: AppLoopbackHandle | null;
  videoPath: string;
  audioPath: string | null;
  destPath: string;
  startedAt: number;
  hwnd: string;
  pid: number;
  pipeline: string;
};

let session: RecSession | null = null;

function recStamp(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

async function waitHwnd(pid: number, timeoutMs: number): Promise<bigint> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hwnd = readGstHwnd(pid);
    if (hwnd !== null) return hwnd;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(`UxPlay HWND missing after ${String(timeoutMs)}ms (pid ${String(pid)})`);
}

function waitClientSize(hwnd: bigint, timeoutMs: number): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = (): void => {
      const size = getClientSize(hwnd);
      if (size) {
        resolve(size);
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('UxPlay client size missing'));
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

function moveToDest(tempPath: string, destPath: string): void {
  mkdirSync(dirname(destPath), { recursive: true });
  try {
    renameSync(tempPath, destPath);
  } catch {
    copyFileSync(tempPath, destPath);
    try {
      unlinkSync(tempPath);
    } catch {
      recWarn(`could not delete temp ${tempPath}`);
    }
  }
}

function unlinkQuiet(path: string | null): void {
  if (!path) return;
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    recWarn(`could not delete ${path}`);
  }
}

function runFfmpeg(bin: string, args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      resolve({ code, stderr: stderr.trim() });
    });
  });
}

function startRawHwndEncoder(
  bin: string,
  width: number,
  height: number,
  outPath: string,
): Promise<ChildProcess> {
  const args = [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-y',
    '-f',
    'rawvideo',
    '-pixel_format',
    'bgra',
    '-video_size',
    `${String(width)}x${String(height)}`,
    '-framerate',
    '30',
    '-use_wallclock_as_timestamps',
    '1',
    '-fflags',
    '+genpts',
    '-i',
    'pipe:0',
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-tune',
    'zerolatency',
    '-pix_fmt',
    'yuv420p',
    outPath,
  ];
  recLog(`ffmpeg rawvideo HWND ${String(width)}x${String(height)} bgra@30`);
  const child = spawn(bin, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  return new Promise((resolve, reject) => {
    const fail = (message: string): void => {
      reject(new Error(message));
    };
    child.once('error', (err) => {
      fail(err.message);
    });
    const earlyExit = (code: number | null): void => {
      fail(`ffmpeg exited ${String(code)}${stderr ? `: ${stderr.slice(-400)}` : ''}`);
    };
    child.once('exit', earlyExit);
    setTimeout(() => {
      child.off('exit', earlyExit);
      if (child.exitCode !== null) {
        fail(`ffmpeg exited ${String(child.exitCode)}${stderr ? `: ${stderr.slice(-400)}` : ''}`);
        return;
      }
      resolve(child);
    }, 700);
  });
}

async function stopFfmpeg(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return;
  await new Promise<void>((resolve) => {
    const done = (): void => {
      resolve();
    };
    child.once('exit', done);
    try {
      child.stdin?.end();
    } catch {
      child.kill();
    }
    setTimeout(() => {
      if (child.exitCode === null) child.kill();
    }, 4000);
  });
}

function attachFramePump(hwnd: bigint, width: number, height: number, ffmpeg: ChildProcess): () => void {
  const stdin = ffmpeg.stdin;
  if (!stdin) {
    throw new Error('ffmpeg stdin missing');
  }
  let writable = true;
  stdin.on('drain', () => {
    writable = true;
  });
  return startHwndFramePump({
    hwnd,
    width,
    height,
    fps: 30,
    write: (frame) => {
      if (!writable || !stdin.writable) return false;
      writable = stdin.write(frame);
      return true;
    },
  });
}

async function startProcessAudio(pid: number, wavPath: string): Promise<AppLoopbackHandle | null> {
  try {
    return await startAppLoopback(pid, wavPath);
  } catch (err) {
    recWarn(`process loopback failed (video still records): ${err instanceof Error ? err.message : String(err)}`);
    unlinkQuiet(wavPath);
    return null;
  }
}

export function isNativeRecording(): boolean {
  return session !== null;
}

export async function startNativeRecording(): Promise<NativeRecordingStartResult> {
  if (session) {
    recWarn('start refused: already recording');
    return { ok: false, error: 'already recording' };
  }

  recLog('start: PrintWindow HWND → ffmpeg rawvideo + process loopback WAV');

  const pid = state.gstPid ?? uxplay.getProcessPid();
  if (pid == null) {
    recError('no UxPlay pid — receiver not streaming');
    return { ok: false, error: 'UxPlay is not streaming - connect your iPhone first' };
  }

  const ffmpeg = resolveFfmpegPath();
  if (!ffmpeg) {
    recError('ffmpeg-static binary missing');
    return { ok: false, error: 'ffmpeg introuvable (ffmpeg-static)' };
  }

  let hwnd: bigint;
  try {
    hwnd = await waitHwnd(pid, 2500);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recError(message);
    return { ok: false, error: `Video window not found: ${message}` };
  }

  let width: number;
  let height: number;
  try {
    const size = await waitClientSize(hwnd, 2500);
    width = even(size.width);
    height = even(size.height);
    recLog(`hwnd=${hwnd.toString()} client=${String(width)}x${String(height)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recError(message);
    return { ok: false, error: `Video window not found: ${message}` };
  }

  const stamp = recStamp();
  const videoPath = join(tmpdir(), `novx-rec-${stamp}.mp4`);
  const audioPath = join(tmpdir(), `novx-rec-${stamp}.wav`);
  const destPath = join(getScreenshotDirectory(), `NOVX-recording-${stamp}.mp4`);

  let ffmpegProc: ChildProcess;
  try {
    ffmpegProc = await startRawHwndEncoder(ffmpeg, width, height, videoPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recError(`ffmpeg rawvideo failed: ${message}`);
    unlinkQuiet(videoPath);
    return { ok: false, error: `Window capture failed: ${message}` };
  }

  let stopGrab: () => void;
  try {
    stopGrab = attachFramePump(hwnd, width, height, ffmpegProc);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recError(`frame pump failed: ${message}`);
    try {
      ffmpegProc.stdin?.end();
    } catch {
      ffmpegProc.kill();
    }
    unlinkQuiet(videoPath);
    return { ok: false, error: `Window capture failed: ${message}` };
  }

  const audio = await startProcessAudio(pid, audioPath);

  session = {
    ffmpeg: ffmpegProc,
    stopGrab,
    audio,
    videoPath,
    audioPath: audio ? audioPath : null,
    destPath,
    startedAt: Date.now(),
    hwnd: hwnd.toString(),
    pid,
    pipeline: audio ? 'PrintWindow HWND + process loopback' : 'PrintWindow HWND (video only)',
  };
  recLog(`recording ${session.pipeline}`);
  return { ok: true };
}

export async function stopNativeRecording(): Promise<NativeRecordingStopResult> {
  const current = session;
  if (!current) {
    recWarn('stop: no active session');
    return { path: null, hasAudio: false, error: 'not recording' };
  }
  session = null;
  recLog(`stop: ${current.pipeline} (${String(Date.now() - current.startedAt)}ms)`);

  current.stopGrab();

  if (current.audio) {
    try {
      await current.audio.stop();
    } catch (err) {
      recWarn(`audio stop: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  try {
    await stopFfmpeg(current.ffmpeg);
  } catch (err) {
    recError(`ffmpeg stop: ${err instanceof Error ? err.message : String(err)}`);
    unlinkQuiet(current.videoPath);
    unlinkQuiet(current.audioPath);
    return { path: null, hasAudio: false, error: 'Failed to stop window capture' };
  }

  if (!existsSync(current.videoPath) || statSync(current.videoPath).size < 1000) {
    recError('ffmpeg video file missing or tiny');
    unlinkQuiet(current.videoPath);
    unlinkQuiet(current.audioPath);
    return { path: null, hasAudio: false, error: 'Recording file was not created' };
  }

  let muxed = current.videoPath;
  const hasAudioFile =
    current.audioPath !== null && existsSync(current.audioPath) && statSync(current.audioPath).size > 500;

  if (hasAudioFile && current.audioPath) {
    const ffmpeg = resolveFfmpegPath();
    const muxPath = join(tmpdir(), `novx-mux-${recStamp()}.mp4`);
    if (ffmpeg) {
      const result = await runFfmpeg(ffmpeg, [
        '-hide_banner',
        '-loglevel',
        'warning',
        '-y',
        '-i',
        current.videoPath,
        '-i',
        current.audioPath,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-shortest',
        '-movflags',
        '+faststart',
        muxPath,
      ]);
      if (result.code === 0 && existsSync(muxPath) && statSync(muxPath).size > 1000) {
        unlinkQuiet(current.videoPath);
        unlinkQuiet(current.audioPath);
        muxed = muxPath;
      } else {
        recWarn(`mux failed (${String(result.code)}): ${result.stderr.slice(-300)}`);
        unlinkQuiet(muxPath);
      }
    }
  } else {
    unlinkQuiet(current.audioPath);
  }

  let probe = { hasAudio: false, hasVideo: false, handlers: [] as string[] };
  try {
    probe = probeMp4Audio(muxed);
    recLog(
      `probe handlers=${probe.handlers.join(',') || '(none)'} video=${String(probe.hasVideo)} audio=${String(probe.hasAudio)}`,
    );
  } catch (err) {
    recError(`mp4 probe failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    moveToDest(muxed, current.destPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recError(`move failed: ${message}`);
    return { path: null, hasAudio: probe.hasAudio, error: `Failed to save recording: ${message}` };
  }

  recLog(`saved ${current.destPath} audio=${String(probe.hasAudio)}`);
  return { path: current.destPath, hasAudio: probe.hasAudio };
}

export function abortNativeRecording(): void {
  const current = session;
  if (!current) return;
  session = null;
  recWarn('abort: app quitting');
  current.stopGrab();
  void current.audio?.stop();
  try {
    current.ffmpeg.stdin?.end();
  } catch {
    current.ffmpeg.kill();
  }
}
