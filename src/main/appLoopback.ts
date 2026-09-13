import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { recLog } from './recordingLog';
import { uxplay } from './uxplay-manager';

export type AppLoopbackHandle = {
  stop: () => Promise<void>;
};

export function resolveAppLoopbackPath(): string | null {
  const binDir = uxplay.getBinDirectory();
  if (!binDir) return null;
  const exe = join(binDir, 'novx-applog.exe');
  return existsSync(exe) ? exe : null;
}

export function startAppLoopback(pid: number, wavPath: string): Promise<AppLoopbackHandle> {
  const exe = resolveAppLoopbackPath();
  if (!exe) {
    return Promise.reject(new Error('novx-applog.exe missing — run pnpm applog'));
  }
  recLog(`app-loopback pid=${String(pid)} → ${wavPath}`);
  const child = spawn(exe, [String(pid), wavPath], {
    windowsHide: true,
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  return waitReady(child);
}

function waitReady(child: ChildProcess): Promise<AppLoopbackHandle> {
  return new Promise((resolve, reject) => {
    let stderr = '';
    let settled = false;
    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {
        // already gone
      }
      reject(new Error(message));
    };
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      recLog(`app-loopback: ${text.trim()}`);
      if (!settled && text.includes('READY')) {
        settled = true;
        resolve({
          stop: () => stopHelper(child),
        });
      }
    });
    child.once('error', (err) => {
      fail(err.message);
    });
    child.once('exit', (code) => {
      if (settled) return;
      fail(`app-loopback exited ${String(code)}${stderr ? `: ${stderr.trim().slice(-300)}` : ''}`);
    });
    setTimeout(() => {
      if (!settled) fail(`app-loopback timeout${stderr ? `: ${stderr.trim().slice(-300)}` : ''}`);
    }, 9000);
  });
}

function stopHelper(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return Promise.resolve();
  return new Promise((resolve) => {
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
