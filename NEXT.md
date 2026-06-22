# NEXT — NOVX Mirror (audit + quick wins)

Sessions des 2026-06-21/22. Audit complet (32 agents) + quick-wins + features
(TikTok, bouton REC) + deps Vague 1 + GPU zéro-copie. Tout est **validé** par
`tsc -b --noEmit` + ESLint + build `electron-vite` (3 verts) ; les bumps deps sont
aussi validés par `pnpm install` + le binaire Electron 42 qui démarre. Rien n'a
encore été lancé sur un iPhone réel (cf. items « À VALIDER SUR DEVICE »).

Commits sur la branche `feat/audit-quickwins-recording` :
- `f2e1dfd` feat: quick-wins + bugs + perf + features (TikTok, REC)
- `073eda0` chore(deps): vague 1 (Electron 42, builder, typescript-eslint, zustand, geist)
- `e63f424` chore(deps): eslint 9.39.4 (ESLint 10 différé)
- `be37adc` perf(gpu): pipeline zéro-copie (videocrop retiré) — à valider visuellement

## 1. État courant

### ✅ Fait & vérifié (compile/lint/build OK)
**Base de vérif**
- `typecheck` réparé : `tsc --noEmit` → `tsc -b --noEmit` (avant il ne checkait RIEN).
  `*.tsbuildinfo` ajouté au .gitignore.
- 5 erreurs de type masquées corrigées : ipc.ts (showOpenDialog undefined), tailwind
  darkMode (syntaxe `variant`), tsconfig.web (include main/types.ts), Onboarding
  (comparaison redondante), Select (KeyboardEvent DOM vs React).

**Bugs (uxplay-manager.ts / ipc.ts)**
- Boucle de restart infinie corrigée : `isAutoRestart` propagé jusqu'à `start()`.
- Race restart vs stop manuel : jeton `restartGeneration` (incrémenté dans start/stop,
  vérifié après le check Bonjour async).
- Garde anti-double-lancement en tête de `startUxPlay` (`if uxplay.isRunning() return`).
- `streaming-started` : pid capturé au match + garde d'identité du process + timer cleared.

**Perf (sûr, sans risque visuel)**
- `GST_DEBUG` : `*:2,GST_CAPS:5,h264parse:5,videocrop:5,d3d11videosink:5` → `*:2,GST_CAPS:5`
  (coupe le flood de logs par frame + supprime les fausses résolutions parasites).
- `GST_PLUGIN_FEATURE_RANK=d3d11h264dec:max,d3d11h265dec:max` (garantit le decode GPU
  sans retirer le fallback software). NB: le decode était DÉJÀ matériel via decodebin.
