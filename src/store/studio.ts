import { create } from "zustand";
import type { ContentItem, LogEntry, TemplateConfig, ValidationIssue, WorkbookMapping } from "@/engine/types";
import { createHoroscopeTemplate } from "@/templates/horoscope/template";
import { DEFAULT_WORKBOOK_MAPPING } from "@/engine/production";
import { ZODIAC_SIGNS, type ZodiacSign } from "@/templates/horoscope/signs";
import seed from "@/data/aether-production.json";

export type StudioTab = "layout" | "type" | "output" | "log";

export interface BatchState {
  running: boolean;
  current: number;
  total: number;
  label: string;
  ratio: number;
}

interface StudioStore {
  template: TemplateConfig;
  items: ContentItem[];
  dates: string[];
  selectedId: string | null;
  enabledSigns: Record<ZodiacSign, boolean>;
  setSign: (sign: ZodiacSign, enabled: boolean) => void;
  selectSign: (sign: ZodiacSign) => void;
  showGuides: boolean;
  playing: boolean;
  playhead: number;
  duration: number;
  tab: StudioTab;
  issues: ValidationIssue[];
  logs: LogEntry[];
  fontsReady: boolean;
  assetsReady: boolean;
  batch: BatchState;
  sourceName: string;
  mapping: WorkbookMapping | null;
  workbookBytes: ArrayBuffer | null;
  workbookPath: string | null;
  setTemplate: (template: TemplateConfig) => void;
  patchTemplate: (patch: Partial<TemplateConfig>) => void;
  setItems: (items: ContentItem[], dates: string[]) => void;
  setSource: (name: string, mapping: WorkbookMapping | null) => void;
  setWorkbookFile: (bytes: ArrayBuffer | null, path: string | null) => void;
  selectDateSign: (date: string, sign?: string) => void;
  updateItem: (id: string, patch: Partial<ContentItem>) => void;
  select: (id: string | null) => void;
  setGuides: (value: boolean) => void;
  setPlaying: (value: boolean) => void;
  setPlayhead: (value: number) => void;
  setDuration: (value: number) => void;
  setTab: (tab: StudioTab) => void;
  setIssues: (issues: ValidationIssue[]) => void;
  log: (level: LogEntry["level"], message: string, detail?: string) => void;
  clearLogs: () => void;
  setFontsReady: (value: boolean) => void;
  setAssetsReady: (value: boolean) => void;
  setBatch: (batch: Partial<BatchState>) => void;
  resetLayout: () => void;
}

const MAX_LOGS = 200;
const seedItems = seed.items as ContentItem[];
const seedDates = seed.dates as string[];
const preferredId =
  seedItems.find((item) => item.date === "2026-09-21" && item.channel === "Capricorn")?.id ??
  seedItems[0]?.id ??
  null;

export const useStudio = create<StudioStore>((set, get) => ({
  template: createHoroscopeTemplate(),
  items: seedItems,
  dates: seedDates,
  selectedId: preferredId,
  enabledSigns: Object.fromEntries(ZODIAC_SIGNS.map((sign) => [sign, true])) as Record<ZodiacSign, boolean>,
  setSign: (sign, enabled) => {
    if (!ZODIAC_SIGNS.includes(sign) || typeof enabled !== "boolean") throw new Error("Expected a zodiac sign and boolean enabled state.");
    set((state) => ({ enabledSigns: { ...state.enabledSigns, [sign]: enabled } }));
  },
  selectSign: (sign) => {
    if (!ZODIAC_SIGNS.includes(sign)) throw new Error(`Unknown zodiac sign: ${sign}`);
    const state = get();
    const date = state.items.find((item) => item.id === state.selectedId)?.date ?? state.dates[0];
    const item = state.items.find((item) => item.date === date && item.channel === sign);
    if (!item) throw new Error(`${date ?? "Selected date"} has no ${sign} reading.`);
    state.select(item.id);
  },
  showGuides: true,
  playing: false,
  playhead: 0,
  duration: 0,
  tab: "layout",
  issues: [],
  sourceName: seed.sourceName,
  mapping: DEFAULT_WORKBOOK_MAPPING,
  workbookBytes: null,
  workbookPath: null,
  logs: [
    {
      id: "boot",
      at: Date.now(),
      level: "info",
      message: `Loaded ${seedItems.length} production readings across ${seedDates.length} days.`,
      detail: "Canonical workbook aether-production.xlsx · Readings sheet · music, voice, font, and typewriter columns applied per row.",
    },
  ],
  fontsReady: false,
  assetsReady: false,
  batch: { running: false, current: 0, total: 0, label: "", ratio: 0 },
  setTemplate: (template) => set({ template }),
  patchTemplate: (patch) =>
    set((state) => ({ template: { ...state.template, ...patch } })),
  setItems: (items, dates) =>
    set((state) => ({
      items,
      dates,
      selectedId:
        state.selectedId && items.some((item) => item.id === state.selectedId)
          ? state.selectedId
          : (items[0]?.id ?? null),
    })),
  setSource: (sourceName, mapping) => set({ sourceName, mapping }),
  setWorkbookFile: (workbookBytes, workbookPath) => set({ workbookBytes, workbookPath }),
  selectDateSign: (date, sign) =>
    set((state) => {
      const current = state.items.find((item) => item.id === state.selectedId);
      const wanted = sign ?? current?.channel;
      const next =
        state.items.find((item) => item.date === date && item.channel === wanted) ??
        state.items.find((item) => item.date === date);
      return { selectedId: next?.id ?? state.selectedId, playhead: 0, playing: false };
    }),
  updateItem: (id, patch) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })),
  select: (id) => set({ selectedId: id, playhead: 0, playing: false }),
  setGuides: (showGuides) => set({ showGuides }),
  setPlaying: (playing) => set({ playing }),
  setPlayhead: (playhead) => set({ playhead }),
  setDuration: (duration) => set({ duration }),
  setTab: (tab) => set({ tab }),
  setIssues: (issues) => set({ issues }),
  log: (level, message, detail) =>
    set((state) => ({
      logs: [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: Date.now(),
          level,
          message,
          detail,
        },
        ...state.logs,
      ].slice(0, MAX_LOGS),
    })),
  clearLogs: () => set({ logs: [] }),
  setFontsReady: (fontsReady) => set({ fontsReady }),
  setAssetsReady: (assetsReady) => set({ assetsReady }),
  setBatch: (batch) => set((state) => ({ batch: { ...state.batch, ...batch } })),
  resetLayout: () =>
    set((state) => {
      const fresh = createHoroscopeTemplate();
      return {
        template: {
          ...fresh,
          typewriter: state.template.typewriter,
          textTypography: {
            ...fresh.textTypography,
            fontSize: state.template.textTypography.fontSize,
            lineHeight: state.template.textTypography.lineHeight,
          },
        },
      };
    }),
}));

export function selectedItem(): ContentItem | undefined {
  const { items, selectedId } = useStudio.getState();
  return items.find((item) => item.id === selectedId);
}

// Shared by the visible Render All action and the existing date batch host.
export function enabledItemsForDate(date: string): ContentItem[] {
  const { items, enabledSigns } = useStudio.getState();
  return ZODIAC_SIGNS.filter((sign) => enabledSigns[sign]).flatMap((sign) =>
    items.filter((item) => item.date === date && item.channel === sign),
  );
}
