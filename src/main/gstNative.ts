import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import koffi from 'koffi';
import { recError, recLog, recWarn } from './recordingLog';

const LOAD_WITH_ALTERED_SEARCH_PATH = 0x00000008;

const GST_HELPER_DLLS = [
  'libglib-2.0-0.dll',
  'libgobject-2.0-0.dll',
  'libgstreamer-1.0-0.dll',
  'libgstbase-1.0-0.dll',
  'libgsttag-1.0-0.dll',
  'libgstaudio-1.0-0.dll',
  'libgstvideo-1.0-0.dll',
  'libgstpbutils-1.0-0.dll',
  'libgstrtp-1.0-0.dll',
  'libgstriff-1.0-0.dll',
];

let dllSearchReady = false;

/**
 * Plugins live in bin/gstreamer-1.0/ but import helper DLLs from bin/.
 * Electron.exe is not in bin/, so LoadLibrary would miss libgstriff and
 * isomp4 (mp4mux) would stay factory-NO. UxPlay.exe already lives in bin/.
 */
function applyDllSearchPath(binDir: string): void {
  if (dllSearchReady) return;
  const kernel32 = koffi.load('kernel32.dll');
  const SetDllDirectoryW = kernel32.func('__stdcall', 'SetDllDirectoryW', 'int', ['str16']);
  const AddDllDirectory = kernel32.func('__stdcall', 'AddDllDirectory', 'void *', ['str16']);
  const LoadLibraryExW = kernel32.func('__stdcall', 'LoadLibraryExW', 'void *', [
    'str16',
    'void *',
    'uint32',
  ]);
  const GetLastError = kernel32.func('__stdcall', 'GetLastError', 'uint32', []);

  const setOk: unknown = SetDllDirectoryW(binDir);
  const addCookie: unknown = AddDllDirectory(binDir);
  recLog(
    `dll search binDir=${binDir} SetDllDirectory=${String(setOk)} AddDllDirectory=${addCookie ? 'ok' : 'FAIL'}`,
  );

  for (const name of GST_HELPER_DLLS) {
    const path = join(binDir, name);
    if (!existsSync(path)) {
      recWarn(`helper DLL missing: ${name}`);
      continue;
    }
    const handle: unknown = LoadLibraryExW(path, null, LOAD_WITH_ALTERED_SEARCH_PATH);
    if (!handle) {
      const gle: unknown = GetLastError();
      recWarn(`LoadLibraryEx ${name} failed gle=${String(gle)}`);
    }
  }
  dllSearchReady = true;
}

const GST_STATE_NULL = 1;
const GST_STATE_PAUSED = 3;
const GST_STATE_PLAYING = 4;
/** GstStateChangeReturn — live sources typically return NO_PREROLL, not SUCCESS. */
const GST_STATE_CHANGE_FAILURE = 0;
const GST_STATE_CHANGE_SUCCESS = 1;
const GST_STATE_CHANGE_ASYNC = 2;
const GST_STATE_CHANGE_NO_PREROLL = 3;
const GST_MESSAGE_EOS = 1;
const GST_MESSAGE_ERROR = 2;
const GST_MESSAGE_WARNING = 4;
const GST_MESSAGE_CLOCK_LOST = 1 << 10;
const GST_MESSAGE_LATENCY = 1 << 19;
/** 1 second in GstClockTime (nanoseconds). */
const GST_SECOND = 1_000_000_000n;

type GstApi = {
  init: (argc: null, argv: null) => void;
  factoryFind: (name: string) => unknown;
  parseLaunch: (description: string, error: unknown) => unknown;
  setState: (element: unknown, state: number) => number;
  getState: (element: unknown, state: number[], pending: number[], timeout: bigint) => number;
  getBus: (element: unknown) => unknown;
  sendEvent: (element: unknown, event: unknown) => number;
  eventEos: () => unknown;
  busPop: (bus: unknown, timeout: bigint, types: number) => unknown;
  messageParseError: (msg: unknown, gerror: unknown[], debug: unknown[]) => void;
  messageParseWarning: (msg: unknown, gerror: unknown[], debug: unknown[]) => void;
  objectUnref: (obj: unknown) => void;
  miniUnref: (obj: unknown) => void;
  errorFree: (err: unknown) => void;
  free: (ptr: unknown) => void;
  mainContextIteration: (context: null, mayBlock: number) => number;
  recalculateLatency: (bin: unknown) => number;
  readGErrorMessage: (err: unknown) => string | null;
};

let api: GstApi | null = null;
let inited = false;

