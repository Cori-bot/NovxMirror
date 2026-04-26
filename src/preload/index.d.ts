import type { AirmirrorApi } from './index';
import type { FreezeApi } from './freeze';

declare global {
  interface Window {
    airmirror: AirmirrorApi;
    novxFreeze: FreezeApi;
  }
}

export {};
