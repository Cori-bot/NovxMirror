import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EventEmitter } from 'node:events';
import { shouldIgnoreLogLine, shouldIgnoreExpectedShutdownLine } from './logger';
import type { LogEntry, ReceiverStatus, StreamStats, UxPlayOptions, VideoCrop } from './types';

const DEFAULT_OPTIONS: UxPlayOptions = {
  name: 'NOVX Mirror',
  pin: null,
  fps: 60,
  maxWidth: 1920,
  maxHeight: 1080,
  audioEnabled: true,
  videoCrop: null,
};

const DEFAULT_CROP: VideoCrop = { left: 6, right: 6, top: 2, bottom: 0 };
const MAX_LOG_LINES = 500;

interface UxPlayStatusPayload {
  status: ReceiverStatus;
  device?: string | null;
  connectedAt?: Date | null;
  name?: string;
  message?: string;
}

export interface UxPlayEvents {
  status: [UxPlayStatusPayload];
  log: [LogEntry];
  error: [string];
  'gst-error': [string];
  'process-started': [{ pid: number | undefined }];
  'streaming-started': [{ pid: number | undefined; device: string | null }];
  'video-resolution': [{ width: number; height: number }];
  'stream-stats': [StreamStats];
  'session-start': [{ device: string | null; startedAt: Date | null }];
  'session-end': [{ device: string | null; duration: number; endedAt: Date }];
  'restart-requested': [];
  // iOS a basculé du mirroring vers la route "AirPlay video" (ex: TikTok/YouTube
  // passés en plein écran). Sans -hls, l'image n'arrive pas (audio seul).
  'video-route-switch': [];
}

type EventListener<K extends keyof UxPlayEvents> = (...args: UxPlayEvents[K]) => void;

