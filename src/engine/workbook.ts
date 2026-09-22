import * as XLSX from "xlsx";
import type { ContentItem, SheetPreview, WorkbookMapping } from "./types";
import { formatSubtitle, type ZodiacColumn, ZODIAC_COLUMNS } from "./csv";
import { signSlug } from "@/templates/horoscope/signs";
import {
  applyProduction,
  assembleReading,
  extractProduction,
  findHeader,
  mergeProduction,
  splitLenses,
  type ProductionFields,
} from "./production";

export type { SheetPreview, WorkbookMapping };
export type WorkbookFormat = WorkbookMapping["format"];

export interface WorkbookInspect {
  name: string;
  sheets: SheetPreview[];
  suggested: WorkbookMapping | null;
  confidence: "high" | "low";
}

export interface WorkbookParseResult {
  items: ContentItem[];
  dates: string[];
  warnings: string[];
  mapping: WorkbookMapping;
  sourceName: string;
}

const SIGN_ALIASES: Record<string, ZodiacColumn> = Object.fromEntries(
  ZODIAC_COLUMNS.flatMap((sign) => {
    const slug = sign.toLowerCase();
    return [
      [slug, sign],
      [slug.slice(0, 3), sign],
      [signSlug(sign), sign],
    ];
  }),
) as Record<string, ZodiacColumn>;

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function looksLikeDateHeader(header: string): boolean {
  const key = norm(header);
  return key === "date" || key === "day" || key === "dt" || key === "calendardate";
}

function looksLikeSignHeader(header: string): boolean {
  const key = norm(header);
  return key === "sign" || key === "zodiac" || key === "zodiacsign" || key === "star" || key === "starsign";
}

function looksLikeReadingHeader(header: string): boolean {
  const key = norm(header);
  return (
    key === "reading" ||
    key === "horoscope" ||
    key === "text" ||
    key === "body" ||
    key === "copy" ||
    key === "content" ||
    key === "forecast"
  );
}

export function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIso(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const year = parsed.y;
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const us = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(raw);
  if (us) {
    const a = Number(us[1]);
    const b = Number(us[2]);
    let year = Number(us[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const named = Date.parse(raw);
  if (!Number.isNaN(named)) return toIso(new Date(named));
  return null;
}

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return normalizeDate(value) ?? "";
  return String(value).trim();
}

function matchSign(header: string): ZodiacColumn | null {
  return SIGN_ALIASES[norm(header)] ?? null;
}

function headerRowFrom(rows: unknown[][]): { headers: string[]; body: unknown[][]; index: number } {
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 12);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    const labels = row.map((cell) => cellText(cell));
    let score = 0;
    if (labels.some(looksLikeDateHeader)) score += 3;
    score += labels.filter((label) => matchSign(label)).length * 2;
    if (labels.some(looksLikeSignHeader)) score += 2;
    if (labels.some(looksLikeReadingHeader)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  const headers = (rows[best] ?? []).map((cell, index) => cellText(cell) || `Column ${index + 1}`);
  return { headers, body: rows.slice(best + 1), index: best };
}

export function inspectWorkbook(data: ArrayBuffer | Uint8Array, name: string): WorkbookInspect {
  const workbook = XLSX.read(asBytes(data), { type: "array", cellDates: true });
  const sheets: SheetPreview[] = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const table = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const { headers, body } = headerRowFrom(table);
    return {
      name: sheetName,
      headers,
      rows: body.slice(0, 6).map((row) => headers.map((_, i) => cellText(row?.[i]))),
    };
  });
  const suggested = suggestMapping(sheets);
  return {
    name,
    sheets,
    suggested,
    confidence: suggested ? "high" : "low",
  };
}

