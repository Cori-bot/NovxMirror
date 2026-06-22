import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type PSCallback = (err: Error | null, stdout: string, stderr: string) => void;

export function runPSResult(script: string, callback?: PSCallback): void {
  const id = `novx-${String(Date.now())}-${Math.random().toString(36).slice(2, 7)}`;
  const scriptPath = join(tmpdir(), `${id}.ps1`);
  try {
    writeFileSync(scriptPath, script, 'utf8');
    const ps = spawn(
      'powershell',
      ['-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { windowsHide: true },
    );
    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    ps.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    ps.on('close', (code) => {
      try {
        unlinkSync(scriptPath);
      } catch {
        // ignore
      }
      const err = code === 0 ? null : new Error(`PowerShell exited with code ${String(code)}`);
      callback?.(err, stdout, stderr);
    });
    ps.on('error', (err) => {
      try {
        unlinkSync(scriptPath);
      } catch {
        // ignore
      }
      callback?.(err, stdout, stderr);
    });
  } catch (err) {
    callback?.(err instanceof Error ? err : new Error(String(err)), '', '');
  }
}

export function runPS(script: string, callback?: (err: Error | null) => void): void {
  runPSResult(script, (err) => {
    callback?.(err);
  });
}

export function toPowerShellSingleQuoted(value: string): string {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

// Échappe un chemin pour insertion DANS une chaîne PowerShell entre apostrophes
// simples ('...'), comme `$hf = '${escapePath(path)}'`. Dans ce contexte
// l'antislash est LITTÉRAL (ne pas le doubler) et seule l'apostrophe est
// spéciale (se double en ''). L'ancienne version doublait les antislashs
// (no-op par chance via la normalisation Win32) et n'échappait PAS l'apostrophe,
// cassant le script — voire injection — sur un chemin du type C:\Users\O'Brien\.
export function escapePath(p: string): string {
  return String(p ?? '').replace(/'/g, "''");
}
