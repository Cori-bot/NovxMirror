export type RecordingSession = {
  stop: () => Promise<{ path: string | null; hasAudio: boolean; error?: string }>;
};

function recLog(...args: unknown[]): void {
  console.info('[REC]', ...args);
}

/**
 * Native GStreamer mux (main process): UxPlay HWND via d3d11screencapturesrc
 * + WASAPI system loopback → MP4 H.264+AAC.
 */
export async function startRecordingSession(): Promise<RecordingSession> {
  recLog('start: asking main for GStreamer HWND + WASAPI loopback mux');
  const result = await window.airmirror.startRecording();
  recLog('start result', result);

  if (!result.ok) {
    const error = result.error ?? 'Unknown error';
    recLog('start FAILED', error);
    throw new Error(error);
  }

  return {
    stop: async () => {
      recLog('stop: finalize GStreamer mp4');
      const stopped = await window.airmirror.stopRecording();
      recLog('stop result', stopped);
      return stopped;
    },
  };
}
