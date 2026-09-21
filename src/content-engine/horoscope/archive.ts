import { parseHoroscopeCsv, serializeHoroscopeCsv, type ParseResult } from "@/engine/csv";
import type { ContentItem } from "@/engine/types";
import { ZODIAC_SIGNS, type ZodiacSign } from "@/templates/horoscope/signs";

const MONTHS: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

const LENSES = ["Money", "Love", "Work", "Caution"] as const;

export function looksLikeHoroscopeMarkdown(text: string): boolean {
  return /^#{1,3}\s/m.test(text) && /###\s+(Capricorn|Aquarius|Pisces|Aries)/m.test(text);
}

/**
 * Convert a dated markdown archive (## Day / ### Sign / Money-Love-Work-Caution)
 * into the same CSV shape the renderer consumes.
 */
export function parseHoroscopeMarkdown(text: string, templateId = "horoscope"): ParseResult {
  const warnings: string[] = [];
  const rows: { date: string; readings: Record<string, string> }[] = [];

  const sections = text.split(/^## /m).slice(1);
  for (const section of sections) {
    const firstNl = section.indexOf("\n");
    if (firstNl < 0) continue;
    const heading = section.slice(0, firstNl).trim();
    const match = heading.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
    if (!match) continue;
    const month = MONTHS[match[1] ?? ""];
    if (!month) {
      warnings.push(`Skipped heading with unknown month: ${heading}`);
      continue;
    }
    const date = `${match[3]}-${month}-${String(match[2]).padStart(2, "0")}`;
    const body = section.slice(firstNl + 1);
    const readings: Record<string, string> = {};
    for (const part of body.split(/^### /m).slice(1)) {
      const nl = part.indexOf("\n");
      if (nl < 0) continue;
      const sign = part.slice(0, nl).trim();
      if (!ZODIAC_SIGNS.includes(sign as ZodiacSign)) {
        warnings.push(`${date}: skipped unknown sign “${sign}”.`);
        continue;
      }
      try {
        readings[sign] = formatReading(part.slice(nl + 1));
      } catch (err) {
        warnings.push(`${date} ${sign}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const missing = ZODIAC_SIGNS.filter((sign) => !readings[sign]);
    if (missing.length) {
      warnings.push(`${date} missing ${missing.join(", ")}.`);
    }
    rows.push({ date, readings });
  }

  if (rows.length === 0) {
    return { items: [], dates: [], warnings: [...warnings, "No dated sign readings found in the markdown."] };
  }

  const csv = serializeFromRows(rows);
  const parsed = parseHoroscopeCsv(csv, templateId);
  return { ...parsed, warnings: [...warnings, ...parsed.warnings] };
}

export function ingestHoroscopeText(text: string, templateId = "horoscope"): ParseResult {
  return looksLikeHoroscopeMarkdown(text)
    ? parseHoroscopeMarkdown(text, templateId)
    : parseHoroscopeCsv(text, templateId);
}

function serializeFromRows(rows: { date: string; readings: Record<string, string> }[]): string {
  const items: ContentItem[] = [];
  for (const row of rows) {
    for (const sign of ZODIAC_SIGNS) {
      const body = row.readings[sign];
      if (!body) continue;
      items.push({
        id: `${row.date}_${sign}`,
        templateId: "horoscope",
        date: row.date,
        channel: sign,
        body,
      });
    }
  }
  return serializeHoroscopeCsv(items);
}

function formatReading(raw: string): string {
  const flat = unwrap(raw.replace(/\*\*/g, ""))
    .replace(/--/g, "–")
    .replace(/; ([A-Z])/g, ". $1")
    .replace(
      /, ([a-z][^,]{0,48}), and ([a-z][^,]{0,48}) becomes the useful/g,
      ", $1, and $2 become the useful",
    )
    .replace(/As Libra season begins shapes/g, "As Libra season begins, it shapes")
    .replace(/As Mars enters Leo shapes/g, "As Mars enters Leo, it shapes")
    .replace(/As Mercury enters Scorpio shapes/g, "As Mercury enters Scorpio, it shapes")
    .replace(/As Integration day shapes/g, "As this integration day shapes")
    .replace(/As Aries Full Moon shapes/g, "As the Aries Full Moon shapes")
    .replace(/\s+/g, " ")
    .trim();

  const parts: Record<string, string> = {};
  let remaining = flat;
  let intro = flat;
  for (let i = 0; i < LENSES.length; i++) {
    const label = LENSES[i]!;
    const start = remaining.search(new RegExp(`\\b${label}:`));
    if (start < 0) {
      throw new Error(`missing ${label} lens`);
    }
    if (i === 0) intro = remaining.slice(0, start).trim();
    remaining = remaining.slice(start + label.length + 1);
    const next = LENSES[i + 1];
    if (next) {
      const end = remaining.search(new RegExp(`\\b${next}:`));
      if (end < 0) throw new Error(`missing ${next} lens`);
      parts[label] = trimSentence(remaining.slice(0, end));
      remaining = remaining.slice(end);
    } else {
      parts[label] = trimSentence(remaining);
    }
  }

  return [
    `${trimSentence(intro)}.`,
    "",
    `Money: ${parts.Money}.`,
    `Love: ${parts.Love}.`,
    `Work: ${parts.Work}.`,
    `Caution: ${parts.Caution}.`,
  ].join("\n");
}

function unwrap(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

function trimSentence(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
}
