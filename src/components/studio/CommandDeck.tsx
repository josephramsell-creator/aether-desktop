import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FolderOpen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ingestHoroscopeText } from "@/content-engine/horoscope/archive";
import { runStudioJobs } from "@/engine/batch";
import type { LoadedAssets } from "@/engine/assets";
import { persistWorkbookFile, savePersistedMapping } from "@/engine/persist";
import { blockingErrors, validateDay } from "@/engine/validator";
import { createCanvasMeasurer } from "@/engine/layout";
import type { SheetPreview, WorkbookMapping } from "@/engine/types";
import { SIGN_GLYPH, ZODIAC_SIGNS } from "@/templates/horoscope/signs";
import { useStudio } from "@/store/studio";
import { cn } from "@/lib/utils";
import { musicSrc, splitLenses } from "@/engine/production";
import { WorkbookMapper } from "./WorkbookMapper";

export function CommandDeck({ assets }: { assets: LoadedAssets | null }) {
  const items = useStudio((s) => s.items);
  const dates = useStudio((s) => s.dates);
  const selectedId = useStudio((s) => s.selectedId);
  const sourceName = useStudio((s) => s.sourceName);
  const mapping = useStudio((s) => s.mapping);
  const workbookBytes = useStudio((s) => s.workbookBytes);
  const workbookPath = useStudio((s) => s.workbookPath);
  const issues = useStudio((s) => s.issues);
  const batch = useStudio((s) => s.batch);
  const template = useStudio((s) => s.template);
  const item = items.find((entry) => entry.id === selectedId);
  const date = item?.date ?? dates[0] ?? "";
  const fileRef = useRef<HTMLInputElement>(null);
  const workbookRef = useRef<{ name: string; data: ArrayBuffer; sheets: SheetPreview[] } | null>(null);
  const [mapperOpen, setMapperOpen] = useState(false);
  const [draft, setDraft] = useState(item?.body ?? "");
  const [savedBody, setSavedBody] = useState(item?.body ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(item?.body ?? "");
    setSavedBody(item?.body ?? "");
  }, [item?.id, sourceName]);

  const dayItems = useMemo(
    () => items.filter((entry) => entry.date === date),
    [items, date],
  );

  const dayIssues = useMemo(() => {
    if (typeof document === "undefined") return [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const measure = ctx ? createCanvasMeasurer(ctx, template.textTypography) : null;
    return validateDay(items, date, template, measure);
  }, [items, date, template]);

  const readyCount = ZODIAC_SIGNS.filter((sign) => {
    const row = dayItems.find((entry) => entry.channel === sign);
    return row && !blockingErrors(dayIssues, row.id).length;
  }).length;

  async function ingestBytes(name: string, data: ArrayBuffer) {
    const lower = name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const { inspectWorkbook } = await import("@/engine/workbook");
      const inspected = inspectWorkbook(data, name);
      workbookRef.current = { name, data, sheets: inspected.sheets };
      useStudio.getState().setWorkbookFile(data, null);
      const saved = useStudio.getState().mapping;
      const savedFits = Boolean(saved && inspected.sheets.some((sheet) => sheet.name === saved.sheet));
      const chosen = savedFits ? saved : inspected.suggested;
      if (chosen && (inspected.confidence === "high" || savedFits)) {
        await applyMapping(data, name, chosen!);
        return;
      }
      setMapperOpen(true);
      if (!chosen) toast("Choose a worksheet and columns.");
      return;
    }
    const text = new TextDecoder().decode(data);
    const parsed = ingestHoroscopeText(text);
    useStudio.getState().setItems(parsed.items, parsed.dates);
    useStudio.getState().setSource(name, null);
    parsed.warnings.forEach((warning) => useStudio.getState().log("warn", warning));
    useStudio.getState().log("info", `Loaded ${parsed.items.length} readings from ${name}.`);
    toast(`Loaded ${parsed.items.length} readings`);
  }

  async function ingestFile(file: File) {
    await ingestBytes(file.name, await file.arrayBuffer());
  }

  async function applyMapping(data: ArrayBuffer, name: string, next: WorkbookMapping) {
    const { applyWorkbookMapping, mappingLabel } = await import("@/engine/workbook");
    const parsed = applyWorkbookMapping(data, name, next);
    useStudio.getState().setItems(parsed.items, parsed.dates);
    useStudio.getState().setSource(name, next);
    parsed.warnings.forEach((warning) => useStudio.getState().log("warn", warning));
    useStudio.getState().log("info", `Loaded ${parsed.items.length} readings from ${name}.`, mappingLabel(next));
    void savePersistedMapping(next);
    setMapperOpen(false);
    toast(`Loaded ${parsed.items.length} readings`);
  }

  async function openWorkbook() {
    const desktop = window.aetherDesktop;
    if (desktop?.openWorkbook) {
      const picked = await desktop.openWorkbook();
      if (!picked) return;
      const copy = new Uint8Array(picked.bytes);
      const data = new ArrayBuffer(copy.byteLength);
      new Uint8Array(data).set(copy);
      await ingestBytes(picked.name, data);
      useStudio.getState().setWorkbookFile(data, picked.path);
      return;
    }
    fileRef.current?.click();
  }

  async function renderSelection(all: boolean) {
    if (!date) return;
    const blocked = blockingErrors(dayIssues);
    if (all && blocked.length) {
      toast.error("Fix the flagged readings before rendering the full day.");
      useStudio.getState().setTab("output");
      return;
    }
    const jobs = all
      ? ZODIAC_SIGNS.map((sign) => dayItems.find((entry) => entry.channel === sign)).filter(
          (entry): entry is NonNullable<typeof entry> => Boolean(entry),
        )
      : item
        ? [item]
        : [];
    if (!jobs.length) {
      toast.error("Nothing to render.");
      return;
    }
    if (!all && item && blockingErrors(dayIssues, item.id).length) {
      toast.error("This reading is blocked.");
      return;
    }
    const result = await runStudioJobs(assets, jobs);
    if (result.failed.length) toast.error(`${result.failed.length} withheld · ${result.saved.length} saved`);
    else toast(`Saved ${result.saved.length} video${result.saved.length === 1 ? "" : "s"}`);
  }

  async function saveReading() {
    if (!item) return;
    const reading = draft.trim();
    if (!reading) {
      toast.error("Reading is empty.");
      return;
    }
    setSaving(true);
    try {
      const lenses = splitLenses(reading);
      useStudio.getState().updateItem(item.id, {
        body: reading,
        intro: lenses.intro,
        money: lenses.money,
        love: lenses.love,
        work: lenses.work,
        caution: lenses.caution,
      });
      const mappingNow = useStudio.getState().mapping;
      let bytes = useStudio.getState().workbookBytes;
      if (!bytes) {
        const response = await fetch(`/content/aether-production.xlsx?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not open the production workbook.");
        bytes = await response.arrayBuffer();
      }
      if (!mappingNow) throw new Error("Column mapping is missing.");
      const { updateWorkbookReading } = await import("@/engine/workbook");
      const nextBytes = updateWorkbookReading(bytes, mappingNow, { ...item, body: reading }, reading);
      useStudio.getState().setWorkbookFile(nextBytes, useStudio.getState().workbookPath);
      workbookRef.current = workbookRef.current
        ? { ...workbookRef.current, data: nextBytes }
        : workbookRef.current;
      const target = await persistWorkbookFile(sourceName, nextBytes, useStudio.getState().workbookPath);
      setSavedBody(reading);
      setDraft(reading);
      useStudio.getState().log("info", `Saved ${item.channel} ${item.date} to ${sourceName}.`, target);
      if (target === "download") toast("Workbook downloaded with this reading.");
      else toast(`Saved ${item.channel} to the workbook`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the workbook.";
      useStudio.getState().log("error", "Workbook save failed", message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const dirty = Boolean(item) && draft.trim() !== savedBody.trim();

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-4">
      <div>
        <p className="font-serif text-lg text-fg">Workbook</p>
        <p className="mt-1 text-sm text-muted">
          Edit a reading and Save to write it into the workbook. Other columns stay as they are.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          Required: date, sign, reading. Also reads music, music_file, voice, font, font_size, text_color,
          chars_per_second, lines_per_page, title, subtitle, theme, intro, money, love, work, caution, cta, hashtags,
          status, notes.
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-3">
        <p className="text-sm text-fg">{sourceName}</p>
        <p className="mt-1 text-xs text-muted">
          {items.length} readings · {dates.length} days
          {mapping ? ` · ${mapping.sheet}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void openWorkbook()}>
            <FileSpreadsheet className="size-4" />
            Open workbook
          </Button>
          <Button
            variant="ghost"
            disabled={!workbookRef.current && !mapping}
            onClick={() => {
              const openFromStore = async () => {
                const bytes = workbookBytes ?? useStudio.getState().workbookBytes;
                if (workbookRef.current) {
                  setMapperOpen(true);
                  return;
                }
                if (!bytes) {
                  toast("Open a workbook first to change mapping.");
                  return;
                }
                const { inspectWorkbook } = await import("@/engine/workbook");
                const inspected = inspectWorkbook(bytes, sourceName);
                workbookRef.current = { name: sourceName, data: bytes, sheets: inspected.sheets };
                setMapperOpen(true);
              };
              void openFromStore();
            }}
          >
            Column mapping
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <a className="text-gilt underline-offset-2 hover:underline" href="/content/aether-production.xlsx" download>
            Download workbook
          </a>
          <a
            className="text-muted underline-offset-2 hover:underline"
            href="/content/aether-production.template.xlsx"
            download
          >
            Blank template
          </a>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,.md,.markdown"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void ingestFile(file);
            event.target.value = "";
          }}
        />
      </div>

      <label className="space-y-2">
        <Label>Date</Label>
        <select
          className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 text-sm text-fg"
          value={date}
          onChange={(e) => useStudio.getState().selectDateSign(e.target.value)}
        >
          {dates.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-fg">Twelve signs</p>
          <p className={cn("text-xs", readyCount === 12 ? "text-ok" : "text-danger")}>
            {readyCount}/12 ready
          </p>
        </div>
        <div className="grid grid-cols-1 gap-1">
          {ZODIAC_SIGNS.map((sign) => {
            const row = dayItems.find((entry) => entry.channel === sign);
            const blocked = row ? blockingErrors(dayIssues, row.id) : [{ message: "Missing" }];
            const selected = item?.channel === sign;
            return (
              <button
                key={sign}
                type="button"
                onClick={() => {
                  if (row) useStudio.getState().select(row.id);
                  else toast.error(`${date} has no ${sign} reading.`);
                }}
                className={cn(
                  "flex items-center justify-between rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm",
                  selected ? "border-gilt bg-surface-2 text-fg" : "border-transparent text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                  <span>
                    <span className="mr-2 text-gilt">{SIGN_GLYPH[sign]}</span>
                    {sign}
                  </span>
                {blocked.length ? (
                  <AlertTriangle className="size-3.5 text-danger" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-ok" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {item ? (
        <div className="rounded-[var(--radius-md)] border border-border p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-faint">
              {item.date} · {item.channel}
              {item.theme ? ` · ${item.theme}` : ""}
            </p>
            {dirty ? <p className="text-xs text-gilt">Unsaved</p> : null}
          </div>
          <textarea
            value={draft}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              const lenses = splitLenses(next);
              useStudio.getState().updateItem(item.id, {
                body: next,
                intro: lenses.intro,
                money: lenses.money,
                love: lenses.love,
                work: lenses.work,
                caution: lenses.caution,
              });
            }}
            spellCheck
            className="mt-2 h-36 w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-2 text-sm leading-relaxed text-fg outline-none focus-visible:ring-2 focus-visible:ring-gilt/70"
            aria-label={`${item.channel} reading`}
          />
          <Button className="mt-2 w-full" disabled={!dirty || saving} onClick={() => void saveReading()}>
            <Save className="size-4" />
            {saving ? "Saving…" : "Save to workbook"}
          </Button>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
            <dt>Music</dt>
            <dd className="text-fg">{item.music || "—"}</dd>
            <dt>Voice</dt>
            <dd className="text-fg">{item.voice || "typewriter"}</dd>
            <dt>Font</dt>
            <dd className="text-fg">
              {item.font || "template"}
              {item.fontSize ? ` ${item.fontSize}px` : ""}
            </dd>
            <dt>Status</dt>
            <dd className="text-fg">{item.status || "ready"}</dd>
          </dl>
          {musicSrc(item) ? (
            <p className="mt-2 text-[11px] text-faint">Audio bed: {musicSrc(item)} (used when the file is in data/music)</p>
          ) : null}
          {blockingErrors(dayIssues, item.id).map((issue) => (
            <p key={issue.code} className="mt-2 text-xs text-danger">
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2">
        <Button disabled={!item || batch.running} onClick={() => void renderSelection(false)}>
          Render {item?.channel ?? "this sign"}
        </Button>
        <Button variant="secondary" disabled={!date || batch.running} onClick={() => void renderSelection(true)}>
          Render all 12 for {date || "this date"}
        </Button>
        {typeof window !== "undefined" && window.aetherDesktop ? (
          <Button variant="ghost" onClick={() => void window.aetherDesktop?.openOutputFolder(date)}>
            <FolderOpen className="size-4" />
            Open output folder
          </Button>
        ) : null}
      </div>

      {batch.running ? (
        <p className="text-sm text-muted">
          Rendering {batch.current}/{batch.total} · {batch.label}
        </p>
      ) : null}

      {dayIssues.filter((issue) => issue.level === "error" && !issue.itemId).map((issue) => (
        <p key={issue.code + issue.message} className="text-xs text-danger">
          {issue.message}
        </p>
      ))}

      {mapperOpen && workbookRef.current ? (
        <WorkbookMapper
          sheets={workbookRef.current.sheets}
          initial={mapping}
          onCancel={() => setMapperOpen(false)}
          onApply={(next) => void applyMapping(workbookRef.current!.data, workbookRef.current!.name, next)}
        />
      ) : null}
    </div>
  );
}