export function suggestMapping(sheets: SheetPreview[]): WorkbookMapping | null {
  let best: { mapping: WorkbookMapping; score: number } | null = null;
  for (const sheet of sheets) {
    const namedBonus = /reading/i.test(sheet.name) ? 25 : /horoscope|content/i.test(sheet.name) ? 8 : 0;
    const dateColumn = sheet.headers.find(looksLikeDateHeader);
    const signHits = sheet.headers
      .map((header) => {
        const sign = matchSign(header);
        return sign ? ([sign, header] as const) : null;
      })
      .filter((entry): entry is readonly [ZodiacColumn, string] => Boolean(entry));
    const uniqueSigns = new Map<ZodiacColumn, string>();
    for (const [sign, header] of signHits) {
      if (!uniqueSigns.has(sign)) uniqueSigns.set(sign, header);
    }

    if (dateColumn && uniqueSigns.size >= 8) {
      const mapping: WorkbookMapping = {
        sheet: sheet.name,
        format: "wide",
        dateColumn,
        signColumns: Object.fromEntries(uniqueSigns) as WorkbookMapping["signColumns"],
        headerRow: 1,
      };
      const score = 50 + uniqueSigns.size * 4 + namedBonus;
      if (!best || score > best.score) best = { mapping, score };
      continue;
    }

    const signColumn = sheet.headers.find(looksLikeSignHeader);
    const readingColumn = sheet.headers.find(looksLikeReadingHeader);
    if (dateColumn && signColumn && readingColumn) {
      const mapping: WorkbookMapping = {
        sheet: sheet.name,
        format: "long",
        dateColumn,
        signColumn,
        readingColumn,
        headerRow: 1,
      };
      const score = 40 + namedBonus + (sheet.headers.some((h) => /music|voice|font/i.test(h)) ? 12 : 0);
      if (!best || score > best.score) best = { mapping, score };
    }
  }
  return best?.mapping ?? null;
}

