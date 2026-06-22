import { useRef, useState } from 'react';
import { useAppStore } from '../store/app';
import { useT } from '../i18n/useT';

// Enregistre la fenêtre vidéo native via getDisplayMedia + MediaRecorder. La
// source (fenêtre "NovX Mirror") est choisie côté main par
// setDisplayMediaRequestHandler — aucun sélecteur affiché. L'audio (loopback
// système) est best-effort : s'il ne démarre pas ("Could not start audio
// source"), on bascule en vidéo seule plutôt que d'échouer l'enregistrement.
// Les contenus protégés (DRM/Snapchat/Insta) restent noirs : c'est iOS qui les
// exclut de la recopie, NOVX ne reçoit que ce flux.
export function RecordButton() {
  const t = useT();
  const showToast = useAppStore((s) => s.showToast);
  const showError = useAppStore((s) => s.showError);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cleanup = (): void => {
    streamRef.current?.getTracks().forEach((tk) => tk.stop());
    streamRef.current = null;
    recRef.current = null;
  };

  const acquireStream = async (): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch {
      // L'audio loopback peut être indisponible (aucune sortie audio active,
      // périphérique exclusif…). On réessaie sans audio.
      return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    }
  };

  const start = async (): Promise<void> => {
    try {
      const stream = await acquireStream();
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];
        cleanup();
        setRecording(false);
        void blob.arrayBuffer().then(async (buf) => {
          const path = await window.airmirror.saveRecording(new Uint8Array(buf));
          if (path) showToast(t('stats.recordSaved'));
          else showError(t('error.recordFailed'));
        });
      };
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
      });
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (e) {
      cleanup();
      setRecording(false);
      showError(t('error.recordFailed'), String(e));
    }
  };

  const stop = (): void => {
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop();
    } else {
      cleanup();
      setRecording(false);
    }
  };

  return (
    <button
      type="button"
      className={`action-btn${recording ? ' is-recording' : ''}`}
      onClick={() => {
        if (recording) stop();
        else void start();
      }}
    >
      <svg width={13} height={13} viewBox="0 0 24 24" aria-hidden="true">
        {recording ? (
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        ) : (
          <circle cx="12" cy="12" r="6" fill="#ef4444" />
        )}
      </svg>
      {recording ? t('stats.recordStop') : t('stats.record')}
    </button>
  );
}
