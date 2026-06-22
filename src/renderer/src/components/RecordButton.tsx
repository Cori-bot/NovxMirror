import { useRef, useState } from 'react';
import { useAppStore } from '../store/app';
import { useT } from '../i18n/useT';

// Enregistre la fenêtre vidéo native via getDisplayMedia + MediaRecorder. La
// sélection de la source (la fenêtre "NovX Mirror") est faite côté main par
// setDisplayMediaRequestHandler — aucun sélecteur n'est affiché à l'utilisateur.
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

  const start = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
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
      // L'utilisateur peut couper le partage depuis l'OS → on finalise proprement.
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
      className={`stats-record-btn${recording ? ' is-recording' : ''}`}
      onClick={() => {
        if (recording) stop();
        else void start();
      }}
      title={recording ? t('stats.recordStop') : t('stats.record')}
    >
      <span className="stats-record-icon" />
      {recording ? t('stats.recordStop') : t('stats.record')}
    </button>
  );
}