export class UxPlayManager extends EventEmitter {
  override on<K extends keyof UxPlayEvents>(event: K, listener: EventListener<K>): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }
  override emit<K extends keyof UxPlayEvents>(event: K, ...args: UxPlayEvents[K]): boolean {
    return super.emit(event, ...args);
  }

  process: ChildProcess | null = null;
  status: ReceiverStatus = 'stopped';
  connectedDevice: string | null = null;
  connectedAt: Date | null = null;
  options: UxPlayOptions = { ...DEFAULT_OPTIONS };
  private stats: StreamStats = {
    resolution: null,
    fps: null,
    codec: null,
    audio: true,
    bytesReceived: null,
    latencyMs: null,
    packetLoss: null,
  };
  private logs: LogEntry[] = [];
  private suppressErrorsUntil = 0;
  private stoppingIntent = false;
  private startedAt: number | null = null;
  private restartCount = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  // Incrémenté à chaque start()/stop() volontaire. Le handler restart-requested
  // capture la génération courante avant le check Bonjour async et abandonne si
  // elle a changé entre-temps (stop ou start manuel pendant la fenêtre async).
  private restartGeneration = 0;
  // Timer du flush 'streaming-started' (500ms après 'begin streaming'). Stocké
  // pour pouvoir le clearer dans stop() et ne jamais émettre un pid périmé.
  private streamingTimer: ReturnType<typeof setTimeout> | null = null;
  // Buffer for partial lines arriving across stdout/stderr chunks — without
  // this, log lines split across reads silently fail to match parser regexes.
  private parseBuffer = '';
  // UxPlay 1.73+ forwards iPhone-side telemetry as Apple plist XML chunks every
  // ~1 second (encoderCurrentFPS, txUsageAvg bytes/s, rttAvg ms, lossAvg ratio,
  // …). We accumulate key/value pairs across the chunk and flush on </plist>.
  private plistInside = false;
  private plistKey: string | null = null;
  private plistData = new Map<string, number>();
  // Évite d'annoncer plusieurs fois le basculement de route vidéo par session.
  private videoRouteAnnounced = false;

  private normalizeText(value: string): string {
    return value
      .replace(/â€™|â€˜|’|‘/g, "'")
      .replace(/â€œ|â€|“|”/g, '"')
      .replace(/â€“|â€”|–|—/g, '-')
      .replace(/�/g, "'")
      .trim();
  }

  getBinaryPath(): string | null {
    const candidates = [
      join(__dirname, '..', '..', 'bin', 'uxplay.exe'),
      join(process.resourcesPath || '', 'bin', 'uxplay.exe'),
      join(dirname(process.execPath), 'bin', 'uxplay.exe'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return null;
  }

  private getBinDir(): string | null {
    const bin = this.getBinaryPath();
    return bin ? dirname(bin) : null;
  }

  private getVideoCropConfig(): VideoCrop {
    const crop = this.options.videoCrop ?? DEFAULT_CROP;
    return {
      left: Math.max(0, Number(crop.left) || DEFAULT_CROP.left),
      right: Math.max(0, Number(crop.right) || DEFAULT_CROP.right),
      top: Math.max(0, Number(crop.top) || DEFAULT_CROP.top),
      bottom: Math.max(0, Number(crop.bottom) || DEFAULT_CROP.bottom),
    };
  }

  private buildArgs(): string[] {
    const args: string[] = [];
    const crop = this.getVideoCropConfig();

    args.push('-n', this.options.name);
    args.push('-fps', String(this.options.fps));
    args.push('-s', `${this.options.maxWidth}x${this.options.maxHeight}`);
    // Tells UxPlay to print per-second video bitrate / frame rate / aspect
    // ratio lines once streaming starts. Without this flag UxPlay 1.73 stays
    // silent after "Begin streaming to GStreamer", so we have nothing to parse.
    args.push('-FPSdata');

    if (this.options.pin && this.options.pin.length === 4) {
      args.push('-pin', this.options.pin);
    }

    if (!this.options.audioEnabled) {
      args.push('-na');
    }

    args.push(
      '-vs',
      `videocrop left=${crop.left} right=${crop.right} top=${crop.top} bottom=${crop.bottom} ! d3d11videosink force-aspect-ratio=true`,
    );
    args.push('-vsync', 'no');
    args.push('-al', '0');

    return args;
  }

  start(opts: Partial<UxPlayOptions> = {}, isAutoRestart = false): boolean {
    this.restartGeneration++;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (!isAutoRestart) {
      this.restartCount = 0;
    }
    if (this.process) {
      this.stop();
    }

    Object.assign(this.options, opts);

    const bin = this.getBinaryPath();
    if (!bin) {
      this.emit(
        'error',
        'uxplay.exe introuvable dans le dossier bin/. Lance setup.ps1 en premier.',
      );
      this.status = 'error';
      this.emit('status', { status: 'error', message: 'uxplay.exe non trouvé' });
      return false;
    }

    const binDir = this.getBinDir();
    if (!binDir) return false;

    const args = this.buildArgs();
    this.addLog(`Démarrage: ${bin} ${args.join(' ')}`);

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      PATH: `${binDir};${process.env['PATH'] ?? ''}`,
      GST_PLUGIN_PATH: join(binDir, 'gstreamer-1.0'),
      GST_PLUGIN_SYSTEM_PATH: join(binDir, 'gstreamer-1.0'),
      GST_REGISTRY: join(binDir, 'gst-registry.bin'),
      GST_PLUGIN_SCANNER: '',
      // Garantit le décodage matériel GPU (Direct3D11/DXVA) en remontant le rank
      // des décodeurs d3d11 au-dessus des décodeurs logiciels (avdec_*), SANS
      // retirer le fallback software si le GPU ne supporte pas le codec.
      GST_PLUGIN_FEATURE_RANK: 'd3d11h264dec:max,d3d11h265dec:max',
      // GST_CAPS:5 suffit à voir `width=(int)N, height=(int)M` (notre source de
      // résolution). On ne met PLUS h264parse/videocrop/d3d11videosink à :5 : à
      // 60fps ça générait un volume massif de logs par frame (CPU/I/O) et des
      // dimensions parasites (textures/alignement) captées comme fausses
      // résolutions. `*:2` garde les warnings/erreurs utiles.
      GST_DEBUG: '*:2,GST_CAPS:5',
      GST_DEBUG_NO_COLOR: '1',
    };

    try {
      this.process = spawn(bin, args, { cwd: binDir, env, windowsHide: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit('error', `Impossible de lancer UxPlay: ${message}`);
      return false;
    }

    this.status = 'starting';
    this.stoppingIntent = false;
    this.startedAt = Date.now();
    this.parseBuffer = '';
    this.plistInside = false;
    this.plistKey = null;
    this.plistData.clear();
    this.videoRouteAnnounced = false;
    this.stats = {
      resolution: null,
      fps: null,
      codec: null,
      audio: this.options.audioEnabled,
      bytesReceived: null,
      latencyMs: null,
      packetLoss: null,
    };
    this.emit('stream-stats', { ...this.stats });
    this.emit('status', { status: 'starting' });
    this.emit('process-started', { pid: this.process.pid });

    const debugWrite = (prefix: string, text: string): void => {
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        if (shouldIgnoreLogLine(line)) continue;
        process.stderr.write(`${prefix} ${line}\n`);
      }
    };

    this.process.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      debugWrite('[uxplay/out]', text);
      this.addLog(text);
      this.parseOutput(text);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      debugWrite('[uxplay/err]', text);
      this.addLog(text);
      this.parseOutput(text);
    });

    this.process.on('close', (code) => {
      const wasIntentional = this.stoppingIntent;
      const uptimeMs = this.startedAt ? Date.now() - this.startedAt : Infinity;

      this.addLog(`UxPlay terminé (code ${String(code)})`);
      this.process = null;
      this.connectedDevice = null;
      this.connectedAt = null;
      this.stoppingIntent = false;
      this.startedAt = null;

      if (wasIntentional) return;

      if (this.status !== 'error') {
        this.status = 'stopped';
        this.emit('status', { status: 'stopped' });
      }

      if (uptimeMs < 20_000) {
        this.restartCount++;
        if (this.restartCount === 1) {
          this.emit(
            'error',
            "Le receiver s'est arrêté prématurément. Vérifie que le service Bonjour (Apple) est installé et actif, que le pare-feu Windows autorise uxplay.exe, et que l'iPhone est sur le même réseau WiFi.",
          );
        }
        if (this.restartCount <= 2) {
          const delay = this.restartCount * 4000;
          this.addLog(
            `Redémarrage automatique dans ${String(delay / 1000)}s (tentative ${String(this.restartCount)}/2)...`,
          );
          this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            if (this.status === 'stopped') this.emit('restart-requested');
          }, delay);
        } else {
          this.addLog(
            "Trop d'échecs consécutifs. Lance le receiver manuellement et consulte les logs.",
          );
        }
      } else {
        this.restartCount = 0;
      }
    });

    this.process.on('error', (err) => {
      this.addLog(`Erreur processus: ${err.message}`);
      this.emit('error', err.message);
    });

    return true;
  }

  private parseOutput(text: string): void {
    // Concatenate with carry-over from the previous chunk, then split.
    // Anything after the last newline is a partial line — keep it for next call.
    const combined = this.parseBuffer + text;
    const newlineIdx = combined.lastIndexOf('\n');
    if (newlineIdx === -1) {
      this.parseBuffer = combined;
      return;
    }
    this.parseBuffer = combined.slice(newlineIdx + 1);
    const lines = combined
      .slice(0, newlineIdx)
      .split(/\r?\n/)
      .filter((l) => l.trim());

    for (const line of lines) {
      // Plist lines don't contain anything our other regexes would want to
      // match (no "fps", "Hz", "WxH" outside the data tags), and consuming
      // them here keeps the plist state machine clean.
      if (this.handlePlistLine(line)) continue;

      const lower = line.toLowerCase();

      if (
        lower.includes('server started') ||
        lower.includes('airplay server') ||
        lower.includes('listening') ||
        lower.includes('waiting') ||
        lower.includes('bonjour') ||
        lower.includes('mdns') ||
        lower.includes('avahi') ||
        lower.includes('initialized server socket') ||
        lower.includes('server socket') ||
        lower.includes('registered') ||
        lower.includes('airplay2') ||
        lower.includes('begin listening')
      ) {
        if (this.status === 'starting' || this.status === 'stopped') {
          this.status = 'waiting';
          this.emit('status', { status: 'waiting', name: this.options.name });
        }
      }

      const connPatterns = [
        /connection\s+request\s+from\s+(.+)/i,
        /connection\s+from\s+(.+)/i,
        /client\s+connected[:\s]+(.+)/i,
        /new\s+client[:\s]+(.+)/i,
        /device[:\s]+(.+?)\s+connected/i,
        /airplay.*from\s+(.+)/i,
      ];

      // GST_CAPS=4 emits lines like
      //   "video/x-raw, format=(string)NV12, width=(int)1920, height=(int)1080,…"
      // That's our authoritative resolution source. Also keep the looser
      // WxH / width=N height=M patterns as a safety net for older formats.
      const resPatterns = [
        /width=\(int\)(\d+),\s*height=\(int\)(\d+)/,
        /\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/,
        /width[=:\s]+(\d{3,4})[^0-9]+height[=:\s]+(\d{3,4})/i,
      ];
      for (const pat of resPatterns) {
        const m = line.match(pat);
        if (m && m[1] && m[2]) {
          const w = parseInt(m[1], 10);
          const h = parseInt(m[2], 10);
          if (w >= 240 && h >= 240 && w <= 7680 && h <= 7680) {
            const same =
              this.stats.resolution?.width === w && this.stats.resolution?.height === h;
            if (!same) {
              this.emit('video-resolution', { width: w, height: h });
              this.updateStats({ resolution: { width: w, height: h } });
            }
            break;
          }
        }
      }

      const codecMatch = line.match(/\b(h\.?264|h\.?265|hevc|avc|vp8|vp9)\b/i);
      if (codecMatch && codecMatch[1]) {
        const raw = codecMatch[1].toLowerCase().replace('.', '');
        const codec =
          raw === 'avc' ? 'H.264' : raw === 'hevc' ? 'H.265' : raw.toUpperCase().replace('H', 'H.');
        if (codec !== this.stats.codec) {
          this.updateStats({ codec });
        }
      }

      // UxPlay -FPSdata output:
      //   "video frame rate is 59.7 fps; aspect ratio = 1.778"
      //   "video stream rate is 12.345 Mbps"
      // Also handles older "frame rate: 60", "60 fps", and modern "@ 60 Hz".
      const fpsMatch =
        line.match(/\bframe[\s-]?rate[=:\s]+(?:is\s+)?(\d{2,3}(?:\.\d+)?)/i) ??
        line.match(/\b(\d{2,3}(?:\.\d+)?)\s*fps\b/i) ??
        line.match(/@\s*(\d{2,3})\s*Hz\b/i);
      if (fpsMatch && fpsMatch[1]) {
        const fps = Math.round(parseFloat(fpsMatch[1]));
        if (fps >= 24 && fps <= 240 && fps !== this.stats.fps) {
          this.updateStats({ fps });
        }
      }

      // -FPSdata bitrate line is the most accurate bandwidth source — it's the
      // actual decoded video rate, not the noisy TCP-level wmic read counter.
      const rateMatch = line.match(/stream\s+rate\s+is\s+(\d+(?:\.\d+)?)\s*mbps/i);
      if (rateMatch && rateMatch[1]) {
        const mbps = parseFloat(rateMatch[1]);
        const bps = Math.round((mbps * 1_000_000) / 8);
        if (bps > 0) this.updateStats({ bytesReceived: bps });
      }

      if (lower.includes('begin streaming to gstreamer')) {
        const proc = this.process;
        const pid = proc?.pid;
        if (this.streamingTimer) clearTimeout(this.streamingTimer);
        this.streamingTimer = setTimeout(() => {
          this.streamingTimer = null;
          // N'émet que si c'est toujours le MÊME process qui a loggé la ligne :
          // un stop/restart rapide aurait pu remplacer this.process entre-temps.
          if (this.process === proc && pid != null) {
            this.emit('streaming-started', { pid, device: this.connectedDevice });
          }
        }, 500);
      }

      // Basculement mirroring → AirPlay video (TikTok/YouTube en plein écran) :
      // UxPlay reçoit une requête de lecture vidéo. Sans -hls, l'image n'arrive
      // pas. On prévient l'UI une fois par session.
      if (
        !this.videoRouteAnnounced &&
        (line.includes('POST /play') ||
          lower.includes('content-location') ||
          lower.includes('fcup_request'))
      ) {
        this.videoRouteAnnounced = true;
        this.emit('video-route-switch');
      }

      for (const pattern of connPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const deviceRaw = this.normalizeText(match[1]);
          const deviceName =
            this.normalizeText(
              deviceRaw
                .replace(/\s*\(.*?\)/g, '')
                .replace(/\s+with\s+.*/i, '')
                .replace(/\s+with\s*$/i, '')
                .replace(/\s*\[.*?\]/g, '')
                .replace(/\s+\d+\.\d+\.\d+\.\d+.*$/, '')
                .trim(),
            ) || 'Appareil inconnu';

          this.connectedDevice = deviceName;
          this.connectedAt = new Date();
          this.status = 'connected';
          // Nouvelle connexion → réarme la détection de basculement vidéo.
          this.videoRouteAnnounced = false;
          this.emit('status', {
            status: 'connected',
            device: this.connectedDevice,
            connectedAt: this.connectedAt,
          });
          this.emit('session-start', {
            device: this.connectedDevice,
            startedAt: this.connectedAt,
          });
          break;
        }
      }

      if (
        (lower.includes('disconnect') ||
          lower.includes('closed') ||
          lower.includes('lost connection')) &&
        this.status === 'connected'
      ) {
        const duration = this.connectedAt
          ? Math.round((Date.now() - this.connectedAt.getTime()) / 1000)
          : 0;

        this.emit('session-end', {
          device: this.connectedDevice,
          duration,
          endedAt: new Date(),
        });

        this.connectedDevice = null;
        this.connectedAt = null;
        this.status = 'waiting';
        this.emit('status', { status: 'waiting', name: this.options.name });
      }

      if (
        lower.includes('dnssd') &&
        (lower.includes('error') ||
          lower.includes('fail') ||
          lower.includes('connection problem') ||
          lower.includes('returned -')) &&
        !this.stoppingIntent &&
        Date.now() >= this.suppressErrorsUntil
      ) {
        this.emit(
          'error',
          'Erreur Bonjour/mDNS : le service Apple Bonjour doit être installé et actif. Installe iTunes (inclut Bonjour) et autorise uxplay.exe dans le pare-feu Windows.',
        );
      }

      if (lower.includes('error') && (lower.includes('gst') || lower.includes('pipeline'))) {
        if (this.stoppingIntent || Date.now() < this.suppressErrorsUntil) {
          continue;
        }
        this.emit('gst-error', line.trim());
      }
    }
  }

  private addLog(text: string): void {
    const lines = String(text || '').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim().replace(/-pin\s+\S+/gi, '-pin ****');
      if (shouldIgnoreLogLine(line)) continue;
      if (
        (this.stoppingIntent || Date.now() < this.suppressErrorsUntil) &&
        shouldIgnoreExpectedShutdownLine(line)
      ) {
        continue;
      }

      const entry: LogEntry = {
        time: new Date().toLocaleTimeString('fr-FR'),
        text: line,
      };
      this.logs.push(entry);
      if (this.logs.length > MAX_LOG_LINES) this.logs.shift();
      this.emit('log', entry);
    }
  }

  private updateStats(patch: Partial<StreamStats>): void {
    this.stats = { ...this.stats, ...patch };
    this.emit('stream-stats', { ...this.stats });
  }

  // Process one line of UxPlay's forwarded iPhone telemetry plist. Returns
  // true if the line was part of a plist (so the outer parser should skip its
  // other regexes for that line).
  private handlePlistLine(line: string): boolean {
    const t = line.trim();
    if (t.startsWith('<plist')) {
      this.plistInside = true;
      this.plistKey = null;
      this.plistData.clear();
      return true;
    }
    if (!this.plistInside) return false;
    if (t.startsWith('</plist>')) {
      this.plistInside = false;
      this.applyPlistStats();
      this.plistKey = null;
      return true;
    }
    const keyMatch = t.match(/^<key>(.+?)<\/key>$/);
    if (keyMatch && keyMatch[1]) {
      this.plistKey = keyMatch[1];
      return true;
    }
    const valMatch = t.match(/^<(integer|real)>(.+?)<\/\1>$/);
    if (valMatch && valMatch[2] && this.plistKey) {
      const num = parseFloat(valMatch[2]);
      if (Number.isFinite(num)) this.plistData.set(this.plistKey, num);
      this.plistKey = null;
      return true;
    }
    // Inside a plist, swallow only true XML-shaped lines (<dict>, <!DOCTYPE…>,
    // <?xml…>). Anything else is most likely GST_DEBUG output from stderr
    // interleaving with stdout — let the other parsers see it.
    if (t.startsWith('<') || t.startsWith('?')) return true;
    return false;
  }

  private applyPlistStats(): void {
    const fps = this.plistData.get('encoderCurrentFPS');
    const tx = this.plistData.get('txUsageAvg');
    const rtt = this.plistData.get('rttAvg');
    const loss = this.plistData.get('lossAvg');
    const patch: Partial<StreamStats> = {};
    if (typeof fps === 'number' && fps > 0) patch.fps = Math.round(fps);
    if (typeof tx === 'number' && tx > 0) patch.bytesReceived = Math.round(tx);
    if (typeof rtt === 'number' && rtt >= 0) patch.latencyMs = Math.round(rtt);
    if (typeof loss === 'number' && loss >= 0) patch.packetLoss = loss;
    if (Object.keys(patch).length) this.updateStats(patch);
  }

  getStats(): StreamStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.plistInside = false;
    this.plistKey = null;
    this.plistData.clear();
    this.stats = {
      resolution: null,
      fps: null,
      codec: null,
      audio: this.options.audioEnabled,
      bytesReceived: null,
      latencyMs: null,
      packetLoss: null,
    };
    this.emit('stream-stats', { ...this.stats });
  }

  stop(): void {
    this.restartGeneration++;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.streamingTimer) {
      clearTimeout(this.streamingTimer);
      this.streamingTimer = null;
    }
    this.restartCount = 0;
    if (this.process) {
      this.stoppingIntent = true;
      this.suppressErrorsUntil = Date.now() + 4000;
      const proc = this.process;
      const pid = proc.pid;
      if (pid != null) {
        // Async (execFile) pour ne PAS bloquer l'event loop / l'UI pendant le
        // taskkill /T qui parcourt l'arbre de process GStreamer (100-500ms+).
        execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, (err) => {
          if (err) {
            try {
              proc.kill();
            } catch {
              // process déjà mort — rien à faire
            }
          }
        });
      }
      this.process = null;
    }
    this.connectedDevice = null;
    this.connectedAt = null;
    this.status = 'stopped';
    this.resetStats();
    this.emit('status', { status: 'stopped' });
  }

  isRunning(): boolean {
    return this.process !== null && this.status !== 'stopped' && this.status !== 'error';
  }

  // Jeton d'intention : change à chaque start()/stop() volontaire. Permet au
  // handler restart-requested d'abandonner si l'utilisateur a agi pendant le
  // check Bonjour async.
  getRestartGeneration(): number {
    return this.restartGeneration;
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  getStatus(): {
    status: ReceiverStatus;
    device: string | null;
    connectedAt: Date | null;
    name: string;
    options: UxPlayOptions;
    binaryFound: boolean;
  } {
    return {
      status: this.status,
      device: this.connectedDevice,
      connectedAt: this.connectedAt,
      name: this.options.name,
      options: this.options,
      binaryFound: !!this.getBinaryPath(),
    };
  }
}

export const uxplay = new UxPlayManager();
