import { readFileSync } from 'node:fs';

export type Mp4AudioProbe = {
  hasAudio: boolean;
  hasVideo: boolean;
  handlers: string[];
};

function boxType(buf: Buffer, offset: number): string {
  return buf.toString('ascii', offset + 4, offset + 8);
}

function walk(
  buf: Buffer,
  start: number,
  end: number,
  visit: (type: string, payloadStart: number, payloadEnd: number) => void,
): void {
  let off = start;
  while (off + 8 <= end) {
    let size = buf.readUInt32BE(off);
    let header = 8;
    if (size === 1) {
      if (off + 16 > end) break;
      const big = buf.readBigUInt64BE(off + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      size = end - off;
    }
    if (size < header || off + size > end) break;
    visit(boxType(buf, off), off + header, off + size);
    off += size;
  }
}

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'moof', 'traf', 'edts']);

/**
 * True when the MP4 declares a sound track (soun / mp4a / smhd).
 * Used to keep the recordSavedNoAudio toast honest.
 */
export function probeMp4Audio(filePath: string): Mp4AudioProbe {
  const buf = readFileSync(filePath);
  const handlers: string[] = [];
  let hasAudio = false;
  let hasVideo = false;

  const visit = (type: string, payloadStart: number, payloadEnd: number): void => {
    if (type === 'hdlr' && payloadStart + 12 <= payloadEnd) {
      const handler = buf.toString('ascii', payloadStart + 8, payloadStart + 12);
      handlers.push(handler);
      if (handler === 'soun') hasAudio = true;
      if (handler === 'vide') hasVideo = true;
    }
    if (type === 'smhd') hasAudio = true;
    if (type === 'mp4a' || type === 'Opus' || type === 'opus' || type === 'alac') {
      hasAudio = true;
    }
    if (CONTAINERS.has(type)) {
      walk(buf, payloadStart, payloadEnd, visit);
    }
  };

  walk(buf, 0, buf.length, visit);
  return { hasAudio, hasVideo, handlers };
}