- `taskkill` : `execSync` (bloquait l'UI) → `execFile` async.
- Switches Electron (index.ts) : `use-angle=d3d11`, `disable-features=HardwareMediaKeyHandling,MediaSessionService`.
- webPreferences (windows.ts) : `spellcheck:false`, `v8CacheOptions:'bypassHeatCheck'`.

**PowerShell**
- `escapePath` corrigé : échappe l'apostrophe (`'`→`''`), ne double plus les `\`
  (cassait sur un profil type `C:\Users\O'Brien\...`).

**Renderer**
- `BonjourModal` : compte à rebours en `useEffect` nettoyable (plus de double restartApp).
- `useTimer`/`StatsPanel` : dépendance primitive `startMs` (chrono ne repart plus de 0).
- `ErrorBanner` : bouton « Détails » fonctionnel (déplie `errorDetails`, suspend l'auto-hide).
- i18n : clés mortes `maxResolution`/`resolution.{1080p,1440p,4k}` retirées (fr/en/de).
- Code mort `void startNativeFollow` + import retiré (ipc.ts).

**Feature TikTok (diagnostic)**
- Détection du basculement mirroring→AirPlay video (`POST /play`/`Content-Location`/
  `fcup_request`) → event `video-route-switch` → IPC → preload → bandeau d'avertissement
  (titre + détail dépliable, i18n fr/en/de).
  ⚠️ À VALIDER SUR IPHONE : les marqueurs exacts loggés par UxPlay 1.73 ne sont pas
  confirmés sans `-d`. Si le bandeau ne se déclenche pas, ajuster les chaînes détectées
  dans `uxplay-manager.ts` (bloc « Basculement mirroring → AirPlay video »).

**Feature enregistrement vidéo (bouton REC)**
- Bouton REC dans le StatsPanel (visible quand connecté). Capture la fenêtre vidéo
  native via `getDisplayMedia` + `MediaRecorder` (webm). Sélection auto de la source
  par `setDisplayMediaRequestHandler` (main, cible la fenêtre "NovX Mirror", fallback
  écran). Sauvegarde dans le dossier screenshots via IPC `save-recording`.
  Fichiers : ipc.ts (handler + save), preload (saveRecording), RecordButton.tsx,
  StatsPanel.tsx, stats.css, translations (stats.record/recordStop/recordSaved,
  error.recordFailed).
  ⚠️ À VALIDER SUR IPHONE : capture d'une fenêtre d3d11 via Windows Graphics Capture
  (Win11) — fonctionne en principe mais à confirmer (risque d'écran noir selon GPU).
  Si noir : fallback documenté = UxPlay `-mp4` (enregistre toute la session).
  NB: contenus protégés (DRM/Snapchat/Insta) restent noirs — protection appliquée par iOS.

**Refusé (demande utilisateur)**
- Bypass des protections « photo unique » Snapchat/Instagram + masquage de la détection
  de recopie : refusé. Techniquement impossible depuis le récepteur (iOS pose
  `UIScreen.isCaptured`, l'app émettrice noircit/notifie ; NOVX ne peut rien y changer)
  ET non éthique (capture non consentie de contenus privés éphémères).

## 2. Décisions clés
- Le décodage est déjà GPU (d3d11h264dec). Le vrai goulot GPU = `videocrop` (CPU) dans
  le pipeline qui casse le zero-copy → voir tâches restantes (besoin test device).
- iPhone control via AirPlay = IMPOSSIBLE (unidirectionnel). Voir memory iphone-control-and-cable.
- Pas d'« AirPlay over USB » natif. Câble = POC Personal Hotspot OU mode pymobiledevice3 séparé.
- Deps NON bumpées cette session : `pnpm install` bloqué (pnpm-workspace.yaml non suivi +
  purge-on-no-TTY) et impossible de valider un build/launch après une montée Electron 41→43.

## 3. Fichiers modifiés
package.json, .gitignore, tsconfig.web.json, tailwind.config.ts,
src/main/{uxplay-manager,ipc,powershell,index,windows}.ts,
src/preload/index.ts,
src/renderer/src/i18n/translations.ts,
src/renderer/src/components/{Onboarding,Select,ErrorBanner,BonjourModal,StatsPanel}.tsx,
src/renderer/src/components/RecordButton.tsx (nouveau),
src/renderer/src/styles/stats.css,
src/renderer/src/hooks/useTimer.ts,
src/renderer/src/App.tsx

## 4. Tâches restantes (par workstream)

### GPU zero-copy — ✅ FAIT (commit perf(gpu), À VALIDER VISUELLEMENT)
- [x] `videocrop` retiré du `-vs` (uxplay-manager.ts buildArgs) → decode d3d11 →
  d3d11videosink direct (zéro-copie). Validé compile/lint/build.
- [ ] **À VÉRIFIER SUR DEVICE** : pas de liseré d'overscan visible aux bords. Si liseré
  gênant → revert (instructions en commentaire dans buildArgs) ou crop GPU-side.

### Deps Vague 1 — ✅ FAIT (2 commits chore(deps), À LAUNCH-TESTER)
- [x] Electron `^41.3.0` → `^42.4.1` (43 encore beta) ; electron-builder → `^26.15.3` ;
  `@typescript-eslint` → `^8.61.1` ; zustand `5.0.14` ; geist `1.7.2`. Validé
  install + typecheck + lint + build + binaire Electron 42 (`v42.4.1`).
- [~] ESLint 10 : DIFFÉRÉ. eslint-plugin-react@7.37.5 casse sur ESLint 10
  (`context.getFilename` retiré). Resté en eslint `^9.39.4`. Refaire quand
  eslint-plugin-react + eslint-plugin-import supportent ESLint 10.
- [ ] **À FAIRE côté device** : `pnpm dev` / `pnpm start` pour valider le runtime
  Electron 42 (nouveau Chromium) avec le pipeline GStreamer d3d11.
- [ ] (Vague 2/3 plus tard : Vite 7 + electron-vite 5 + plugin-react 5 + TS 5.9 ;
  puis React 19 + Compiler, Tailwind 4.)

### Feature iPhone — DACP : ❌ NON RETENU (mauvais fit)
- DACP est le seul back-channel AirPlay, mais il ne fonctionne QUE pour les sessions
  AirPlay AUDIO (RAOP), PAS pour le mirroring vidéo. NOVX étant un récepteur de
  mirroring, une « télécommande média » serait MORTE pendant la recopie d'écran →
  valeur quasi nulle dans le cas d'usage. Non implémenté volontairement.
- [ ] (Optionnel, si on vise vraiment le contrôle) curseur via BLE HID +
  AssistiveTouch — prototyper d'abord que Windows peut publier un GATT HID accepté
  par iOS (WinRT GattServiceProvider). Hors périmètre headless.

### Câble — POC gratuit (TEST MANUEL utilisateur, aucun code)
- [ ] iPhone → Réglages → Partage de connexion → activer ; brancher l'USB ; côté PC,
  vérifier l'adaptateur « Apple Mobile Device Ethernet » (Panneau de config réseau) ;
  lancer NOVX et regarder si l'iPhone liste le receiver dans Recopie d'écran.
  Si OK = zéro changement de pipeline. Sinon : mode pymobiledevice3 DVT séparé
  (blueprint MIT BieleckiLtd/IosScreenCaptureTool — un 2e backend, gros chantier).

### Autres simplifications (non urgentes, repérées)
- [ ] video-window.ts : ~150 lignes de P/Invoke C# dupliquées (NovxW/NovxS) → DLL/source unique.
- [ ] Pattern spawn-powershell-par-appel + Add-Type recompilé → process PS persistant
  (gros gain CPU sur freeze-follow 90ms et show retries).
- [ ] save-settings/apply-settings quasi identiques → factoriser.
- [ ] gstBoundsFile écrit 20×/s sans lecteur (code mort) ; WM_SETICON ré-émis chaque tick.
