/**
 * Régénère les icônes Windows depuis assets/novx-logo-512.png :
 * - icon.ico (16/32/48/256)
 * - novx-logo-256-removebg.png / novx-logo-32-removebg.png (fond transparent)
 *
 * Usage : pnpm icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcPng = join(root, 'assets', 'novx-logo-512.png');

async function removeBlackBg(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const threshold = 28;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function resizeTransparent(transparent, size) {
  return sharp(transparent)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  const source = readFileSync(srcPng);
  const transparent = await removeBlackBg(source);

  const png256 = await resizeTransparent(transparent, 256);
  const png32 = await resizeTransparent(transparent, 32);
  writeFileSync(join(root, 'assets', 'novx-logo-256-removebg.png'), png256);
  writeFileSync(join(root, 'assets', 'novx-logo-32-removebg.png'), png32);

  const sizes = [16, 32, 48, 256];
  const icoPngs = await Promise.all(sizes.map((s) => resizeTransparent(transparent, s)));
  const ico = await pngToIco(icoPngs);
  writeFileSync(join(root, 'assets', 'icon.ico'), ico);
  writeFileSync(join(root, 'assets', 'tray-icon.ico'), ico);

  const publicDir = join(root, 'src', 'renderer', 'public');
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, 'favicon.png'), png256);

  console.log(
    'Icons generated: icon.ico, tray-icon.ico, novx-logo-256/32-removebg.png, public/favicon.png',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
