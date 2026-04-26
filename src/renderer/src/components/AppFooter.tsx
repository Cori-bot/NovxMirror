import { useAppStore } from '../store/app';

export function AppFooter() {
  const version = useAppStore((s) => s.version);
  return (
    <div className="app-footer">
      <div className="app-footer-meta">
        <div className="version-badge">v{version}</div>
      </div>
    </div>
  );
}
