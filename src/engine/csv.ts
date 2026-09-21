import Papa from "papaparse";
import type { ContentItem } from "./types";

export const ZODIAC_COLUMNS = [
  "Capricorn",
  "Aquarius",
  "Pisces",
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
] as const;

export type ZodiacColumn = (typeof ZODIAC_COLUMNS)[number];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z]/g, "");
}

const SIGN_ALIASES: Record<string, ZodiacColumn> = Object.fromEntries(
  ZODIAC_COLUMNS.map((sign) => [normalizeHeader(sign), sign]),
) as Record<string, ZodiacColumn>;

export interface ParseResult {
  items: ContentItem[];
  dates: string[];
  warnings: string[];
}

export function parseHoroscopeCsv(text: string, templateId = "horoscope"): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header: string) => header.trim(),
  });

  const warnings: string[] = [...(parsed.errors ?? []).map((err) => err.message)];
  const items: ContentItem[] = [];
  const dates: string[] = [];

  const fields = parsed.meta.fields ?? [];
  const dateField =
    fields.find((field) => normalizeHeader(field) === "date") ??
    fields.find((field) => normalizeHeader(field) === "day") ??
    null;

  if (!dateField) {
    warnings.push("No date column found. Add a date column as the first field.");
  }

  const signFields: { header: string; sign: ZodiacColumn }[] = [];
  for (const header of fields) {
    const sign = SIGN_ALIASES[normalizeHeader(header)];
    if (sign) signFields.push({ header, sign });
  }

  if (signFields.length === 0) {
    warnings.push("No zodiac sign columns found.");
  }

  const missing = ZODIAC_COLUMNS.filter(
    (sign) => !signFields.some((field) => field.sign === sign),
  );
  if (missing.length) {
    warnings.push(`Missing sign columns: ${missing.join(", ")}.`);
  }

  for (const [index, row] of (parsed.data ?? []).entries()) {
    const date = (dateField ? row[dateField] : "")?.trim() ?? "";
    if (date) dates.push(date);
    if (!date && signFields.every((field) => !row[field.header]?.trim())) continue;

    for (const field of signFields) {
      const body = (row[field.header] ?? "").trim();
      items.push({
        id: `${date || `row${index}`}_${field.sign}`,
        templateId,
        date: date || undefined,
        channel: field.sign,
        title: field.sign.toUpperCase(),
        subtitle: formatSubtitle(date),
        body,
        assetKey: field.sign.toLowerCase(),
      });
    }
  }

  return { items, dates: [...new Set(dates)], warnings };
}

export function formatSubtitle(date?: string): string | undefined {
  if (!date) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const year = match[1]!;
  const month = months[Number(match[2]) - 1] ?? match[2];
  const day = String(Number(match[3]));
  return `${month} ${day}, ${year}`;
}

export function serializeHoroscopeCsv(items: ContentItem[]): string {
  const dates = [...new Set(items.map((item) => item.date).filter(Boolean))] as string[];
  const byKey = new Map(items.map((item) => [`${item.date ?? ""}_${item.channel}`, item]));
  const header = ["date", ...ZODIAC_COLUMNS];
  const lines = [header.join(",")];
  for (const date of dates) {
    const cells = [
      date,
      ...ZODIAC_COLUMNS.map((sign) => {
        const item = byKey.get(`${date}_${sign}`);
        return csvEscape(item?.body ?? "");
      }),
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export const CSV_TEMPLATE = `date,${ZODIAC_COLUMNS.join(",")}
2026-09-21,"Capricorn reading…","Aquarius reading…","Pisces reading…","Aries reading…","Taurus reading…","Gemini reading…","Cancer reading…","Leo reading…","Virgo reading…","Libra reading…","Scorpio reading…","Sagittarius reading…"
`;
