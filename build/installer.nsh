; Règles de pare-feu Windows pour le receiver AirPlay.
;
; Sans ces règles, c'est Windows qui pose la boîte de dialogue "Autoriser l'accès"
; au premier lancement d'uxplay.exe. Elle n'est cochée que pour le profil "Réseaux
; publics" par défaut, et l'app n'étant pas élevée, la règle créée reste limitée à
; ce profil. Sur un Wi-Fi domestique (profil "Privé"), le trafic mDNS/AirPlay
; entrant est alors bloqué → l'iPhone ne voit pas le receiver, ou la session
; décroche. On crée donc les règles à l'installation (l'installeur, lui, est
; élevé) pour TOUS les profils, en TCP et UDP.

!macro NovxAddFirewallRules
  ; Purge d'abord d'éventuelles règles homonymes (réinstallation / MAJ).
  nsExec::Exec 'netsh advfirewall firewall delete rule name="NOVX Mirror (UxPlay)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="NOVX Mirror"'

  nsExec::Exec 'netsh advfirewall firewall add rule name="NOVX Mirror (UxPlay)" dir=in action=allow profile=any protocol=tcp enable=yes program="$INSTDIR\resources\bin\uxplay.exe"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="NOVX Mirror (UxPlay)" dir=in action=allow profile=any protocol=udp enable=yes program="$INSTDIR\resources\bin\uxplay.exe"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="NOVX Mirror" dir=in action=allow profile=any protocol=tcp enable=yes program="$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="NOVX Mirror" dir=in action=allow profile=any protocol=udp enable=yes program="$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
!macroend

!macro NovxRemoveFirewallRules
  nsExec::Exec 'netsh advfirewall firewall delete rule name="NOVX Mirror (UxPlay)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="NOVX Mirror"'
!macroend

; Purge Jump Lists / AUMID legacy (com.novx.mirror empoisonné par Electron.lnk pnpm dev)
; et force les raccourcis Bureau + Menu Démarrer (keepShortcuts peut les omettre en MAJ).
!macro NovxFixShellIdentity
  WinShell::UninstAppUserModelId "com.novx.mirror"
  WinShell::UninstAppUserModelId "com.novx.mirror.dev"
  WinShell::UninstAppUserModelId "${APP_ID}"

  ; Machine (ProgramData / Public Desktop) — défaut per-machine.
  SetShellVarContext all
  CreateShortCut "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" "${APP_ID}"
  CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$DESKTOP\${SHORTCUT_NAME}.lnk" "${APP_ID}"

  ; Aussi sur le bureau / menu de l'utilisateur courant (visibilité immédiate).
  SetShellVarContext current
  CreateShortCut "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" "${APP_ID}"
  CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$DESKTOP\${SHORTCUT_NAME}.lnk" "${APP_ID}"
  ${if} ${FileExists} "$SMPROGRAMS\Electron.lnk"
    WinShell::UninstShortcut "$SMPROGRAMS\Electron.lnk"
    Delete "$SMPROGRAMS\Electron.lnk"
  ${endIf}
  SetShellVarContext all
!macroend

!macro customInstall
  !insertmacro NovxAddFirewallRules
  !insertmacro NovxFixShellIdentity
!macroend

!macro customUnInstall
  !insertmacro NovxRemoveFirewallRules
  WinShell::UninstAppUserModelId "${APP_ID}"
  WinShell::UninstAppUserModelId "com.novx.mirror"
  WinShell::UninstAppUserModelId "com.novx.mirror.dev"
!macroend
