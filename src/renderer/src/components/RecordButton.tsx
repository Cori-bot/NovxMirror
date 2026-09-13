import { useRef, useState } from 'react';
import { useAppStore } from '../store/app';
import { useT } from '../i18n/useT';
import { startRecordingSession, type RecordingSession } from '../lib/recordingCapture';

type RecPhase = 'idle' | 'starting' | 'recording';

// REC writes UxPlay HWND + WASAPI loopback via GStreamer (main process),
// not a Chromium MediaRecorder blob.
export function RecordButton() {
  const t = useT();
  const showToast = useAppStore((s) => s.showToast);
  const showError = useAppStore((s) => s.showError);
  const [phase, setPhase] = useState<RecPhase>('idle');
  const sessionRef = useRef<RecordingSession | null>(null);
  const busyRef = useRef(false);

  const start = async (): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('starting');
    try {
      const session = await startRecordingSession();
      sessionRef.current = session;
      setPhase('recording');
    } catch (e) {
      sessionRef.current = null;
      setPhase('idle');
      const errorMessage = e instanceof Error ? e.message : String(e);
      showError(t('error.recordFailed'), errorMessage);
    } finally {
      busyRef.current = false;
    }
  };

  const stop = (): void => {
    if (busyRef.current) return;
    busyRef.current = true;
    const session = sessionRef.current;
    sessionRef.current = null;
    void (async () => {
      try {
        const result = session
          ? await session.stop()
          : await window.airmirror.stopRecording();
        setPhase('idle');

        if (result.path) {
          showToast(result.hasAudio ? t('stats.recordSaved') : t('stats.recordSavedNoAudio'));
        } else {
          const error = result.error ?? 'stop failed';
          showError(t('error.recordFailed'), error);
        }
      } catch (e) {
        setPhase('idle');
        const errorMessage = e instanceof Error ? e.message : String(e);
        showError(t('error.recordFailed'), errorMessage);
      } finally {
        busyRef.current = false;
      }
    })();
  };

  const label =
    phase === 'recording'
      ? t('stats.recordStop')
      : phase === 'starting'
        ? t('stats.recordStarting')
        : t('stats.record');

  return (
    <button
      type="button"
      className={`action-btn${phase === 'recording' ? ' is-recording' : ''}${phase === 'starting' ? ' is-starting' : ''}`}
      disabled={phase === 'starting'}
      onClick={() => {
        if (phase === 'recording') stop();
        else if (phase === 'idle') void start();
      }}
    >
      <svg width={13} height={13} viewBox="0 0 24 24" aria-hidden="true">
        {phase === 'recording' ? (
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        ) : (
          <circle cx="12" cy="12" r="6" fill="#ef4444" />
        )}
      </svg>
      {label}
    </button>
  );
}
