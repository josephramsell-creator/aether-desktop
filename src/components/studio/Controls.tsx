import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  LockOpen,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ingestHoroscopeText } from "@/content-engine/horoscope/archive";
import { CSV_TEMPLATE, serializeHoroscopeCsv } from "@/engine/csv";
import { blockingErrors, filenameFor } from "@/engine/validator";
import { downloadBlob, exportFramePng } from "@/engine/recorder";
import { runRenderJobs } from "@/engine/batch";
import type { LoadedAssets } from "@/engine/assets";
import { ZODIAC_SIGNS } from "@/templates/horoscope/signs";
import { createHoroscopeTemplate } from "@/templates/horoscope/template";
import { REGION_IDS, useStudio, type StudioTab } from "@/store/studio";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/engine/types";
import { ReviewGallery } from "./ReviewGallery";
import { savePersistedLayout } from "@/engine/persist";

const TABS: { id: StudioTab; label: string }[] = [
  { id: "layout", label: "Regions" },
  { id: "type", label: "Typewriter" },
  { id: "output", label: "Output" },
  { id: "log", label: "Log" },
];

export function Controls({ assets }: { assets: LoadedAssets | null }) {
  const tab = useStudio((s) => s.tab);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => useStudio.getState().setTab(entry.id)}
            className={cn(
              "h-10 shrink-0 rounded-[var(--radius-md)] px-3 text-sm font-medium",
              tab === entry.id ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "layout" ? <LayoutPanel /> : null}
        {tab === "type" ? <TypePanel /> : null}
        {tab === "output" ? <BatchPanel assets={assets} /> : null}
        {tab === "log" ? <LogPanel /> : null}
      </div>
    </div>
  );
}

