import { app } from 'electron';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function gstPluginDir(binDir: string): string {
  return join(binDir, 'gstreamer-1.0');
}

export function gstRegistryPath(binDir: string): string {
  // Registry lives in userData (writable). Hash binDir so a packed install never
  // reuses a dev-machine registry with stale absolute plugin paths. `|riff1`
  // busts registries that blacklisted libgstisomp4 while libgstriff-1.0-0.dll
  // was missing from bin/.
  const tag = createHash('sha1')
    .update(`${binDir.toLowerCase()}|riff1`)
    .digest('hex')
    .slice(0, 8);
  return join(app.getPath('userData'), `gst-registry-${tag}.bin`);
}

/** Disk presence of muxer plugins and the helper DLLs they import from bin/. */
export function describeGstMuxRuntime(binDir: string): string[] {
  const pluginDir = gstPluginDir(binDir);
  const checks: Array<[string, string]> = [
    ['libgstriff-1.0-0.dll', join(binDir, 'libgstriff-1.0-0.dll')],
    ['libgstisomp4.dll', join(pluginDir, 'libgstisomp4.dll')],
    ['libgstlibav.dll', join(pluginDir, 'libgstlibav.dll')],
    ['libgstmpegtsmux.dll', join(pluginDir, 'libgstmpegtsmux.dll')],
    ['libgstmpegts-1.0-0.dll', join(binDir, 'libgstmpegts-1.0-0.dll')],
  ];
  return checks.map(([name, path]) => `${name}: ${existsSync(path) ? 'yes' : 'NO'}`);
}

/** Shared GStreamer env for UxPlay and the REC side-mux (same plugin tree / registry). */
export function buildGstEnv(binDir: string, debug = '*:2,GST_CAPS:5'): Record<string, string> {
  return {
    ...(process.env as Record<string, string>),
    PATH: `${binDir};${process.env['PATH'] ?? ''}`,
    GST_PLUGIN_PATH: gstPluginDir(binDir),
    GST_PLUGIN_SYSTEM_PATH: gstPluginDir(binDir),
    GST_REGISTRY: gstRegistryPath(binDir),
    GST_PLUGIN_SCANNER: '',
    GST_PLUGIN_FEATURE_RANK: 'd3d11h264dec:max,d3d11h265dec:max',
    GST_DEBUG: debug,
    GST_DEBUG_NO_COLOR: '1',
  };
}

export function findGstTool(binDir: string, filename: string): string | null {
  const path = join(binDir, filename);
  return existsSync(path) ? path : null;
}
