import type { AirmirrorApi } from './index';

declare global {
  interface Window {
    airmirror: AirmirrorApi;
  }
}

export {};
