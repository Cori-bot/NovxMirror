export type RecordingMime = {
  mimeType: string;
  extension: 'mp4' | 'webm';
  blobType: string;
};

const CANDIDATES: Array<{ mimeType: string; extension: 'mp4' | 'webm' }> = [
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', extension: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1.4D001E,mp4a.40.2', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm', extension: 'webm' },
];

const VIDEO_ONLY: Array<{ mimeType: string; extension: 'mp4' | 'webm' }> = [
  { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
];

function firstSupported(
  list: Array<{ mimeType: string; extension: 'mp4' | 'webm' }>,
): RecordingMime | null {
  for (const c of list) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return {
        mimeType: c.mimeType,
        extension: c.extension,
        blobType: c.extension === 'mp4' ? 'video/mp4' : 'video/webm',
      };
    }
  }
  return null;
}

/** MP4 H.264+AAC si audio présent — jamais un mime vidéo seule dans ce cas. */
export function pickRecordingMime(hasAudio = true): RecordingMime {
  if (hasAudio) {
    return (
      firstSupported(CANDIDATES) ?? {
        mimeType: 'video/webm;codecs=vp8,opus',
        extension: 'webm',
        blobType: 'video/webm',
      }
    );
  }
  return (
    firstSupported(VIDEO_ONLY) ??
    firstSupported(CANDIDATES) ?? {
      mimeType: 'video/webm',
      extension: 'webm',
      blobType: 'video/webm',
    }
  );
}

export function liveAudioTracks(stream: MediaStream): MediaStreamTrack[] {
  return stream.getAudioTracks().filter((t) => t.readyState === 'live' && t.enabled);
}

export function hasLiveAudio(stream: MediaStream): boolean {
  return liveAudioTracks(stream).length > 0;
}
