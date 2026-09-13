import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(root, 'scripts', 'app-loopback', 'AppLoopback.cs');
const out = join(root, 'bin', 'novx-applog.exe');
const csc = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');

if (!existsSync(csc)) {
  console.error(`csc.exe introuvable: ${csc}`);
  process.exit(1);
}

const result = spawnSync(
  csc,
  ['/nologo', '/optimize', '/platform:x64', '/target:exe', `/out:${out}`, src],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
