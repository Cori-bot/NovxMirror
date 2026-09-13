import { uxplay } from './uxplay-manager';

/** Visible in the terminal and in the in-app log viewer. Never swallow REC errors. */
export function recLog(message: string): void {
  const line = `[REC] ${message}`;
  console.info(line);
  uxplay.log(line);
}

export function recWarn(message: string): void {
  const line = `[REC] ${message}`;
  console.warn(line);
  uxplay.log(line);
}

export function recError(message: string): void {
  const line = `[REC] ${message}`;
  console.error(line);
  uxplay.log(line);
}
