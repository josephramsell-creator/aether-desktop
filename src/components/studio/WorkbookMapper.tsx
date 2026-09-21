import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ZODIAC_COLUMNS, type ZodiacColumn } from "@/engine/csv";
import type { SheetPreview, WorkbookMapping } from "@/engine/types";

const selectClass =
  "h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 text-sm text-fg";

export function WorkbookMapper({
  sheets,
  initial,
  onCancel,
  onApply,
}: {
  sheets: SheetPreview[];
  initial: WorkbookMapping | null;
  onCancel: () => void;
  onApply: (mapping: WorkbookMapping) => void;
}) {
  const [sheetName, setSheetName] = useState(initial?.sheet ?? sheets[0]?.name ?? "");
  const [format, setFormat] = useState<WorkbookMapping["format"]>(initial?.format ?? "wide");
  const sheet = sheets.find((entry) => entry.name === sheetName) ?? sheets[0];
  const headers = sheet?.headers ?? [];

  const defaultDate = initial?.dateColumn ?? headers.find((h) => /date|day/i.test(h)) ?? headers[0] ?? "";
  const [dateColumn, setDateColumn] = useState(defaultDate);
  const [signColumn, setSignColumn] = useState(initial?.signColumn ?? headers.find((h) => /sign|zodiac/i.test(h)) ?? "");
  const [readingColumn, setReadingColumn] = useState(
    initial?.readingColumn ?? headers.find((h) => /read|horoscope|text|body|copy/i.test(h)) ?? "",
  );
  const [signColumns, setSignColumns] = useState<Partial<Record<ZodiacColumn, string>>>(
    initial?.signColumns ??
      Object.fromEntries(headers.filter((h) => ZODIAC_COLUMNS.includes(h as ZodiacColumn)).map((h) => [h, h])),
  );

  const preview = useMemo(() => sheet?.rows.slice(0, 4) ?? [], [sheet]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-2xl">
        <p className="font-serif text-2xl text-fg">Column mapping</p>
        <p className="mt-1 text-sm text-muted">
          Tell Aether which worksheet and columns hold Date, Sign, and Reading. Music, voice, font, and the rest of
          the production columns are read automatically from matching headers.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <Label>Worksheet</Label>
            <select className={selectClass} value={sheetName} onChange={(e) => setSheetName(e.target.value)}>
              {sheets.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <Label>Layout</Label>
            <select
              className={selectClass}
              value={format}
              onChange={(e) => setFormat(e.target.value as WorkbookMapping["format"])}
            >
              <option value="wide">Wide — one column per sign</option>
              <option value="long">Long — one row per sign</option>
            </select>
          </label>
          <label className="space-y-2">
            <Label>Date column</Label>
            <select className={selectClass} value={dateColumn} onChange={(e) => setDateColumn(e.target.value)}>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
          {format === "long" ? (
            <>
              <label className="space-y-2">
                <Label>Sign column</Label>
                <select className={selectClass} value={signColumn} onChange={(e) => setSignColumn(e.target.value)}>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 sm:col-span-2">
                <Label>Reading column</Label>
                <select className={selectClass} value={readingColumn} onChange={(e) => setReadingColumn(e.target.value)}>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <div className="sm:col-span-2 grid grid-cols-2 gap-2 md:grid-cols-3">
              {ZODIAC_COLUMNS.map((sign) => (
                <label key={sign} className="space-y-1">
                  <span className="text-xs text-muted">{sign}</span>
                  <select
                    className={selectClass}
                    value={signColumns[sign] ?? ""}
                    onChange={(e) => setSignColumns((current) => ({ ...current, [sign]: e.target.value }))}
                  >
                    <option value="">—</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>

        {preview.length ? (
          <div className="mt-5 overflow-x-auto rounded-[var(--radius-md)] border border-border">
            <table className="min-w-full text-left text-xs text-muted">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {headers.slice(0, 8).map((header) => (
                    <th key={header} className="px-2 py-2 font-medium text-fg">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-border/60">
                    {row.slice(0, 8).map((cell, j) => (
                      <td key={j} className="max-w-[140px] truncate px-2 py-1">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onApply({
                sheet: sheetName,
                format,
                dateColumn,
                signColumn: format === "long" ? signColumn : undefined,
                readingColumn: format === "long" ? readingColumn : undefined,
                signColumns: format === "wide" ? signColumns : undefined,
                headerRow: 1,
              })
            }
          >
            Use this mapping
          </Button>
        </div>
      </div>
    </div>
  );
}
