# NEXT — NOVX Mirror (audit + quick wins)

Session du 2026-06-21. Audit complet (32 agents) + implémentation du lot quick-wins
et de la feature TikTok. Tout ce qui suit est **validé** par `tsc -b --noEmit` + ESLint
+ build `electron-vite` (les 3 verts). Rien n'a encore été lancé sur un iPhone réel.

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

### GPU zero-copy (besoin test device)
- [ ] Tester le retrait de `videocrop` du `-vs` (uxplay-manager.ts:~141). Le crop
  (6/6/2/0 px overscan) force GPU→CPU→GPU par frame. Options à prototyper :
  (a) supprimer videocrop et vérifier si `force-aspect-ratio` + la fenêtre native
  suffisent ; (b) crop côté fenêtre Win32 (overscan déjà géré dans video-window.ts).
  Mesurer CPU/latence avant/après. NE PAS shipper sans validation visuelle.

### Deps Vague 1 — sécurité (besoin pnpm install + build/launch)
- [ ] Régler d'abord le blocage pnpm (pnpm-workspace.yaml : vérifier `allowBuilds` vs
  `onlyBuiltDependencies`, ou `CI=true`).
- [ ] Electron `^41.3.0` → `^43` (EOL 25 août 2026). ESLint `^9.15` → `^10`
  (EOL 6 août 2026) + `@typescript-eslint` → `^8.61` + remplacer `tseslint.config()`
  par `defineConfig()`. electron-builder → `^26.15.3`. Triviaux : zustand 5.0.14,
  geist 1.7.2. Lancer install → typecheck → build → launch test.
- [ ] (Vague 2/3 plus tard : Vite 7 + electron-vite 5 + plugin-react 5 + TS 5.9 ;
  puis React 19 + Compiler, Tailwind 4.)

### Feature iPhone — DACP (média)
- [ ] Télécommande média : UxPlay `-dacp`, parser `~/.uxplay.dacp`, envoyer
  play/pause/piste/volume au `_dacp._tcp` de l'iPhone. UI = boutons média. ~1j.
- [ ] (Optionnel, à prototyper) curseur via BLE HID + AssistiveTouch — valider d'abord
  que Windows peut publier un GATT HID accepté par iOS.

### Câble — POC gratuit (test manuel utilisateur)
- [ ] iPhone → Partage de connexion → « USB uniquement » ; vérifier l'adaptateur
  « Apple Mobile Device Ethernet » côté PC ; lancer UxPlay et voir si l'iPhone liste
  le receiver dans Recopie d'écran. Si OK = zéro changement de pipeline. Sinon : mode
  pymobiledevice3 DVT séparé (blueprint MIT BieleckiLtd/IosScreenCaptureTool).

### Autres simplifications (non urgentes, repérées)
- [ ] video-window.ts : ~150 lignes de P/Invoke C# dupliquées (NovxW/NovxS) → DLL/source unique.
- [ ] Pattern spawn-powershell-par-appel + Add-Type recompilé → process PS persistant
  (gros gain CPU sur freeze-follow 90ms et show retries).
- [ ] save-settings/apply-settings quasi identiques → factoriser.
- [ ] gstBoundsFile écrit 20×/s sans lecteur (code mort) ; WM_SETICON ré-émis chaque tick.