function LayoutPanel() {
  const template = useStudio((s) => s.template);
  const showGuides = useStudio((s) => s.showGuides);
  const locks = useStudio((s) => s.locks);
  const region = template.textRegion;
  const allLocked = REGION_IDS.every((id) => locks[id]);
  const setLocks = (patch: Partial<typeof locks>) => {
    useStudio.getState().setLocks(patch);
    const state = useStudio.getState();
    void savePersistedLayout(state.template, state.showGuides);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-serif text-lg text-fg">Text regions</p>
        <p className="mt-1 text-sm text-muted">
          Drag the handles on the preview to move a region up or down. Size stays locked. The
          medallion is not adjustable.
        </p>
      </div>
      <Row label="Layout guides">
        <Switch
          checked={showGuides}
          onCheckedChange={(v) => {
            useStudio.getState().setGuides(v);
            void import("@/engine/persist").then(({ savePersistedLayout }) =>
              savePersistedLayout(useStudio.getState().template, v),
            );
          }}
        />
      </Row>
      <div className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-2">
        <p className="text-xs text-muted">
          {allLocked
            ? "All positions locked for every sign and workbook."
            : "Lock a position to keep it for every sign and workbook."}
        </p>
        <Button
          variant={allLocked ? "secondary" : "ghost"}
          className="h-8 shrink-0 px-3 text-xs"
          onClick={() => setLocks(Object.fromEntries(REGION_IDS.map((id) => [id, !allLocked])))}
        >
          {allLocked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
          {allLocked ? "Unlock all" : "Lock all"}
        </Button>
      </div>
      {template.title ? (
        <Num
          label="Title Y"
          value={template.title.region.y}
          min={500}
          max={900}
          locked={locks.title}
          onToggleLock={() => setLocks({ title: !locks.title })}
          onChange={(y) => {
            useStudio.getState().patchTemplate({
              title: { ...template.title!, region: { ...template.title!.region, y } },
            });
            void savePersistedLayout(useStudio.getState().template, useStudio.getState().showGuides);
          }}
        />
      ) : null}
      {template.subtitle ? (
        <Num
          label="Date line Y"
          value={template.subtitle.region.y}
          min={540}
          max={940}
          locked={locks.subtitle}
          onToggleLock={() => setLocks({ subtitle: !locks.subtitle })}
          onChange={(y) => {
            useStudio.getState().patchTemplate({
              subtitle: { ...template.subtitle!, region: { ...template.subtitle!.region, y } },
            });
            void savePersistedLayout(useStudio.getState().template, useStudio.getState().showGuides);
          }}
        />
      ) : null}
      <Num
        label="Reading Y"
        value={region.y}
        min={620}
        max={1100}
        locked={locks.text}
        onToggleLock={() => setLocks({ text: !locks.text })}
        onChange={(y) => {
          useStudio.getState().patchTemplate({
            textRegion: { ...region, y },
          });
          void savePersistedLayout(useStudio.getState().template, useStudio.getState().showGuides);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={allLocked}
          onClick={() => {
            const fresh = createHoroscopeTemplate();
            const current = useStudio.getState().template;
            useStudio.getState().setTemplate({
              ...current,
              textRegion: locks.text ? current.textRegion : { ...current.textRegion, y: fresh.textRegion.y },
              title: current.title && !locks.title
                ? { ...current.title, region: { ...current.title.region, y: fresh.title!.region.y } }
                : current.title,
              subtitle: current.subtitle && !locks.subtitle
                ? { ...current.subtitle, region: { ...current.subtitle.region, y: fresh.subtitle!.region.y } }
                : current.subtitle,
            });
            void savePersistedLayout(useStudio.getState().template, useStudio.getState().showGuides);
            toast(
              Object.values(locks).some(Boolean)
                ? "Restored unlocked positions. Locked ones stayed put."
                : "Restored vertical positions. Medallion unchanged.",
            );
          }}
        >
          <RotateCcw className="size-4" />
          Reset region height
        </Button>
      </div>
    </div>
  );
}

function TypePanel() {
  const tw = useStudio((s) => s.template.typewriter);
  const duration = useStudio((s) => s.duration);
  const patch = (partial: Partial<typeof tw>) =>
    useStudio.getState().patchTemplate({
      typewriter: { ...useStudio.getState().template.typewriter, ...partial },
    });

  return (
    <div className="space-y-6">
      <p className="font-serif text-lg text-fg">Reveal timing</p>
      <p className="text-sm text-muted">
        Duration is computed from the reading — currently {duration.toFixed(1)}s. Nothing is truncated.
      </p>
      <Num label="Characters / sec" value={tw.charsPerSecond} min={5} max={48} step={1} onChange={(v) => patch({ charsPerSecond: v })} />
      <Num label="Lines per page" value={tw.linesPerPage} min={2} max={8} step={1} onChange={(v) => patch({ linesPerPage: v })} />
      <Num label="Hold after page (ms)" value={tw.holdMs} min={400} max={5000} step={50} onChange={(v) => patch({ holdMs: v })} />
      <Num label="Extra hold / char (ms)" value={tw.holdMsPerChar} min={0} max={40} step={1} onChange={(v) => patch({ holdMsPerChar: v })} />
      <Num label="Transition (ms)" value={tw.transitionMs} min={120} max={1200} step={10} onChange={(v) => patch({ transitionMs: v })} />
      <Num label="Intro delay (ms)" value={tw.introMs} min={0} max={2000} step={20} onChange={(v) => patch({ introMs: v })} />
      <Num label="Period pause (ms)" value={tw.punctuationPauseMs} min={0} max={600} step={10} onChange={(v) => patch({ punctuationPauseMs: v })} />
      <Num label="Comma pause (ms)" value={tw.commaPauseMs} min={0} max={300} step={5} onChange={(v) => patch({ commaPauseMs: v })} />
      <Num label="End hold (ms)" value={tw.endHoldMs} min={400} max={4000} step={50} onChange={(v) => patch({ endHoldMs: v })} />
      <Num label="Frame rate" value={tw.fps} min={24} max={30} step={1} onChange={(v) => patch({ fps: v })} />
      <Row label="Typing caret">
        <Switch checked={tw.cursor} onCheckedChange={(cursor) => patch({ cursor })} />
      </Row>
    </div>
  );
}

function ContentPanel() {
  const items = useStudio((s) => s.items);
  const dates = useStudio((s) => s.dates);
  const selectedId = useStudio((s) => s.selectedId);
  const item = items.find((entry) => entry.id === selectedId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");

  const byDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const entry of items) {
      const key = entry.date ?? "undated";
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }, [items]);

  return (
    <div className="space-y-5">
      <p className="font-serif text-lg text-fg">Spreadsheet</p>
      <p className="text-sm text-muted">
        One row per day, twelve sign columns. The preview is loaded with the September 21–30
        trial archive — Money, Love, Work, and Caution in each reading, so wrapping and
        three-line pages can be checked. Import a CSV or markdown archive to replace it.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet className="size-4" />
          Import CSV or markdown
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            downloadBlob(new Blob([CSV_TEMPLATE], { type: "text/csv" }), "horoscopes-template.csv")
          }
        >
          <Download className="size-4" />
          Empty template
        </Button>
        <Button
          variant="ghost"
          disabled={!items.length}
          onClick={() =>
            downloadBlob(
              new Blob([serializeHoroscopeCsv(items)], { type: "text/csv" }),
              "horoscopes.csv",
            )
          }
        >
          Export loaded CSV
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.md,.markdown,text/csv,text/markdown"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          ingestCsv(await file.text(), file.name);
          event.target.value = "";
        }}
      />
      <textarea
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder="Paste CSV or markdown archive, then import."
        className="h-24 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-faint"
      />
      <Button
        variant="secondary"
        disabled={!paste.trim()}
        onClick={() => {
          ingestCsv(paste, "pasted.csv");
          setPaste("");
        }}
      >
        Import pasted text
      </Button>

      {dates.length ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-2">
            <Label>Date</Label>
            <select
              className={selectClass}
              value={item?.date ?? dates[0]}
              onChange={(e) => {
                const date = e.target.value;
                const list = byDate.get(date) ?? [];
                const next =
                  list.find((entry) => entry.channel === item?.channel) ?? list[0];
                if (next) useStudio.getState().select(next.id);
              }}
            >
              {dates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <Label>Sign</Label>
            <select
              className={selectClass}
              value={item?.channel ?? "Capricorn"}
              onChange={(e) => {
                const date = item?.date ?? dates[0];
                const next = items.find((entry) => entry.date === date && entry.channel === e.target.value);
                if (next) useStudio.getState().select(next.id);
              }}
            >
              {ZODIAC_SIGNS.map((sign) => (
                <option key={sign} value={sign}>
                  {sign}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {item ? (
        <label className="block space-y-2">
          <Label>Reading — {item.channel}</Label>
          <textarea
            value={item.body}
            onChange={(e) => useStudio.getState().updateItem(item.id, { body: e.target.value })}
            className="h-48 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-2 text-sm leading-relaxed text-fg"
          />
          <p className="text-xs text-faint">{item.body.trim().length} characters · wrapping is automatic</p>
        </label>
      ) : null}
    </div>
  );
}

function BatchPanel({ assets }: { assets: LoadedAssets | null }) {
  const items = useStudio((s) => s.items);
  const dates = useStudio((s) => s.dates);
  const selectedId = useStudio((s) => s.selectedId);
  const issues = useStudio((s) => s.issues);
  const batch = useStudio((s) => s.batch);
  const item = items.find((entry) => entry.id === selectedId);
  const [from, setFrom] = useState(dates[0] ?? "");
  const [to, setTo] = useState(dates[dates.length - 1] ?? "");
  const [outputDir, setOutputDir] = useState<string | null>(null);

  const selectedIssues = blockingErrors(issues, item?.id);
  const desktop = typeof window !== "undefined" ? window.aetherDesktop : undefined;

  useEffect(() => {
    if (!desktop?.getPaths) return;
    void desktop.getPaths().then((paths) => setOutputDir(paths.outputDir));
  }, [desktop]);

  return (
    <div className="space-y-5">
      <p className="font-serif text-lg text-fg">Render</p>
      <p className="text-sm text-muted">
        Failed items are logged and withheld. A full day writes twelve files named like
        2026-09-21_Capricorn.mp4
        {outputDir ? ` into the local output/review folder.` : "."}
      </p>
      {outputDir ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-2">
          <p className="text-xs text-muted break-all">Saving to {outputDir}</p>
          <Button variant="ghost" size="sm" onClick={() => void desktop?.openOutputFolder(item?.date)}>
            Open folder
          </Button>
        </div>
      ) : null}
      {selectedIssues.length ? (
        <div className="rounded-[var(--radius-md)] border border-danger/40 bg-danger/10 p-3 text-sm text-fg">
          {selectedIssues.map((issue) => (
            <p key={issue.code}>{issue.message}</p>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ok">
          <CheckCircle2 className="size-4" />
          Current reading passes validation.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          disabled={!item || batch.running}
          onClick={() => void runJobs(assets, item ? [item] : [], false)}
        >
          Render this video
        </Button>
        <Button
          variant="secondary"
          disabled={!item || batch.running}
          onClick={async () => {
            if (!item || !assets) return;
            const blob = await exportFramePng(
              useStudio.getState().template,
              item,
              assets,
              useStudio.getState().playhead,
            );
            downloadBlob(blob, filenameFor(item).replace(/\.mp4$/, ".png"));
          }}
        >
          PNG of this frame
        </Button>
      </div>
      <Button
        variant="secondary"
        className="w-full"
        disabled={!item?.date || batch.running}
        onClick={() =>
          void runJobs(
            assets,
            items.filter((entry) => entry.date === item?.date),
            true,
          )
        }
      >
        All twelve signs for {item?.date ?? "this date"}
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-2">
          <Label>From</Label>
          <select className={selectClass} value={from} onChange={(e) => setFrom(e.target.value)}>
            {dates.map((date) => (
              <option key={date}>{date}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <Label>To</Label>
          <select className={selectClass} value={to} onChange={(e) => setTo(e.target.value)}>
            {dates.map((date) => (
              <option key={date}>{date}</option>
            ))}
          </select>
        </label>
      </div>
      <Button
        variant="secondary"
        className="w-full"
        disabled={batch.running || !dates.length}
        onClick={() =>
          void runJobs(
            assets,
            items.filter((entry) => (entry.date ?? "") >= from && (entry.date ?? "") <= to),
            true,
          )
        }
      >
        Render date range
      </Button>
      <Button
        variant="secondary"
        className="w-full"
        disabled={batch.running || !items.length}
        onClick={() => void runJobs(assets, items, true)}
      >
        Entire dataset ({items.length})
      </Button>
      {batch.running || batch.total ? (
        <div className="space-y-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-gilt transition-[width] duration-150" style={{ width: `${Math.round(batch.ratio * 100)}%` }} />
          </div>
          <p className="text-xs text-muted">
            {batch.label || "Idle"} · {batch.current}/{batch.total}
          </p>
        </div>
      ) : null}
      <ReviewGallery />
    </div>
  );
}

function LogPanel() {
  const logs = useStudio((s) => s.logs);
  const issues = useStudio((s) => s.issues);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="font-serif text-lg text-fg">Validation</p>
        <Button variant="ghost" size="sm" onClick={() => useStudio.getState().clearLogs()}>
          Clear log
        </Button>
      </div>
      {issues.length === 0 ? (
        <p className="text-sm text-ok">No issues in the loaded set.</p>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue, index) => (
            <li
              key={`${issue.code}-${issue.itemId}-${index}`}
              className="flex gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 p-3 text-sm"
            >
              <AlertTriangle
                className={cn("mt-0.5 size-4 shrink-0", issue.level === "error" ? "text-danger" : "text-gilt")}
              />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="font-serif text-lg text-fg">Activity</p>
      <ul className="space-y-2">
        {logs.length === 0 ? <p className="text-sm text-muted">Nothing processed yet.</p> : null}
        {logs.map((entry) => (
          <li key={entry.id} className="border-b border-border pb-2 text-sm">
            <p className={entry.level === "error" ? "text-danger" : "text-fg"}>{entry.message}</p>
            {entry.detail ? <p className="mt-1 text-xs text-faint">{entry.detail}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-faint">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="normal-case tracking-normal text-sm text-fg">{label}</Label>
      {children}
    </div>
  );
}

function Num({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  locked,
  onToggleLock,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  locked?: boolean;
  onToggleLock?: () => void;
}) {
  return (
    <div className={cn("space-y-2", locked && "opacity-80")}>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-1.5">
          {onToggleLock ? (
            <button
              type="button"
              aria-label={`${locked ? "Unlock" : "Lock"} ${label}`}
              aria-pressed={Boolean(locked)}
              title={locked ? "Locked for every sign and workbook. Click to unlock." : "Lock this position"}
              onClick={onToggleLock}
              className={cn(
                "flex size-8 items-center justify-center rounded-[var(--radius-sm)] border",
                locked ? "border-gilt bg-surface-2 text-gilt" : "border-border text-faint hover:text-fg",
              )}
            >
              {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            </button>
          ) : null}
          <input
            type="number"
            disabled={locked}
            className="h-8 w-20 rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2 text-right text-xs tabular-nums text-fg disabled:cursor-not-allowed disabled:text-muted"
            value={Number(value.toFixed(2))}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={locked}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </div>
  );
}

const selectClass =
  "h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 text-sm text-fg";

function patchBadge(partial: Record<string, number>) {
  const template = useStudio.getState().template;
  if (!template.badge) return;
  useStudio.getState().patchTemplate({ badge: { ...template.badge, ...partial } });
}

function patchRegion(partial: Record<string, number>) {
  const template = useStudio.getState().template;
  useStudio.getState().patchTemplate({ textRegion: { ...template.textRegion, ...partial } });
}

function ingestCsv(text: string, name: string) {
  const parsed = ingestHoroscopeText(text);
  useStudio.getState().setItems(parsed.items, parsed.dates);
  const preferred =
    parsed.items.find((item) => item.date === "2026-09-21" && item.channel === "Capricorn") ??
    parsed.items[0];
  if (preferred) useStudio.getState().select(preferred.id);
  parsed.warnings.forEach((warning) => useStudio.getState().log("warn", warning));
  useStudio.getState().log("info", `Loaded ${parsed.items.length} readings from ${name}.`);
  toast(`Loaded ${parsed.items.length} readings`);
}

async function runJobs(assets: LoadedAssets | null, jobs: ContentItem[], asZip: boolean) {
  const saveFile = window.aetherDesktop?.saveReviewFile
    ? async (filename: string, bytes: Uint8Array) => {
        const date = /^\d{4}-\d{2}-\d{2}/.exec(filename)?.[0] ?? jobs[0]?.date ?? "undated";
        return window.aetherDesktop!.saveReviewFile(filename, bytes, date);
      }
    : window.__aetherSaveReviewFile;
  const result = await runRenderJobs(assets, jobs, asZip && !saveFile, {
    saveFile,
    yieldEvery: saveFile ? 30 : 4,
  });
  const ok = result.saved.length;
  const failed = result.failed.length;
  if (failed) toast.error(`${failed} failed · ${ok} saved`);
  else toast(`Finished ${jobs.length} job${jobs.length === 1 ? "" : "s"}`);
}
