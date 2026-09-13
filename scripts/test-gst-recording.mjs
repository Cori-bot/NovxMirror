#!/usr/bin/env node
/**
 * Script de test diagnostic pour l'enregistrement vidéo GStreamer
 * Vérifie les dépendances, les éléments GStreamer et l'environnement
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const binDir = join(projectRoot, 'bin');

console.log('=== Test diagnostic GStreamer Recording ===\n');

// 1. Vérification des fichiers DLL critiques
console.log('1. Vérification des DLL critiques dans bin/ :');
const criticalDlls = [
  'libgstreamer-1.0-0.dll',
  'libgobject-2.0-0.dll',
  'libglib-2.0-0.dll',
  'libgstriff-1.0-0.dll',
  'libgstbase-1.0-0.dll',
  'libgstaudio-1.0-0.dll',
  'libgstvideo-1.0-0.dll',
  'libgstpbutils-1.0-0.dll',
  'libgstrtp-1.0-0.dll',
];

for (const dll of criticalDlls) {
  const path = join(binDir, dll);
  const exists = existsSync(path);
  console.log(`  ${dll}: ${exists ? '✓' : '✗ MANQUANT'}`);
}

// 2. Vérification des plugins GStreamer
console.log('\n2. Vérification des plugins dans bin/gstreamer-1.0/ :');
const criticalPlugins = [
  'libgstisomp4.dll',
  'libgstwasapi2.dll',
  'libgstwasapi.dll',
  'libgstd3d11.dll',
  'libgstlibav.dll',
  'libgstmpegtsmux.dll',
];

for (const plugin of criticalPlugins) {
  const path = join(binDir, 'gstreamer-1.0', plugin);
  const exists = existsSync(path);
  console.log(`  ${plugin}: ${exists ? '✓' : '✗ MANQUANT'}`);
}

// 3. Vérification d'UxPlay
console.log('\n3. Vérification d\'UxPlay :');
const uxplayPath = join(binDir, 'uxplay.exe');
const uxplayExists = existsSync(uxplayPath);
console.log(`  uxplay.exe: ${uxplayExists ? '✓' : '✗ MANQUANT'}`);

// 4. Résumé
console.log('\n=== Résumé ===');
const allCritical = criticalDlls.every(dll => existsSync(join(binDir, dll)));
const allPlugins = criticalPlugins.every(plugin => existsSync(join(binDir, 'gstreamer-1.0', plugin)));

if (allCritical && allPlugins && uxplayExists) {
  console.log('✓ Toutes les dépendances sont présentes');
  console.log('\nProchaines étapes :');
  console.log('1. Lancez "pnpm dev" pour démarrer l\'application');
  console.log('2. Connectez votre iPhone en AirPlay');
  console.log('3. Cliquez sur REC et observez les logs dans la console');
  console.log('4. Cherchez les lignes commençant par [REC]');
} else {
  console.log('✗ Des dépendances sont manquantes');
  console.log('\nFichiers manquants :');
  
  criticalDlls.forEach(dll => {
    if (!existsSync(join(binDir, dll))) {
      console.log(`  - ${dll}`);
    }
  });
  
  criticalPlugins.forEach(plugin => {
    if (!existsSync(join(binDir, 'gstreamer-1.0', plugin))) {
      console.log(`  - ${plugin}`);
    }
  });
  
  if (!uxplayExists) {
    console.log('  - uxplay.exe');
  }
  
  console.log('\nSolution : Lancez setup.ps1 pour installer les dépendances manquantes');
}

console.log('\n=== Fin du test ===');