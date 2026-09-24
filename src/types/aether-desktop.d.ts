export interface AetherDesktopApi {
  saveReviewFile: (filename: string, bytes: Uint8Array, date: string) => Promise<number>;
  getPaths: () => Promise<{
    dataDir: string;
    outputDir: string;
    contentFile: string;
    ffmpeg: string | null;
    encoder: string;
  }>;
  openOutputFolder: (date?: string) => Promise<void>;
  createDesktopShortcut: () => Promise<boolean>;
  openWorkbook: () => Promise<{ name: string; path: string; bytes: Uint8Array } | null>;
  saveWorkbook: (path: string | null, bytes: Uint8Array) => Promise<{ path: string }>;
  importWorkbook?: (name: string, bytes: Uint8Array) => Promise<{ name: string; path: string }>;
  readWorkbook?: (path: string) => Promise<{ name: string; path: string; bytes: Uint8Array } | null>;
  saveConfig: (name: string, data: unknown) => Promise<void>;
  loadConfig: (name: string) => Promise<unknown | null>;
}

declare global {
  interface Window {
    aetherDesktop?: AetherDesktopApi;
    __aetherSaveReviewFile?: (filename: string, bytes: Uint8Array) => Promise<number | void>;
  }
}

export {};
