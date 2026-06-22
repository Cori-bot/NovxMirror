import type { Locale } from '../types';

interface PageContent {
  title: string;
  intro: string;
  sections: { title: string; text: string }[];
}

interface StatusEntry {
  label: string;
  sub: string;
  withDevice?: string;
}

export interface Translations {
  meta: { title: string };
  titlebar: { minimize: string; maximize: string; close: string };
  nav: { home: string; settings: string; logs: string };
  common: { apply: string; back: string; close: string; upToDate: string };
  home: {
    kicker: string;
    title: string;
    subtitle: string;
    receiverChip: string;
    connectionChip: string;
    connectionValue: string;
    about: string;
    terms: string;
    opensource: string;
    security: string;
    builtBy: string;
  };
  pages: {
    about: PageContent;
    terms: PageContent;
    opensource: PageContent;
    security: PageContent;
  };
  settings: Record<string, string | Record<string, string>>;
  logs: Record<string, string>;
  error: Record<string, string>;
  confirm: Record<string, string>;
  toggle: Record<string, string>;
  device: Record<string, string>;
  hint: Record<string, string>;
  status: Record<'stopped' | 'starting' | 'waiting' | 'connected' | 'error', StatusEntry>;
  bonjour: Record<string, string>;
  stats: Record<string, string>;
}

