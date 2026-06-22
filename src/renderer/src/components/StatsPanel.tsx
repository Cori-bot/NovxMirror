import { useAppStore } from '../store/app';
import { useTimer } from '../hooks/useTimer';
import { useT } from '../i18n/useT';
import { RecordButton } from './RecordButton';

interface StatProps {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}

function Stat({ label, value, hint, accent }: StatProps) {
  return (
    <div className={`stat-card${accent ? ' is-accent' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

export function StatsPanel() {
  const t = useT();
  const status = useAppStore((s) => s.status);
  const statusData = useAppStore((s) => s.statusData);
  const stats = useAppStore((s) => s.streamStats);

  const elapsed = useTimer(status === 'connected' ? (statusData.connectedAt ?? null) : null);

  if (status !== 'connected') return null;

  const resolutionText = stats.resolution
    ? `${String(stats.resolution.width)} × ${String(stats.resolution.height)}`
    : '—';
  const fpsText = stats.fps ? `${String(stats.fps)} fps` : '—';
  const bandwidthText = formatBandwidth(stats.bytesReceived);
  const latencyText =
    stats.latencyMs !== null && stats.latencyMs >= 0 ? `${String(stats.latencyMs)} ms` : '—';
  const lossText = formatLoss(stats.packetLoss);

  return (
    <div className="stats-panel">
      <div className="stats-header">
        <div className="stats-pulse-dot" />
        <span className="stats-header-label">{t('stats.live')}</span>
        <span className="stats-header-device">{statusData.device ?? '—'}</span>
        <RecordButton />
      </div>
      <div className="stats-grid">
        <Stat label={t('stats.duration')} value={elapsed} accent />
        <Stat label={t('stats.resolution')} value={resolutionText} />
        <Stat label={t('stats.fps')} value={fpsText} />
        <Stat label={t('stats.bandwidth')} value={bandwidthText} />
        <Stat label={t('stats.latency')} value={latencyText} />
        <Stat label={t('stats.loss')} value={lossText} />
        <Stat label={t('stats.audio')} value={stats.audio ? 'On' : 'Off'} />
      </div>
    </div>
  );
}

function formatBandwidth(bytesPerSec: number | null): string {
  if (bytesPerSec === null || bytesPerSec <= 0) return '—';
  const mbps = (bytesPerSec * 8) / 1_000_000;
  if (mbps >= 10) return `${mbps.toFixed(0)} Mbps`;
  if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
  const kbps = (bytesPerSec * 8) / 1000;
  return `${kbps.toFixed(0)} kbps`;
}

function formatLoss(ratio: number | null): string {
  if (ratio === null || ratio < 0) return '—';
  const pct = ratio * 100;
  if (pct < 0.001) return '0%';
  if (pct < 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}