function bind(binDir: string): GstApi {
  const gstPath = join(binDir, 'libgstreamer-1.0-0.dll');
  const gobjectPath = join(binDir, 'libgobject-2.0-0.dll');
  const glibPath = join(binDir, 'libglib-2.0-0.dll');
  recLog(`koffi load ${gstPath}`);
  const gst = koffi.load(gstPath);
  const gobject = koffi.load(gobjectPath);
  const glib = koffi.load(glibPath);

  const GError = koffi.struct('GError', {
    domain: 'uint32',
    code: 'int32',
    message: 'char *',
  });

  return {
    init: gst.func('void gst_init(void *argc, void *argv)'),
    factoryFind: gst.func('void *gst_element_factory_find(str name)'),
    parseLaunch: gst.func('void *gst_parse_launch(str description, void *error)'),
    setState: gst.func('int gst_element_set_state(void *element, int state)'),
    getState: gst.func(
      'int gst_element_get_state(void *element, _Out_ int *state, _Out_ int *pending, uint64 timeout)',
    ),
    getBus: gst.func('void *gst_element_get_bus(void *element)'),
    sendEvent: gst.func('int gst_element_send_event(void *element, void *event)'),
    eventEos: gst.func('void *gst_event_new_eos()'),
    busPop: gst.func('void *gst_bus_timed_pop_filtered(void *bus, uint64 timeout, int types)'),
    messageParseError: gst.func(
      'void gst_message_parse_error(void *msg, _Out_ void **gerror, _Out_ void **debug)',
    ),
    messageParseWarning: gst.func(
      'void gst_message_parse_warning(void *msg, _Out_ void **gerror, _Out_ void **debug)',
    ),
    objectUnref: gobject.func('void g_object_unref(void *object)'),
    miniUnref: gst.func('void gst_mini_object_unref(void *object)'),
    errorFree: glib.func('void g_error_free(void *error)'),
    free: glib.func('void g_free(void *ptr)'),
    mainContextIteration: glib.func('int g_main_context_iteration(void *context, int may_block)'),
    recalculateLatency: gst.func('int gst_bin_recalculate_latency(void *bin)'),
    readGErrorMessage: (err: unknown): string | null => {
      if (!err) return null;
      try {
        const decoded = koffi.decode(err, GError) as { message?: string | null };
        return decoded.message ?? null;
      } catch {
        return null;
      }
    },
  };
}

export function initGst(binDir: string, env: Record<string, string>): void {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  applyDllSearchPath(binDir);
  if (!api) api = bind(binDir);
  if (!inited) {
    api.init(null, null);
    inited = true;
    recLog('gst_init done');
  }
}

export function gstHasElement(name: string): boolean {
  if (!api) throw new Error('GStreamer not initialized');
  const factory = api.factoryFind(name);
  if (!factory) return false;
  api.objectUnref(factory);
  return true;
}

