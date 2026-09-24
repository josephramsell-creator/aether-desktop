import { useStudio, type RegionId } from "@/store/studio";
import { ZODIAC_SIGNS } from "@/templates/horoscope/signs";
import type { TemplateConfig, WorkbookMapping } from "./types";
import { CUT_IDS } from "./cuts";

const LAYOUT_KEY = "aether.layout.v1";
const MAPPING_KEY = "aether.mapping.v1";
const GUIDES_KEY = "aether.guides.v1";

export interface LayoutPersist {
  textRegion?: { x: number; y: number; width: number; height: number };
  titleY?: number;
  subtitleY?: number;
  showGuides?: boolean;
  locks?: Partial<Record<RegionId, boolean>>;
}

export function applyLayoutPersist(template: TemplateConfig, saved: LayoutPersist | null): TemplateConfig {
  if (!saved) return template;
  const next: TemplateConfig = {
    ...template,
    textRegion: saved.textRegion
      ? { ...template.textRegion, y: saved.textRegion.y }
      : template.textRegion,
    title: template.title
      ? {
          ...template.title,
          region: { ...template.title.region, y: saved.titleY ?? template.title.region.y },
        }
      : template.title,
    subtitle: template.subtitle
      ? {
          ...template.subtitle,
          region: { ...template.subtitle.region, y: saved.titleY === undefined ? (saved.subtitleY ?? template.subtitle.region.y) : (saved.subtitleY ?? template.subtitle.region.y) },
        }
      : template.subtitle,
  };
  if (typeof saved.subtitleY === "number" && next.subtitle) {
    next.subtitle = { ...next.subtitle, region: { ...next.subtitle.region, y: saved.subtitleY } };
  }
  return next;
}

export function captureLayout(template: TemplateConfig, showGuides: boolean): LayoutPersist {
  return {
    textRegion: { ...template.textRegion },
    titleY: template.title?.region.y,
    subtitleY: template.subtitle?.region.y,
    showGuides,
    locks: { ...useStudio.getState().locks },
  };
}

export async function loadPersistedLayout(): Promise<LayoutPersist | null> {
  try {
    const desktop = window.aetherDesktop;
    if (desktop?.loadConfig) {
      const fromDisk = await desktop.loadConfig("template.json");
      if (fromDisk && typeof fromDisk === "object") return fromDisk as LayoutPersist;
    }
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? (JSON.parse(raw) as LayoutPersist) : null;
  } catch {
    return null;
  }
}

export async function savePersistedLayout(template: TemplateConfig, showGuides: boolean): Promise<void> {
  const payload = captureLayout(template, showGuides);
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(payload));
    localStorage.setItem(GUIDES_KEY, showGuides ? "1" : "0");
    await window.aetherDesktop?.saveConfig?.("template.json", payload);
  } catch {
    /* storage may be blocked */
  }
}

export async function loadPersistedMapping(): Promise<WorkbookMapping | null> {
  try {
    const desktop = window.aetherDesktop;
    if (desktop?.loadConfig) {
      const fromDisk = await desktop.loadConfig("workbook-mapping.json");
      if (fromDisk && typeof fromDisk === "object") return fromDisk as WorkbookMapping;
    }
    const raw = localStorage.getItem(MAPPING_KEY);
    return raw ? (JSON.parse(raw) as WorkbookMapping) : null;
  } catch {
    return null;
  }
}

export async function savePersistedMapping(mapping: WorkbookMapping): Promise<void> {
  try {
    localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
    await window.aetherDesktop?.saveConfig?.("workbook-mapping.json", mapping);
  } catch {
    /* storage may be blocked */
  }
}

export interface ActiveWorkbook {
  name: string;
  path: string;
}

/** The workbook Aether reopens on launch (last one dropped or opened). */
export async function loadActiveWorkbook(): Promise<ActiveWorkbook | null> {
  try {
    const saved = await window.aetherDesktop?.loadConfig?.("active-workbook.json");
    if (saved && typeof saved === "object" && typeof (saved as ActiveWorkbook).path === "string") {
      return saved as ActiveWorkbook;
    }
  } catch {
    /* fall back to the bundled workbook */
  }
  return null;
}