export const TRANSLATIONS: Record<Locale, Translations> = {
  fr: {
    meta: { title: 'NOVX Mirror' },
    titlebar: {
      minimize: 'Reduire dans la barre des taches',
      maximize: 'Agrandir la fenetre',
      close: 'Masquer dans le tray system',
    },
    nav: { home: 'Accueil', settings: 'Parametres', logs: 'Logs' },
    common: { apply: 'Appliquer', back: 'Retour', close: 'Fermer', upToDate: 'A jour' },
    home: {
      kicker: 'NOVX Mirror',
      title: "Recevoir l'ecran de ton iPhone, proprement.",
      subtitle:
        'Lance rapidement le receiver, garde une interface claire pendant le mirroring, et retrouve les options avancees dans le menu en haut a droite.',
      receiverChip: 'Receiver',
      connectionChip: 'Connexion',
      connectionValue: "Recopie d'ecran iPhone / iPad",
      about: 'A propos',
      terms: "Conditions d'utilisation",
      opensource: 'Open Source',
      security: 'Securite',
      builtBy: 'Built by Coridor',
    },
    pages: {
      about: {
        title: 'A propos',
        intro:
          "NOVX Mirror est une alternative gratuite pour recevoir proprement l'ecran d'un iPhone ou iPad sur Windows, avec une interface simple, claire et sans friction.",
        sections: [
          {
            title: 'Vision',
            text: "L'objectif est de proposer une vraie alternative gratuite aux solutions plus lourdes ou plus limitees, avec un mirroring plus propre, plus lisible et plus utile au quotidien.",
          },
          {
            title: 'Experience',
            text: "L'app se concentre sur l'essentiel: demarrer vite, garder une fenetre propre, proposer des outils rapides, et rester agreable a utiliser meme sur de longues sessions.",
          },
        ],
      },
      terms: {
        title: "Conditions d'utilisation",
        intro:
          "NOVX Mirror est fourni tel quel, pour un usage personnel, de test ou de productivite. Utilise-le uniquement sur les appareils et reseaux que tu controles ou pour lesquels tu as l'autorisation.",
        sections: [
          {
            title: 'Usage responsable',
            text: "Ne l'utilise pas pour capturer, diffuser ou enregistrer le contenu d'autrui sans accord explicite.",
          },
          {
            title: 'Aucune garantie absolue',
            text: 'Le projet evolue encore. Certaines fonctions peuvent changer, etre ameliorees ou etre retirees au fil du temps.',
          },
        ],
      },
      opensource: {
        title: 'Open Source',
        intro:
          "NOVX Mirror s'appuie sur plusieurs briques open source pour proposer une alternative gratuite, transparente et evolutive pour le mirroring.",
        sections: [
          {
            title: 'Technologies',
            text: "Electron gere l'application desktop. UxPlay gere la reception AirPlay. GStreamer gere le pipeline multimedia.",
          },
          {
            title: 'Esprit',
            text: "Le projet cherche a rester transparent sur sa base technique et a s'appuyer sur des outils solides, connus et reutilisables, plutot qu'une solution fermee.",
          },
        ],
      },
      security: {
        title: 'Securite',
        intro:
          "La securite de base repose sur ton reseau local, le nom du receiver et les controles que tu actives dans l'app comme le code PIN.",
        sections: [
          {
            title: 'PIN et acces',
            text: "Si tu veux limiter les connexions, active le code PIN pour exiger une validation au moment de la connexion depuis l'iPhone.",
          },
          {
            title: 'Bonnes pratiques',
            text: "Utilise un reseau de confiance, evite les hotspots publics pour des sessions sensibles, et garde l'app a jour si tu l'utilises regulierement.",
          },
        ],
      },
    },
    settings: {
      title: 'Parametres',
      pendingInline: 'Modifications du receiver en attente',
      receiverTitle: 'Receiver',
      receiverSub:
        'Reglages appliques au receiver AirPlay. Si le receiver tourne deja, il sera relance automatiquement.',
      receiverName: 'Nom du receiver',
      receiverNameHint: "Visible par les iPhones dans Recopie d'ecran",
      maxFps: 'FPS maximum',
      fps: { '30': '30 fps', '60': '60 fps - Max AirPlay' },
      audio: 'Audio',
      audioHint: "Activer aussi l'audio du partage iPhone",
      pin: 'Code PIN',
      pinHint:
        'Ajoute une verification a la connexion. Quand un iPhone se connecte, il devra saisir ce code PIN.',
      pinCode: 'Code PIN (4 chiffres)',
      pinCodeHint:
        "Entre ici le code fixe a saisir sur l'iPhone au moment de la connexion au receiver.",
      appTitle: 'Application',
      appSub:
        "Reglages de confort de l'application elle-meme. Pas besoin de relancer l'application.",
      appAutoSave: 'Ces reglages se sauvegardent automatiquement.',
      theme: 'Theme',
      themeHint: "Change uniquement l'apparence de l'application et du mini panneau.",
      themeLight: 'Light',
      themeDark: 'Dark',
      themeMidnight: 'Midnight',
      language: 'Langue',
      languageHint: "Change la langue de l'application et du mini panneau.",
      languageFrench: 'Francais',
      languageEnglish: 'English',
      languageGerman: 'Deutsch',
      screenshotFolder: 'Dossier screenshots',
      screenshotFolderHint: "Choisis ou l'application enregistre les captures.",
      screenshotFolderChoose: 'Choisir',
      screenshotFolderDefault: 'Par defaut',
      screenshotSaved: 'Capture enregistree',
      signoff: 'Made with heart by Coridor',
      autoStart: 'Demarrage auto',
      autoStartHint: "Lancer directement le receiver quand l'application s'ouvre",
      minimizeToTray: 'Reduire dans le tray',
      minimizeToTrayHint: 'Fermer = masquer (reste actif)',
      connectBehavior: 'A la connexion',
      connectBehaviorHint: 'Ce que fait la fenetre quand un iPhone se connecte',
      connectBehaviorHide: 'Masquer la fenetre',
      connectBehaviorKeep: 'Garder ouverte (afficher les stats)',
      appliedFeedback: 'Parametres appliques au receiver.',
      receiverRestarted: 'Receiver relance avec les nouveaux reglages',
    },
    logs: {
      title: 'Logs UxPlay',
      copy: 'Copier',
      copied: 'Copie',
      clear: 'Effacer',
      top: 'Haut',
      bottom: 'Bas',
      waiting: 'En attente de logs...',
      cleared: 'Logs effaces',
    },
    error: {
      title: 'Erreur',
      details: 'Details',
      genericReceiver: 'Le receiver a rencontre un souci. Voir les details ou les logs.',
      pinInvalid: 'Le code PIN doit etre compose de 4 chiffres.',
      videoRouteTitle: "L'app est passee en lecture video AirPlay (TikTok/YouTube plein ecran).",
      videoRouteDetail:
        "En plein ecran, iOS arrete le mirroring et bascule en lecture video AirPlay : sur un recepteur tiers l'image n'est pas transmise (souvent ecran noir, audio seul). Repasse la video en mode normal/feed pour retrouver le mirroring. Les contenus proteges (DRM) restent noirs par design Apple.",
      recordFailed: "L'enregistrement de l'ecran a echoue.",
    },
    confirm: {
      title: 'Modifications non appliquees',
      text: 'Tu as des changements du receiver en attente. Veux-tu les annuler ou les appliquer avant de quitter cette page ?',
      cancel: 'Annuler les modifications',
    },
    toggle: { title: 'Demarrer / Arreter', start: 'Demarrer', stop: 'Arreter' },
    device: { disconnect: 'Deconnecter', disconnectShort: 'Deco' },
    hint: {
      windowVsFullscreen: 'Fenetre normale pour usage quotidien, plein ecran pour TikTok & videos',
    },
    status: {
      stopped: {
        label: 'Receiver arrete',
        sub: 'Appuie sur le bouton play pour lancer le receiver',
      },
      starting: { label: 'Preparation de la connexion', sub: 'Initialisation du receiver AirPlay' },
      waiting: { label: 'En attente', sub: "Visible dans Recopie d'ecran" },
      connected: {
        label: 'Connecte',
        sub: 'Session en cours',
        withDevice: 'Connecte - {{device}}',
      },
      error: { label: 'Erreur', sub: 'Voir les details ou les logs' },
    },
    bonjour: {
      title: 'Apple Bonjour requis',
      desc: "Necessaire pour que ton iPhone detecte NOVX Mirror dans Recopie d'ecran.",
      cta: 'Installer Bonjour',
      installing: 'Installation en cours…',
      success: 'Installe. Relance NOVX Mirror',
      failed: 'Echec. Telecharge manuellement',
      successTitle: 'Installe avec succes',
      successRestart: 'NOVX Mirror redemarre dans {{n}}s',
      alt: 'ou telecharger depuis Apple',
      dismiss: 'Deja installe ? Relancer NOVX Mirror',
    },
    stats: {
      live: 'EN DIRECT',
      duration: 'Duree',
      resolution: 'Resolution',
      fps: 'Framerate',
      codec: 'Codec',
      bandwidth: 'Debit',
      latency: 'Latence',
      loss: 'Pertes',
      audio: 'Audio',
      connection: 'Connexion',
      record: 'Enregistrer',
      recordStop: 'Arreter',
      recordSaved: 'Video enregistree',
    },
  },
  en: {
    meta: { title: 'NOVX Mirror' },
    titlebar: {
      minimize: 'Minimize to taskbar',
      maximize: 'Maximize window',
      close: 'Hide to system tray',
    },
    nav: { home: 'Home', settings: 'Settings', logs: 'Logs' },
    common: { apply: 'Apply', back: 'Back', close: 'Close', upToDate: 'Up to date' },
    home: {
      kicker: 'NOVX Mirror',
      title: 'Receive your iPhone screen, cleanly.',
      subtitle:
        'Start the receiver quickly, keep a clear interface during mirroring, and find advanced options in the top-right menu.',
      receiverChip: 'Receiver',
      connectionChip: 'Connection',
      connectionValue: 'iPhone / iPad screen mirroring',
      about: 'About',
      terms: 'Terms of Use',
      opensource: 'Open Source',
      security: 'Security',
      builtBy: 'Built by Coridor',
    },
    pages: {
      about: {
        title: 'About',
        intro:
          'NOVX Mirror is a free alternative for receiving an iPhone or iPad screen on Windows, with a cleaner, simpler interface.',
        sections: [
          {
            title: 'Vision',
            text: 'The goal is to provide a real free alternative to heavier or more limited solutions, with mirroring that feels cleaner, easier to read, and more useful every day.',
          },
          {
            title: 'Experience',
            text: 'The app focuses on the essentials: start fast, keep the window clean, offer quick tools, and remain pleasant to use during long sessions.',
          },
        ],
      },
      terms: {
        title: 'Terms of Use',
        intro:
          'NOVX Mirror is provided as-is for personal, testing, or productivity use. Use it only on devices and networks you control or are authorized to use.',
        sections: [
          {
            title: 'Responsible use',
            text: 'Do not use it to capture, stream, or record content belonging to others without explicit permission.',
          },
          {
            title: 'No absolute warranty',
            text: 'The project is still evolving. Some features may change, improve, or be removed over time.',
          },
        ],
      },
      opensource: {
        title: 'Open Source',
        intro:
          'NOVX Mirror relies on several open-source building blocks to provide a free, transparent, and extensible mirroring alternative.',
        sections: [
          {
            title: 'Technologies',
            text: 'Electron powers the desktop shell. UxPlay handles AirPlay reception. GStreamer handles the media pipeline.',
          },
          {
            title: 'Approach',
            text: 'The project aims to stay transparent about its technical foundation and to rely on proven, reusable tools instead of a closed solution.',
          },
        ],
      },
      security: {
        title: 'Security',
        intro:
          'Baseline security depends on your local network, the receiver name, and the controls you enable in the app such as the PIN code.',
        sections: [
          {
            title: 'PIN and access',
            text: 'If you want to limit connections, enable the PIN code to require validation when an iPhone connects.',
          },
          {
            title: 'Best practices',
            text: 'Use a trusted network, avoid public hotspots for sensitive sessions, and keep the app updated if you use it regularly.',
          },
        ],
      },
    },
    settings: {
      title: 'Settings',
      pendingInline: 'Receiver changes pending',
      receiverTitle: 'Receiver',
      receiverSub:
        'Settings applied to the AirPlay receiver. If it is already running, it will restart automatically.',
      receiverName: 'Receiver name',
      receiverNameHint: 'Visible on iPhones in Screen Mirroring',
      maxFps: 'Max FPS',
      fps: { '30': '30 fps', '60': '60 fps - AirPlay max' },
      audio: 'Audio',
      audioHint: 'Also enable audio from iPhone mirroring',
      pin: 'PIN code',
      pinHint:
        'Adds verification to the connection. When an iPhone connects, it must enter this PIN code.',
      pinCode: 'PIN code (4 digits)',
      pinCodeHint:
        'Enter the fixed code that must be typed on the iPhone when it connects to the receiver.',
      appTitle: 'Application',
      appSub: 'Comfort settings for the app itself. No need to restart the application.',
      appAutoSave: 'These settings are saved automatically.',
      theme: 'Theme',
      themeHint: 'Only changes the appearance of the app and mini panel.',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeMidnight: 'Midnight',
      language: 'Language',
      languageHint: 'Changes the language of the app and mini panel.',
      languageFrench: 'French',
      languageEnglish: 'English',
      languageGerman: 'German',
      screenshotFolder: 'Screenshots folder',
      screenshotFolderHint: 'Choose where the app saves screenshots.',
      screenshotFolderChoose: 'Choose',
      screenshotFolderDefault: 'Default',
      screenshotSaved: 'Screenshot saved',
      signoff: 'Made with heart by Coridor',
      autoStart: 'Auto start',
      autoStartHint: 'Start the receiver automatically when the app opens',
      minimizeToTray: 'Minimize to tray',
      minimizeToTrayHint: 'Close = hide (stays active)',
      connectBehavior: 'On connection',
      connectBehaviorHint: 'What the window does when an iPhone connects',
      connectBehaviorHide: 'Hide the window',
      connectBehaviorKeep: 'Keep open (show live stats)',
      appliedFeedback: 'Receiver settings applied.',
      receiverRestarted: 'Receiver restarted with new settings',
    },
    logs: {
      title: 'UxPlay Logs',
      copy: 'Copy',
      copied: 'Copied',
      clear: 'Clear',
      top: 'Top',
      bottom: 'Bottom',
      waiting: 'Waiting for logs...',
      cleared: 'Logs cleared',
    },
    error: {
      title: 'Error',
      details: 'Details',
      genericReceiver: 'The receiver ran into an issue. See details or logs.',
      pinInvalid: 'The PIN code must contain exactly 4 digits.',
      videoRouteTitle: 'The app switched to AirPlay video playback (TikTok/YouTube fullscreen).',
      videoRouteDetail:
        "In fullscreen, iOS stops mirroring and switches to AirPlay video playback: on a third-party receiver the picture isn't sent (often a black screen, audio only). Switch the video back to normal/feed mode to restore mirroring. Protected (DRM) content stays black by Apple design.",
      recordFailed: 'Screen recording failed.',
    },
    confirm: {
      title: 'Pending changes',
      text: 'You have receiver changes waiting. Do you want to discard them or apply them before leaving this page?',
      cancel: 'Discard changes',
    },
    toggle: { title: 'Start / Stop', start: 'Start', stop: 'Stop' },
    device: { disconnect: 'Disconnect', disconnectShort: 'Stop' },
    hint: { windowVsFullscreen: 'Windowed mode for daily use, fullscreen for TikTok & videos' },
    status: {
      stopped: { label: 'Receiver stopped', sub: 'Press the play button to start the receiver' },
      starting: { label: 'Preparing connection', sub: 'Initializing the AirPlay receiver' },
      waiting: { label: 'Waiting', sub: 'Visible in Screen Mirroring' },
      connected: {
        label: 'Connected',
        sub: 'Session in progress',
        withDevice: 'Connected - {{device}}',
      },
      error: { label: 'Error', sub: 'See details or logs' },
    },
    bonjour: {
      title: 'Apple Bonjour required',
      desc: 'Required for your iPhone to detect NOVX Mirror in Screen Mirroring.',
      cta: 'Install Bonjour',
      installing: 'Installing…',
      success: 'Installed. Restart NOVX Mirror',
      failed: 'Failed. Download manually',
      successTitle: 'Successfully installed',
      successRestart: 'NOVX Mirror restarts in {{n}}s',
      alt: 'or download from Apple',
      dismiss: 'Already installed? Restart NOVX Mirror',
    },
    stats: {
      live: 'LIVE',
      duration: 'Duration',
      resolution: 'Resolution',
      fps: 'Framerate',
      codec: 'Codec',
      bandwidth: 'Bandwidth',
      latency: 'Latency',
      loss: 'Loss',
      audio: 'Audio',
      connection: 'Connection',
      record: 'Record',
      recordStop: 'Stop',
      recordSaved: 'Video saved',
    },
  },
  de: {
    meta: { title: 'NOVX Mirror' },
    titlebar: {
      minimize: 'In die Taskleiste minimieren',
      maximize: 'Fenster maximieren',
      close: 'In den Infobereich ausblenden',
    },
    nav: { home: 'Startseite', settings: 'Einstellungen', logs: 'Logs' },
    common: { apply: 'Anwenden', back: 'Zuruck', close: 'Schliessen', upToDate: 'Aktuell' },
    home: {
      kicker: 'NOVX Mirror',
      title: 'Empfange deinen iPhone-Bildschirm, sauber.',
      subtitle:
        'Starte den Receiver schnell, behalte eine klare Oberflache wahrend des Mirroring und finde die erweiterten Optionen oben rechts.',
      receiverChip: 'Receiver',
      connectionChip: 'Verbindung',
      connectionValue: 'iPhone / iPad Bildschirmspiegelung',
      about: 'Uber',
      terms: 'Nutzungsbedingungen',
      opensource: 'Open Source',
      security: 'Sicherheit',
      builtBy: 'Built by Coridor',
    },
    pages: {
      about: {
        title: 'Uber',
        intro:
          'NOVX Mirror ist eine kostenlose Alternative, um den Bildschirm eines iPhone oder iPad unter Windows mit einer klareren und einfacheren Oberflache zu empfangen.',
        sections: [
          {
            title: 'Vision',
            text: 'Das Ziel ist es, eine echte kostenlose Alternative zu schwereren oder starker eingeschrankten Losungen zu bieten und Mirroring sauberer, lesbarer und alltagstauglicher zu machen.',
          },
          {
            title: 'Erlebnis',
            text: 'Die App konzentriert sich auf das Wesentliche: schnell starten, das Fenster sauber halten, schnelle Werkzeuge anbieten und auch bei langen Sitzungen angenehm bleiben.',
          },
        ],
      },
      terms: {
        title: 'Nutzungsbedingungen',
        intro:
          'NOVX Mirror wird wie gesehen fur private Nutzung, Tests oder Produktivitat bereitgestellt. Nutze es nur auf Geraten und Netzwerken, die du kontrollierst oder fur die du berechtigt bist.',
        sections: [
          {
            title: 'Verantwortungsvolle Nutzung',
            text: 'Nutze die App nicht, um Inhalte anderer ohne ausdruckliche Erlaubnis aufzunehmen, zu streamen oder aufzuzeichnen.',
          },
          {
            title: 'Keine absolute Garantie',
            text: 'Das Projekt entwickelt sich noch. Einige Funktionen konnen sich im Laufe der Zeit andern, verbessert oder entfernt werden.',
          },
        ],
      },
      opensource: {
        title: 'Open Source',
        intro:
          'NOVX Mirror baut fur Mirroring, Rendering und die Desktop-Oberflache auf mehreren Open-Source-Bausteinen auf, um eine kostenlose und transparente Alternative anzubieten.',
        sections: [
          {
            title: 'Technologien',
            text: 'Electron stellt die Desktop-Hulle bereit. UxPlay ubernimmt den AirPlay-Empfang. GStreamer verarbeitet die Medienpipeline.',
          },
          {
            title: 'Ansatz',
            text: 'Das Projekt will bezuglich seiner technischen Basis transparent bleiben und auf bewahrte, wiederverwendbare Werkzeuge statt auf eine geschlossene Losung setzen.',
          },
        ],
      },
      security: {
        title: 'Sicherheit',
        intro:
          'Die Grundsicherheit hangt von deinem lokalen Netzwerk, dem Namen des Receivers und den in der App aktivierten Kontrollen wie dem PIN-Code ab.',
        sections: [
          {
            title: 'PIN und Zugriff',
            text: 'Wenn du Verbindungen einschranken willst, aktiviere den PIN-Code, damit beim Verbinden eines iPhone eine Bestatigung erforderlich ist.',
          },
          {
            title: 'Empfehlungen',
            text: 'Verwende ein vertrauenswurdiges Netzwerk, vermeide offentliche Hotspots fur sensible Sitzungen und halte die App aktuell, wenn du sie regelmassig nutzt.',
          },
        ],
      },
    },
    settings: {
      title: 'Einstellungen',
      pendingInline: 'Receiver-Anderungen ausstehend',
      receiverTitle: 'Receiver',
      receiverSub:
        'Diese Einstellungen gelten fur den AirPlay-Receiver. Wenn er bereits lauft, wird er automatisch neu gestartet.',
      receiverName: 'Receiver-Name',
      receiverNameHint: 'Auf iPhones in Bildschirmspiegelung sichtbar',
      maxFps: 'Maximale FPS',
      fps: { '30': '30 fps', '60': '60 fps - AirPlay-Maximum' },
      audio: 'Audio',
      audioHint: 'Audio der iPhone-Spiegelung ebenfalls aktivieren',
      pin: 'PIN-Code',
      pinHint:
        'Fugt eine Verifizierung bei der Verbindung hinzu. Wenn ein iPhone verbindet, muss es diesen PIN-Code eingeben.',
      pinCode: 'PIN-Code (4 Ziffern)',
      pinCodeHint:
        'Gib hier den festen Code ein, der auf dem iPhone beim Verbinden mit dem Receiver eingegeben werden muss.',
      appTitle: 'Anwendung',
      appSub:
        'Komforteinstellungen fur die Anwendung selbst. Kein Neustart der Anwendung erforderlich.',
      appAutoSave: 'Diese Einstellungen werden automatisch gespeichert.',
      theme: 'Thema',
      themeHint: 'Andert nur das Aussehen der Anwendung und des Mini-Panels.',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeMidnight: 'Midnight',
      language: 'Sprache',
      languageHint: 'Andert die Sprache der Anwendung und des Mini-Panels.',
      languageFrench: 'Franzosisch',
      languageEnglish: 'Englisch',
      languageGerman: 'Deutsch',
      screenshotFolder: 'Screenshot-Ordner',
      screenshotFolderHint: 'Wahle, wo die App Screenshots speichert.',
      screenshotFolderChoose: 'Auswahlen',
      screenshotFolderDefault: 'Standard',
      screenshotSaved: 'Screenshot gespeichert',
      signoff: 'Made with heart by Coridor',
      autoStart: 'Automatisch starten',
      autoStartHint: 'Receiver automatisch starten, wenn die Anwendung geoffnet wird',
      minimizeToTray: 'In den Tray minimieren',
      minimizeToTrayHint: 'Schliessen = ausblenden (bleibt aktiv)',
      connectBehavior: 'Bei Verbindung',
      connectBehaviorHint: 'Was das Fenster macht, wenn ein iPhone verbindet',
      connectBehaviorHide: 'Fenster ausblenden',
      connectBehaviorKeep: 'Geoffnet lassen (Live-Stats zeigen)',
      appliedFeedback: 'Receiver-Einstellungen angewendet.',
      receiverRestarted: 'Receiver mit neuen Einstellungen neu gestartet',
    },
    logs: {
      title: 'UxPlay-Logs',
      copy: 'Kopieren',
      copied: 'Kopiert',
      clear: 'Leeren',
      top: 'Oben',
      bottom: 'Unten',
      waiting: 'Warte auf Logs...',
      cleared: 'Logs geleert',
    },
    error: {
      title: 'Fehler',
      details: 'Details',
      genericReceiver: 'Beim Receiver ist ein Problem aufgetreten. Siehe Details oder Logs.',
      pinInvalid: 'Der PIN-Code muss genau 4 Ziffern enthalten.',
      videoRouteTitle: 'Die App wechselte zur AirPlay-Videowiedergabe (TikTok/YouTube Vollbild).',
      videoRouteDetail:
        'Im Vollbild stoppt iOS die Spiegelung und wechselt zur AirPlay-Videowiedergabe: Auf einem Drittanbieter-Receiver wird das Bild nicht ubertragen (oft schwarzer Bildschirm, nur Ton). Schalte das Video zuruck in den Normal-/Feed-Modus, um die Spiegelung wiederherzustellen. Geschutzte (DRM) Inhalte bleiben prinzipbedingt schwarz.',
      recordFailed: 'Bildschirmaufnahme fehlgeschlagen.',
    },
    confirm: {
      title: 'Nicht angewendete Anderungen',
      text: 'Du hast ausstehende Receiver-Anderungen. Mochtest du sie verwerfen oder vor dem Verlassen dieser Seite anwenden?',
      cancel: 'Anderungen verwerfen',
    },
    toggle: { title: 'Start / Stopp', start: 'Starten', stop: 'Stoppen' },
    device: { disconnect: 'Trennen', disconnectShort: 'Stop' },
    hint: { windowVsFullscreen: 'Fenstermodus fur den Alltag, Vollbild fur TikTok & Videos' },
    status: {
      stopped: {
        label: 'Receiver gestoppt',
        sub: 'Drucke auf die Play-Taste, um den Receiver zu starten',
      },
      starting: {
        label: 'Verbindung wird vorbereitet',
        sub: 'AirPlay-Receiver wird initialisiert',
      },
      waiting: { label: 'Wartet', sub: 'Sichtbar in Bildschirmspiegelung' },
      connected: {
        label: 'Verbunden',
        sub: 'Sitzung lauft',
        withDevice: 'Verbunden - {{device}}',
      },
      error: { label: 'Fehler', sub: 'Siehe Details oder Logs' },
    },
    bonjour: {
      title: 'Apple Bonjour erforderlich',
      desc: 'Erforderlich, damit dein iPhone NOVX Mirror in der Bildschirmspiegelung erkennt.',
      cta: 'Bonjour installieren',
      installing: 'Wird installiert…',
      success: 'Installiert. Starte NOVX Mirror neu',
      failed: 'Fehlgeschlagen. Manuell herunterladen',
      successTitle: 'Erfolgreich installiert',
      successRestart: 'NOVX Mirror startet in {{n}}s neu',
      alt: 'oder von Apple herunterladen',
      dismiss: 'Bereits installiert? NOVX Mirror neu starten',
    },
    stats: {
      live: 'LIVE',
      duration: 'Dauer',
      resolution: 'Auflösung',
      fps: 'Bildrate',
      codec: 'Codec',
      bandwidth: 'Datenrate',
      latency: 'Latenz',
      loss: 'Verluste',
      audio: 'Audio',
      connection: 'Verbindung',
      record: 'Aufnehmen',
      recordStop: 'Stoppen',
      recordSaved: 'Video gespeichert',
    },
  },
};