export type GstPipelineHandle = {
  stop: () => Promise<void>;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function describeStateChange(change: number): string {
  switch (change) {
    case GST_STATE_CHANGE_FAILURE:
      return 'FAILURE';
    case GST_STATE_CHANGE_SUCCESS:
      return 'SUCCESS';
    case GST_STATE_CHANGE_ASYNC:
      return 'ASYNC';
    case GST_STATE_CHANGE_NO_PREROLL:
      return 'NO_PREROLL';
    default:
      return String(change);
  }
}

function parseBusGError(
  handle: GstApi,
  msg: unknown,
  kind: 'error' | 'warning',
): string | null {
  const gerror: unknown[] = [null];
  const debug: unknown[] = [null];
  try {
    if (kind === 'error') handle.messageParseError(msg, gerror, debug);
    else handle.messageParseWarning(msg, gerror, debug);
  } catch {
    return null;
  }
  const message = handle.readGErrorMessage(gerror[0]) ?? `GStreamer ${kind}`;
  let debugStr = '';
  if (debug[0]) {
    try {
      debugStr = koffi.decode(debug[0], 'str') as string;
    } catch {
      debugStr = '';
    }
  }
  recError(`bus ${kind}: ${message}${debugStr ? ` | ${debugStr}` : ''}`);
  if (gerror[0]) handle.errorFree(gerror[0]);
  if (debug[0]) handle.free(debug[0]);
  return message;
}

function drainBusErrors(handle: GstApi, bus: unknown): string | null {
  let last: string | null = null;
  for (;;) {
    const errMsg = handle.busPop(bus, 0n, GST_MESSAGE_ERROR);
    if (errMsg) {
      last = parseBusGError(handle, errMsg, 'error') ?? last;
      handle.miniUnref(errMsg);
      continue;
    }
    const warnMsg = handle.busPop(bus, 0n, GST_MESSAGE_WARNING);
    if (warnMsg) {
      parseBusGError(handle, warnMsg, 'warning');
      handle.miniUnref(warnMsg);
      continue;
    }
    break;
  }
  return last;
}

function fileBytes(path: string | undefined): number {
  if (!path || !existsSync(path)) return 0;
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function pumpLiveBus(handle: GstApi, pipeline: unknown, bus: unknown): string | null {
  handle.mainContextIteration(null, 0);
  const err = drainBusErrors(handle, bus);
  for (;;) {
    const latency = handle.busPop(bus, 0n, GST_MESSAGE_LATENCY);
    if (!latency) break;
    handle.recalculateLatency(pipeline);
    handle.miniUnref(latency);
  }
  const lost = handle.busPop(bus, 0n, GST_MESSAGE_CLOCK_LOST);
  if (lost) {
    handle.miniUnref(lost);
    recWarn('CLOCK_LOST — restart PLAYING');
    handle.setState(pipeline, GST_STATE_PAUSED);
    handle.setState(pipeline, GST_STATE_PLAYING);
  }
  return err;
}

/**
 * Live dual-source mux often stays PAUSED pending PLAYING until both pads
 * preroll. gst-launch handles LATENCY via gst_bin_recalculate_latency;
 * without that the pipeline never leaves preroll. If filesink is already
 * writing, treat that as success even if get_state is still ASYNC.
 */
async function waitUntilPlaying(
  handle: GstApi,
  pipeline: unknown,
  timeoutMs: number,
  tempPath?: string,
): Promise<void> {
  const bus = handle.getBus(pipeline);
  const deadline = Date.now() + timeoutMs;
  let lastState = 0;
  let lastPending = 0;
  let busError: string | null = null;

  try {
    handle.recalculateLatency(pipeline);
    while (Date.now() < deadline) {
      busError = pumpLiveBus(handle, pipeline, bus) ?? busError;
      if (busError) {
        throw new Error(busError);
      }

      const state = [0];
      const pending = [0];
      handle.getState(pipeline, state, pending, GST_SECOND / 4n);
      lastState = state[0] ?? 0;
      lastPending = pending[0] ?? 0;
      if (lastState === GST_STATE_PLAYING) return;
      if (fileBytes(tempPath) >= 2048) {
        recLog(`live mux writing (${String(fileBytes(tempPath))} bytes) — accept ASYNC`);
        return;
      }
      await delay(100);
    }
  } finally {
    handle.objectUnref(bus);
  }

  if (fileBytes(tempPath) >= 2048) {
    recLog(`live mux writing after timeout (${String(fileBytes(tempPath))} bytes)`);
    return;
  }

  const stuckPreroll = lastState === GST_STATE_PAUSED && lastPending === GST_STATE_PLAYING;
  throw new Error(
    `${stuckPreroll ? 'pipeline stuck PAUSED pending PLAYING' : `pipeline not PLAYING (state=${String(lastState)} pending=${String(lastPending)})`}${
      busError ? `; bus=${busError}` : ''
    }`,
  );
}

export async function startGstPipeline(
  description: string,
  timeoutMs = 4000,
  tempPath?: string,
): Promise<GstPipelineHandle> {
  if (!api) throw new Error('GStreamer not initialized');
  recLog(`gst_parse_launch: ${description}`);

  const pipeline = api.parseLaunch(description, null);
  if (!pipeline) {
    recError('gst_parse_launch returned null (bad element/property)');
    throw new Error('gst_parse_launch returned null (bad element/property)');
  }

  const change = api.setState(pipeline, GST_STATE_PLAYING);
  recLog(`set_state PLAYING → ${describeStateChange(change)}`);

  if (change === GST_STATE_CHANGE_FAILURE) {
    recError('state change FAILED immediately');
    const bus = api.getBus(pipeline);
    const err = drainBusErrors(api, bus);
    api.objectUnref(bus);
    api.setState(pipeline, GST_STATE_NULL);
    api.objectUnref(pipeline);
    throw new Error(err ?? 'gst_element_set_state PLAYING failed');
  }

  if (change === GST_STATE_CHANGE_NO_PREROLL) {
    recLog('live source NO_PREROLL — waiting PLAYING');
  } else if (change === GST_STATE_CHANGE_ASYNC) {
    recLog('state change ASYNC — waiting preroll');
  }

  try {
    await waitUntilPlaying(api, pipeline, timeoutMs, tempPath);
  } catch (err) {
    recError(`waitUntilPlaying failed: ${err instanceof Error ? err.message : String(err)}`);
    api.setState(pipeline, GST_STATE_NULL);
    api.objectUnref(pipeline);
    throw err;
  }

  recLog('pipeline PLAYING');
  const handle = api;
  return {
    stop: async () => {
      recLog('sending EOS to finalize container');
      try {
        const eos = handle.eventEos();
        handle.sendEvent(pipeline, eos);
        const bus = handle.getBus(pipeline);
        const deadline = Date.now() + 4000;
        let gotMessage = false;
        while (Date.now() < deadline) {
          handle.mainContextIteration(null, 0);
          const msg = handle.busPop(bus, 0n, GST_MESSAGE_EOS | GST_MESSAGE_ERROR);
          if (msg) {
            gotMessage = true;
            handle.miniUnref(msg);
            recLog('got EOS/ERROR on bus');
            break;
          }
          await delay(100);
        }
        if (!gotMessage) {
          recWarn('EOS timeout - no message received after 4s');
        }
        handle.objectUnref(bus);
      } catch (err) {
        recWarn(`EOS wait: ${err instanceof Error ? err.message : String(err)}`);
      }
      recLog('setting pipeline to NULL');
      handle.setState(pipeline, GST_STATE_NULL);
      handle.objectUnref(pipeline);
      recLog('pipeline NULL + unref');
    },
  };
}
