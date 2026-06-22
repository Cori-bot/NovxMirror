export function shouldIgnoreLogLine(line: string): boolean {
  const normalized = String(line || '').trim();
  if (!normalized) return true;

  const lower = normalized.toLowerCase();

  if (
    lower.includes('gstreamer-warning') &&
    lower.includes('failed to load plugin') &&
    lower.includes('gstreamer-1.0')
  ) {
    return true;
  }

  if (
    lower.includes(
      'this usually means windows was unable to find a dll dependency of the plugin',
    ) ||
    lower.includes('please check that path is correct') ||
    lower.includes("you can run 'dumpbin -dependents'") ||
    lower.includes(
      'there are also some third-party guis to list and debug dll dependencies recursively',
    )
  ) {
    return true;
  }

  // GST_DEBUG=GST_CAPS:4 spams timestamped caps-negotiation lines (e.g.
  // "0:00:01.234567890  1234 0x... INFO              GST_CAPS gstcaps.c:…").
  // We grep them for resolution in the parser; suppress them from the log
  // viewer to keep it readable.
  if (/^\d:\d{2}:\d{2}\.\d+/.test(normalized) && lower.includes('gst_caps')) {
    return true;
  }

  return false;
}

export function shouldIgnoreExpectedShutdownLine(line: string): boolean {
  const lower = String(line || '')
    .trim()
    .toLowerCase();
  if (!lower) return true;

  if (lower.includes('output window was closed')) return true;
  if (lower.includes('connection closed on socket')) return true;
  if (lower.includes('raop_rtp_mirror->running is no longer true')) return true;

  return false;
}
