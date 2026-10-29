// Jembatan ke main process (lihat src/preload.js). UI tidak pernah memegang token/API key.
export type AppState = {
  version: string;
  platform: string;
  notifyLive: boolean;
  closeToTray: boolean;
  openAtLogin: boolean;
  canLogin: boolean;
  theme: "light" | "dark";
  zoom: number;
  fullscreen: boolean;
  update: { version: string; ready: boolean } | null;
  canUpdate: boolean;
};

type ApiResult = { data: unknown; stale: boolean } | { error: { status: number; message: string } };

type Bridge = {
  api(path: string, opts?: { fresh?: boolean }): Promise<ApiResult>;
  state(): Promise<AppState>;
  showroomStreams(room: string): Promise<{ label: string; quality: number; url: string }[]>;
  live(): Promise<unknown[]>;
  send(channel: "set", key: string, value: unknown): void;
  send(channel: "open-external", url: string): void;
  send(channel: "menu", at: { x: number; y: number }): void;
  send(channel: "update-install" | "update-check"): void;
  send(channel: "fullscreen", on: boolean): void;
  on(channel: "state", fn: (s: AppState) => void): () => void;
  on(channel: "live", fn: (list: unknown[]) => void): () => void;
  on(channel: "navigate", fn: (route: string) => void): () => void;
};

declare global {
  interface Window {
    jkc: Bridge;
  }
}

export const bridge: Bridge = window.jkc;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** JSON `/api/app<path>` lewat main process (token + cache offline di sana). */
export async function call<T>(path: string, fresh = false): Promise<T> {
  const r = await bridge.api(path, { fresh });
  if ("error" in r) throw new ApiError(r.error.status, r.error.message);
  return r.data as T;
}

export function openExternal(url: string) {
  bridge.send("open-external", url);
}