export function applyWorkbookMapping(
  data: ArrayBuffer | Uint8Array,
  name: string,
  mapping: WorkbookMapping,
  templateId = "horoscope",
): WorkbookParseResult {
  const workbook = XLSX.read(asBytes(data), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[mapping.sheet];
  if (!sheet) {
    return {
      items: [],
      dates: [],
      warnings: [`Worksheet “${mapping.sheet}” was not found.`],
      mapping,
      sourceName: name,
    };
  }
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const { headers, body } = headerRowFrom(table);
  const col = (label?: string) => (label ? headers.findIndex((header) => header === label) : -1);
  const warnings: string[] = [];
  const items: ContentItem[] = [];
  const dates: string[] = [];
  const defaults = readKeyValues(workbook, "Defaults");
  const dayDefaults = readDayDefaults(workbook);

  const titleIdx = findHeader(headers, ["title", "headline"]);
  const subtitleIdx = findHeader(headers, ["subtitle", "subhead"]);

  if (mapping.format === "wide") {
    const dateIdx = col(mapping.dateColumn);
    if (dateIdx < 0) warnings.push(`Date column “${mapping.dateColumn}” is missing.`);
    const signFields = ZODIAC_COLUMNS.map((sign) => ({
      sign,
      header: mapping.signColumns?.[sign] ?? "",
      index: col(mapping.signColumns?.[sign]),
    }));
    const missing = signFields.filter((field) => field.index < 0).map((field) => field.sign);
    if (missing.length) warnings.push(`Unmapped sign columns: ${missing.join(", ")}.`);

    for (const [rowIndex, row] of body.entries()) {
      const date = dateIdx >= 0 ? normalizeDate(row?.[dateIdx]) : null;
      const hasAny = signFields.some((field) => field.index >= 0 && cellText(row?.[field.index]));
      if (!date && !hasAny) continue;
      if (!date) {
        warnings.push(`Row ${rowIndex + 2} has an invalid date.`);
        continue;
      }
      dates.push(date);
      const rowProd = mergeProduction(
        mergeProduction(defaults, dayDefaults.get(date) ?? {}),
        extractProduction(headers, row ?? [], cellText),
      );
      for (const field of signFields) {
        if (field.index < 0) continue;
        const bodyText = cellText(row?.[field.index]);
        items.push(
          finishItem(
            makeItem(date, field.sign, bodyText, templateId, {
              title: titleIdx >= 0 ? cellText(row?.[titleIdx]) : undefined,
              subtitle: subtitleIdx >= 0 ? cellText(row?.[subtitleIdx]) : undefined,
            }),
            rowProd,
          ),
        );
      }
    }
  } else {
    const dateIdx = col(mapping.dateColumn);
    const signIdx = col(mapping.signColumn);
    const readingIdx = col(mapping.readingColumn);
    if (dateIdx < 0) warnings.push(`Date column “${mapping.dateColumn}” is missing.`);
    if (signIdx < 0) warnings.push(`Sign column “${mapping.signColumn}” is missing.`);
    if (readingIdx < 0) warnings.push(`Reading column “${mapping.readingColumn}” is missing.`);

    for (const [rowIndex, row] of body.entries()) {
      const date = dateIdx >= 0 ? normalizeDate(row?.[dateIdx]) : null;
      const signRaw = signIdx >= 0 ? cellText(row?.[signIdx]) : "";
      const reading = readingIdx >= 0 ? cellText(row?.[readingIdx]) : "";
      if (!date && !signRaw && !reading) continue;
      if (!date) {
        warnings.push(`Row ${rowIndex + 2} has an invalid date.`);
        continue;
      }
      const sign = matchSign(signRaw);
      if (!sign) {
        warnings.push(`Row ${rowIndex + 2} has an unknown sign “${signRaw}”.`);
        continue;
      }
      dates.push(date);
      const prod = mergeProduction(
        mergeProduction(defaults, dayDefaults.get(date) ?? {}),
        extractProduction(headers, row ?? [], cellText),
      );
      items.push(
        finishItem(
          makeItem(date, sign, reading, templateId, {
            title: titleIdx >= 0 ? cellText(row?.[titleIdx]) : undefined,
            subtitle: subtitleIdx >= 0 ? cellText(row?.[subtitleIdx]) : undefined,
          }),
          prod,
        ),
      );
    }
  }

  return {
    items,
    dates: [...new Set(dates)],
    warnings,
    mapping,
    sourceName: name,
  };
}

function makeItem(
  date: string,
  sign: ZodiacColumn,
  body: string,
  templateId: string,
  extras?: { title?: string; subtitle?: string },
): ContentItem {
  return {
    id: `${date}_${sign}`,
    templateId,
    date,
    channel: sign,
    title: extras?.title?.trim() || sign.toUpperCase(),
    subtitle: extras?.subtitle?.trim() || formatSubtitle(date),
    body,
    assetKey: sign.toLowerCase(),
  };
}

function finishItem(item: ContentItem, fields: ProductionFields): ContentItem {
  const next = applyProduction(item, fields);
  if (!next.body) next.body = assembleReading(fields, item.body);
  return next;
}

function readKeyValues(workbook: XLSX.WorkBook, sheetName: string): ProductionFields {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return {};
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const fields: ProductionFields = {};
  for (const row of table) {
    const key = cellText(row?.[0]);
    const value = cellText(row?.[1]);
    if (!key || !value || /^key$/i.test(key)) continue;
    const fakeHeaders = [key];
    const extracted = extractProduction(fakeHeaders, [value], cellText);
    Object.assign(fields, extracted);
  }
  return fields;
}

function readDayDefaults(workbook: XLSX.WorkBook): Map<string, ProductionFields> {
  const map = new Map<string, ProductionFields>();
  const sheet = workbook.Sheets.Days ?? workbook.Sheets.Day;
  if (!sheet) return map;
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const { headers, body } = headerRowFrom(table);
  const dateIdx = findHeader(headers, ["date", "day"]);
  if (dateIdx < 0) return map;
  for (const row of body) {
    const date = normalizeDate(row?.[dateIdx]);
    if (!date) continue;
    map.set(date, extractProduction(headers, row ?? [], cellText));
  }
  return map;
}

export function mappingLabel(mapping: WorkbookMapping): string {
  if (mapping.format === "wide") {
    const count = Object.keys(mapping.signColumns ?? {}).length;
    return `${mapping.sheet} · ${mapping.dateColumn} · ${count} sign columns`;
  }
  return `${mapping.sheet} · ${mapping.dateColumn} / ${mapping.signColumn} / ${mapping.readingColumn}`;
}

function writeCell(sheet: XLSX.WorkSheet, r: number, c: number, value: string) {
  const addr = XLSX.utils.encode_cell({ r, c });
  sheet[addr] = { t: "s", v: value, w: value };
  const ref = sheet["!ref"] ?? "A1";
  const range = XLSX.utils.decode_range(ref);
  if (r > range.e.r) range.e.r = r;
  if (c > range.e.c) range.e.c = c;
  if (r < range.s.r) range.s.r = r;
  if (c < range.s.c) range.s.c = c;
  sheet["!ref"] = XLSX.utils.encode_range(range);
}

function bytesFromWrite(out: unknown): ArrayBuffer {
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export function updateWorkbookReading(
  data: ArrayBuffer | Uint8Array,
  mapping: WorkbookMapping,
  item: ContentItem,
  reading: string,
): ArrayBuffer {
  const workbook = XLSX.read(asBytes(data), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[mapping.sheet];
  if (!sheet) throw new Error(`Worksheet “${mapping.sheet}” was not found.`);
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const { headers, body, index: headerIndex } = headerRowFrom(table);
  const col = (label?: string) => (label ? headers.findIndex((header) => header === label) : -1);
  const lenses = splitLenses(reading);
  const titleIdx = findHeader(headers, ["title", "headline"]);
  const subtitleIdx = findHeader(headers, ["subtitle", "subhead"]);
  const lensIdx = {
    intro: findHeader(headers, ["intro", "lede", "opening"]),
    money: findHeader(headers, ["money"]),
    love: findHeader(headers, ["love"]),
    work: findHeader(headers, ["work"]),
    caution: findHeader(headers, ["caution"]),
  };

  const applyLenses = (sheetRow: number) => {
    if (lensIdx.intro >= 0 && lenses.intro) writeCell(sheet, sheetRow, lensIdx.intro, lenses.intro);
    if (lensIdx.money >= 0 && lenses.money) writeCell(sheet, sheetRow, lensIdx.money, lenses.money);
    if (lensIdx.love >= 0 && lenses.love) writeCell(sheet, sheetRow, lensIdx.love, lenses.love);
    if (lensIdx.work >= 0 && lenses.work) writeCell(sheet, sheetRow, lensIdx.work, lenses.work);
    if (lensIdx.caution >= 0 && lenses.caution) writeCell(sheet, sheetRow, lensIdx.caution, lenses.caution);
    if (titleIdx >= 0) writeCell(sheet, sheetRow, titleIdx, item.title ?? "");
    if (subtitleIdx >= 0) writeCell(sheet, sheetRow, subtitleIdx, item.subtitle ?? "");
  };

  let written = false;
  if (mapping.format === "wide") {
    const dateIdx = col(mapping.dateColumn);
    const signIdx = col(mapping.signColumns?.[item.channel]);
    if (dateIdx < 0 || signIdx < 0) throw new Error("Date or sign column is missing.");
    for (const [rowIndex, row] of body.entries()) {
      if (normalizeDate(row?.[dateIdx]) !== item.date) continue;
      const sheetRow = headerIndex + 1 + rowIndex;
      writeCell(sheet, sheetRow, signIdx, reading);
      applyLenses(sheetRow);
      written = true;
      break;
    }
  } else {
    const dateIdx = col(mapping.dateColumn);
    const signIdx = col(mapping.signColumn);
    const readingIdx = col(mapping.readingColumn);
    if (dateIdx < 0 || signIdx < 0 || readingIdx < 0) {
      throw new Error("Date, sign, or reading column is missing.");
    }
    for (const [rowIndex, row] of body.entries()) {
      const date = normalizeDate(row?.[dateIdx]);
      const sign = matchSign(cellText(row?.[signIdx]));
      if (date !== item.date || sign !== item.channel) continue;
      const sheetRow = headerIndex + 1 + rowIndex;
      writeCell(sheet, sheetRow, readingIdx, reading);
      applyLenses(sheetRow);
      written = true;
      break;
    }
    if (!written) {
      const sheetRow = headerIndex + 1 + body.length;
      writeCell(sheet, sheetRow, dateIdx, item.date ?? "");
      writeCell(sheet, sheetRow, signIdx, item.channel);
      writeCell(sheet, sheetRow, readingIdx, reading);
      if (titleIdx >= 0) writeCell(sheet, sheetRow, titleIdx, item.title ?? item.channel.toUpperCase());
      if (subtitleIdx >= 0) writeCell(sheet, sheetRow, subtitleIdx, item.subtitle ?? "");
      applyLenses(sheetRow);
      written = true;
    }
  }

  if (!written) throw new Error(`No ${item.channel} row for ${item.date}.`);
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return bytesFromWrite(out);
}