export async function saveActiveWorkbook(active: ActiveWorkbook): Promise<void> {
  try {
    await window.aetherDesktop?.saveConfig?.("active-workbook.json", active);
  } catch {
    /* storage may be blocked */
  }
}

/** Remember which versions (full, love, money, work) are ticked, in data/config/cuts.json. */
export function installCutPersistence(): () => void {
  let active = true;
  let hydrated = false;
  const unsubscribe = useStudio.subscribe((state, previous) => {
    if (!hydrated || state.enabledCuts === previous.enabledCuts) return;
    void window.aetherDesktop?.saveConfig?.("cuts.json", state.enabledCuts)?.catch(() => {
      useStudio.getState().log("warn", "Could not persist version choices to disk.");
    });
  });
  void (async () => {
    try {
      const saved = await window.aetherDesktop?.loadConfig?.("cuts.json");
      if (active && saved && typeof saved === "object") {
        for (const cut of CUT_IDS) {
          const value = (saved as Record<string, unknown>)[cut];
          if (typeof value === "boolean") useStudio.getState().setCut(cut, value);
        }
      }
    } catch {
      /* defaults */
    }
    hydrated = true;
  })();
  return () => {
    active = false;
    unsubscribe();
  };
}

export function loadGuidesFlag(): boolean | null {
  try {
    const raw = localStorage.getItem(GUIDES_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return null;
}

export type WorkbookSaveTarget = "desktop" | "server" | "download";

function copyBuffer(data: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(data);
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function downloadWorkbook(name: string, data: ArrayBuffer) {
  const filename = name.toLowerCase().endsWith(".xlsx") ? name : "aether-production.xlsx";
  const blob = new Blob([copyBuffer(data)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function persistWorkbookFile(
  name: string,
  data: ArrayBuffer,
  path: string | null,
): Promise<WorkbookSaveTarget> {
  const desktop = window.aetherDesktop;
  if (desktop?.saveWorkbook) {
    await desktop.saveWorkbook(path, new Uint8Array(copyBuffer(data)));
    return "desktop";
  }
  try {
    const response = await fetch("/api/workbook", {
      method: "POST",
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "x-aether-filename": name.toLowerCase().endsWith(".xlsx") ? name : "aether-production.xlsx",
      },
      body: copyBuffer(data),
    });
    if (response.ok) return "server";
  } catch {
    /* deployed hosts cannot write the workbook file */
  }
  downloadWorkbook(name, data);
  return "download";
}

// Subscribe before loading so startup interaction wins over an older saved choice.
export function installSignPersistence(): () => void {
  const key = "aether.signs.v1";
  let active = true;
  let hydrating = false;
  const touched = new Set<string>();
  let writes = Promise.resolve();
  const persist = () => {
    const payload = { ...useStudio.getState().enabledSigns };
    writes = writes.then(async () => {
      try { localStorage.setItem(key, JSON.stringify(payload)); } catch { /* optional fallback */ }
      try { await window.aetherDesktop?.saveConfig?.("signs.json", payload); }
      catch { useStudio.getState().log("warn", "Could not persist sign choices to disk."); }
    });
  };
  const unsubscribe = useStudio.subscribe((state, previous) => {
    if (state.enabledSigns === previous.enabledSigns || hydrating) return;
    for (const sign of ZODIAC_SIGNS) {
      if (state.enabledSigns[sign] !== previous.enabledSigns[sign]) touched.add(sign);
    }
    persist();
  });
  void (async () => {
    let saved: unknown;
    try { saved = await window.aetherDesktop?.loadConfig?.("signs.json"); } catch { /* fallback */ }
    if (!saved) {
      try { saved = JSON.parse(localStorage.getItem(key) ?? "null"); } catch { /* defaults */ }
    }
    if (!active || !saved || typeof saved !== "object") return;
    hydrating = true;
    for (const sign of ZODIAC_SIGNS) {
      const value = (saved as Record<string, unknown>)[sign];
      if (!touched.has(sign) && typeof value === "boolean") useStudio.getState().setSign(sign, value);
    }
    hydrating = false;
    // Save the merged state if a command raced the initial disk read.
    if (touched.size) persist();
  })();
  return () => { active = false; unsubscribe(); };
}
