import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loadPreviewAssets, ensureBadge, loadVideoFonts, type LoadedAssets } from "@/engine/assets";
import { createCanvasMeasurer } from "@/engine/layout";
import { validateDataset } from "@/engine/validator";
import { TEMPLATE_REGISTRY } from "@/templates/registry";
import { createHoroscopeTemplate } from "@/templates/horoscope/template";
import { ingestHoroscopeText } from "@/content-engine/horoscope/archive";
import { installBatchHost } from "@/engine/batch";
import {
  applyLayoutPersist,
  loadGuidesFlag,
  loadPersistedLayout,
  loadPersistedMapping,
  savePersistedLayout,
} from "@/engine/persist";
import { type ZodiacSign } from "@/templates/horoscope/signs";
import { installSignPersistence } from "@/engine/persist";
import { useStudio } from "@/store/studio";
import { PreviewStage } from "./PreviewStage";
import { Controls } from "./Controls";
import { CommandDeck } from "./CommandDeck";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function StudioApp() {
  const template = useStudio((s) => s.template);
  const items = useStudio((s) => s.items);
  const showGuides = useStudio((s) => s.showGuides);
  const fontsReady = useStudio((s) => s.fontsReady);
  const issues = useStudio((s) => s.issues);
  const selectedId = useStudio((s) => s.selectedId);
  const sourceName = useStudio((s) => s.sourceName);
  const [assets, setAssets] = useState<LoadedAssets | null>(null);

  const selectedKey = items.find((item) => item.id === selectedId)?.assetKey;
  const selected = items.find((item) => item.id === selectedId);

  useEffect(() => {
    const current = useStudio.getState().template.typewriter;
    if (current.charsPerSecond === 22) {
      const fresh = createHoroscopeTemplate();
      useStudio.getState().patchTemplate({ typewriter: fresh.typewriter });
    }
  }, []);

  useEffect(() => installSignPersistence(), []);

  useEffect(() => {
    installBatchHost();
  }, []);

  useEffect(() => {
    const w = window as Window & {
      aetherControl?: {
        getSigns: () => { selected: string | null; signs: Record<ZodiacSign, boolean> };
        setSign: (sign: ZodiacSign, enabled: boolean) => { selected: string | null; signs: Record<ZodiacSign, boolean> };
        selectSign: (sign: ZodiacSign) => { selected: string | null; signs: Record<ZodiacSign, boolean> };
        getLayout: () => { titleY: number | null; dateLineY: number | null; readingY: number };
        setLayout: (patch: { titleY?: number; dateLineY?: number; readingY?: number }) => Promise<{
          titleY: number | null; dateLineY: number | null; readingY: number;
        }>;
      };
    };
    const getLayout = () => {
      const current = useStudio.getState().template;
      return {
        titleY: current.title?.region.y ?? null,
        dateLineY: current.subtitle?.region.y ?? null,
        readingY: current.textRegion.y,
      };
    };
    const getSigns = () => {
      const state = useStudio.getState();
      return {
        selected: state.items.find((item) => item.id === state.selectedId)?.channel ?? null,
        signs: { ...state.enabledSigns },
      };
    };
    w.aetherControl = {
      getSigns,
      setSign: (sign, enabled) => { useStudio.getState().setSign(sign, enabled); return getSigns(); },
      selectSign: (sign) => { useStudio.getState().selectSign(sign); return getSigns(); },
      getLayout,
      setLayout: async (patch) => {
        const state = useStudio.getState();
        const current = state.template;
        state.patchTemplate({
          ...(typeof patch.titleY === "number" && current.title
            ? { title: { ...current.title, region: { ...current.title.region, y: patch.titleY } } }
            : {}),
          ...(typeof patch.dateLineY === "number" && current.subtitle
            ? { subtitle: { ...current.subtitle, region: { ...current.subtitle.region, y: patch.dateLineY } } }
            : {}),
          ...(typeof patch.readingY === "number"
            ? { textRegion: { ...current.textRegion, y: patch.readingY } }
            : {}),
        });
        const next = useStudio.getState();
        await savePersistedLayout(next.template, next.showGuides);
        return getLayout();
      },
    };
    return () => {
      delete w.aetherControl;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadPersistedLayout();
      if (cancelled) return;
      if (saved) {
        const current = useStudio.getState().template;
        useStudio.getState().setTemplate(applyLayoutPersist(current, saved));
        if (typeof saved.showGuides === "boolean") useStudio.getState().setGuides(saved.showGuides);
      } else {
        const guides = loadGuidesFlag();
        if (guides !== null) useStudio.getState().setGuides(guides);
      }
      const mapping = await loadPersistedMapping();
      if (mapping && !cancelled) useStudio.getState().setSource(useStudio.getState().sourceName, mapping);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const xlsx = await fetch(`/content/aether-production.xlsx?t=${Date.now()}`, { cache: "no-store" });
        if (xlsx.ok) {
          const data = await xlsx.arrayBuffer();
          const copy = data.slice(0);
          useStudio.getState().setWorkbookFile(copy, null);
          const { inspectWorkbook, applyWorkbookMapping } = await import("@/engine/workbook");
          const inspected = inspectWorkbook(copy, "aether-production.xlsx");
          const mapping = inspected.suggested;
          if (mapping && !cancelled) {
            const parsed = applyWorkbookMapping(copy, "aether-production.xlsx", mapping);
            if (parsed.items.length) {
              useStudio.getState().setItems(parsed.items, parsed.dates);
              useStudio.getState().setSource("aether-production.xlsx", mapping);
              const preferred =
                parsed.items.find((entry) => entry.date === "2026-09-21" && entry.channel === "Capricorn") ??
                parsed.items[0];
              if (preferred) useStudio.getState().select(preferred.id);
              useStudio.getState().log(
                "info",
                `Loaded ${parsed.items.length} production readings from workbook.`,
                mapping.sheet,
              );
              return;
            }
          }
        }
        const jsonRes = await fetch(`/content/aether-production.json?t=${Date.now()}`, { cache: "no-store" });
        if (jsonRes.ok) {
          const payload = (await jsonRes.json()) as {
            sourceName?: string;
            items?: typeof items;
            dates?: string[];
          };
          if (!cancelled && payload.items?.length) {
            useStudio.getState().setItems(payload.items, payload.dates ?? []);
            useStudio.getState().setSource(payload.sourceName ?? "aether-production.xlsx", {
              sheet: "Readings",
              format: "long",
              dateColumn: "date",
              signColumn: "sign",
              readingColumn: "reading",
              headerRow: 1,
            });
            const preferred =
              payload.items.find((entry) => entry.date === "2026-09-21" && entry.channel === "Capricorn") ??
              payload.items[0];
            if (preferred) useStudio.getState().select(preferred.id);
            useStudio.getState().log(
              "info",
              `Loaded ${payload.items.length} production readings from workbook.`,
              "Readings",
            );
            return;
          }
        }
        if (!window.aetherDesktop) return;
        const response = await fetch(`/content/horoscopes.csv?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const text = await response.text();
        if (!text.trim() || cancelled) return;
        const parsed = ingestHoroscopeText(text);
        if (!parsed.items.length || cancelled) return;
        useStudio.getState().setItems(parsed.items, parsed.dates);
        const preferred =
          parsed.items.find((item) => item.date === "2026-09-21" && item.channel === "Capricorn") ??
          parsed.items[0];
        if (preferred) useStudio.getState().select(preferred.id);
        useStudio.getState().log("info", `Loaded ${parsed.items.length} readings from data/content.`);
      } catch {
        /* workbook fetch is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loaded] = await Promise.all([
          loadPreviewAssets(template, selectedKey),
          loadVideoFonts([
            template.textTypography.fontFamily,
            template.title?.typography.fontFamily ?? "",
            items.find((entry) => entry.id === selectedId)?.font ?? "",
          ]),
        ]);
        if (!cancelled) {
          useStudio.getState().setFontsReady(true);
          setAssets(loaded);
          useStudio.getState().setAssetsReady(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        useStudio.getState().log("error", "Asset load failed", message);
        toast.error("Could not load visual assets.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [template.background.src]);

  useEffect(() => {
    if (!assets || !selectedKey || assets.badges[selectedKey]) return;
    let cancelled = false;
    ensureBadge(useStudio.getState().template, assets, selectedKey).then((next) => {
      if (!cancelled) setAssets(next);
    });
    return () => {
      cancelled = true;
    };
  }, [assets, selectedKey]);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const measure = ctx ? createCanvasMeasurer(ctx, template.textTypography) : null;
    useStudio.getState().setIssues(validateDataset(items, template, measure));
  }, [items, template, fontsReady]);

  const errors = issues.filter((issue) => issue.level === "error").length;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
        <div>
          <p className="font-serif text-2xl tracking-tight text-fg">Aether</p>
          <p className="text-xs uppercase tracking-[0.18em] text-faint">Vertical video engine</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <p className="max-w-[240px] truncate text-xs text-muted" title={sourceName}>
            {sourceName}
            {selected ? ` · ${selected.date} · ${selected.channel}` : ""}
          </p>
          <label className="flex items-center gap-2">
            <Switch
              checked={showGuides}
              onCheckedChange={(value) => {
                useStudio.getState().setGuides(value);
                void savePersistedLayout(useStudio.getState().template, value);
              }}
            />
            <Label className="normal-case tracking-normal text-xs text-muted">Guides</Label>
          </label>
          <p className="text-xs tabular-nums text-muted">
            {items.length} readings
            {errors ? ` · ${errors} blocked` : " · ready"}
          </p>
        </div>
      </header>

      <div className="grid min-h-[calc(100dvh-64px)] grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <aside className="min-h-[280px] border-b border-border bg-surface xl:border-b-0 xl:border-r">
          <CommandDeck assets={assets} />
        </aside>
        <main className="flex min-h-0 flex-col items-center justify-center gap-5 p-4 md:p-6">
          <div className="flex w-full max-w-xl items-end justify-between gap-3">
            <div>
              <p className="font-serif text-xl text-fg">{template.name}</p>
              <p className="text-sm text-muted">1080 × 1920 · nine by sixteen</p>
            </div>
            <select
              className="h-10 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-fg"
              value={template.id}
              onChange={(e) => {
                const meta = TEMPLATE_REGISTRY.find((entry) => entry.id === e.target.value);
                if (!meta) return;
                if (!meta.ready) {
                  toast(meta.note);
                  return;
                }
                const next = meta.create();
                const current = useStudio.getState().template;
                useStudio.getState().setTemplate(
                  applyLayoutPersist(next, {
                    textRegion: current.textRegion,
                    titleY: current.title?.region.y,
                    subtitleY: current.subtitle?.region.y,
                  }),
                );
              }}
            >
              {TEMPLATE_REGISTRY.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                  {entry.ready ? "" : " (later)"}
                </option>
              ))}
            </select>
          </div>
          <PreviewStage assets={assets} />
        </main>
        <aside className="min-h-[420px] border-t border-border bg-surface xl:border-t-0 xl:border-l">
          <Controls assets={assets} />
        </aside>
      </div>
    </div>
  );
}
