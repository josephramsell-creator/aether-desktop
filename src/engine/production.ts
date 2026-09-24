import type { ContentItem, TemplateConfig, WorkbookMapping } from "./types";
import { parseSections } from "./cuts";

export interface ProductionFields {
  theme?: string;
  intro?: string;
  money?: string;
  love?: string;
  work?: string;
  caution?: string;
  music?: string;
  musicFile?: string;
  voice?: string;
  font?: string;
  fontSize?: number;
  textColor?: string;
  charsPerSecond?: number;
  linesPerPage?: number;
  cta?: string;
  hashtags?: string;
  status?: string;
  notes?: string;
}

export const PRODUCTION_ALIASES: Record<keyof ProductionFields, string[]> = {
  theme: ["theme", "daytheme", "dailytheme"],
  intro: ["intro", "lede", "opening"],
  money: ["money"],
  love: ["love"],
  work: ["work"],
  caution: ["caution"],
  music: ["music", "track", "audio", "song", "bed"],
  musicFile: ["musicfile", "audiofile", "trackfile"],
  voice: ["voice", "voiceover", "vo", "narrator"],
  font: ["font", "typeface", "fontfamily"],
  fontSize: ["fontsize", "size", "typesize"],
  textColor: ["textcolor", "color", "ink"],
  charsPerSecond: ["charspersecond", "cps", "speed", "typewriterspeed"],
  linesPerPage: ["linesperpage", "lines", "pagelines"],
  cta: ["cta", "calltoaction"],
  hashtags: ["hashtags", "tags"],
  status: ["status", "state"],
  notes: ["notes", "note"],
};

export const CANONICAL_READING_HEADERS = [
  "date",
  "sign",
  "title",
  "subtitle",
  "theme",
  "intro",
  "money",
  "love",
  "work",
  "caution",
  "reading",
  "music",
  "music_file",
  "voice",
  "font",
  "font_size",
  "text_color",
  "chars_per_second",
  "lines_per_page",
  "cta",
  "hashtags",
  "status",
  "notes",
] as const;

export const DEFAULT_WORKBOOK_MAPPING: WorkbookMapping = {
  sheet: "Readings",
  format: "long",
  dateColumn: "date",
  signColumn: "sign",
  readingColumn: "reading",
  headerRow: 1,
};

export function normHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findHeader(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(normHeader(header)));
}

export function parseNumber(value: string): number | undefined {
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function assembleReading(fields: ProductionFields, fallback = ""): string {
  if (fallback.trim()) return fallback.trim();
  const lenses = [
    fields.money ? `Money: ${trimDot(fields.money)}.` : "",
    fields.love ? `Love: ${trimDot(fields.love)}.` : "",
    fields.work ? `Work: ${trimDot(fields.work)}.` : "",
    fields.caution ? `Caution: ${trimDot(fields.caution)}.` : "",
  ].filter(Boolean);
  const intro = fields.intro?.trim() ?? "";
  return [intro, lenses.length ? "" : "", ...lenses].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function trimDot(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
}

export function splitLenses(body: string): Pick<ProductionFields, "intro" | "money" | "love" | "work" | "caution"> {
  // Sections may appear in any order (Love before Money, an Astrology note at the end, ...).
  const sections = parseSections(body);
  const clean = (text?: string) => (text ? trimDot(text) : undefined);
  return {
    intro: sections.intro,
    money: clean(sections.money),
    love: clean(sections.love),
    work: clean(sections.work),
    caution: clean(sections.caution),
  };
}

export function extractProduction(headers: string[], row: unknown[], getText: (value: unknown) => string): ProductionFields {
  const fields: ProductionFields = {};
  (Object.keys(PRODUCTION_ALIASES) as (keyof ProductionFields)[]).forEach((key) => {
    const index = findHeader(headers, PRODUCTION_ALIASES[key]);
    if (index < 0) return;
    const text = getText(row[index]);
    if (!text) return;
    if (key === "fontSize" || key === "charsPerSecond" || key === "linesPerPage") {
      const n = parseNumber(text);
      if (n) (fields[key] as number) = n;
      return;
    }
    (fields[key] as string) = text;
  });
  return fields;
}

export function applyProduction(item: ContentItem, fields: ProductionFields): ContentItem {
  const body = assembleReading(fields, item.body);
  return {
    ...item,
    body,
    title: item.title,
    subtitle: item.subtitle,
    theme: fields.theme ?? item.theme,
    intro: fields.intro ?? item.intro,
    money: fields.money ?? item.money,
    love: fields.love ?? item.love,
    work: fields.work ?? item.work,
    caution: fields.caution ?? item.caution,
    music: fields.music ?? item.music,
    musicFile: fields.musicFile ?? item.musicFile,
    voice: fields.voice ?? item.voice,
    font: fields.font ?? item.font,
    fontSize: fields.fontSize ?? item.fontSize,
    textColor: fields.textColor ?? item.textColor,
    charsPerSecond: fields.charsPerSecond ?? item.charsPerSecond,
    linesPerPage: fields.linesPerPage ?? item.linesPerPage,
    cta: fields.cta ?? item.cta,
    hashtags: fields.hashtags ?? item.hashtags,
    status: fields.status ?? item.status,
    notes: fields.notes ?? item.notes,
  };
}

export function mergeProduction(base: ProductionFields, overlay: ProductionFields): ProductionFields {
  const next = { ...base };
  (Object.keys(overlay) as (keyof ProductionFields)[]).forEach((key) => {
    const value = overlay[key];
    if (value !== undefined && value !== "") (next as Record<string, unknown>)[key] = value;
  });
  return next;
}

export function templateForItem(template: TemplateConfig, item: ContentItem): TemplateConfig {
  const typography = { ...template.textTypography };
  const typewriter = { ...template.typewriter };
  let changed = false;
  if (item.font) {
    typography.fontFamily = item.font;
    changed = true;
  }
  if (item.fontSize) {
    typography.fontSize = item.fontSize;
    changed = true;
  }
  if (item.textColor) {
    typography.color = item.textColor;
    changed = true;
  }
  if (item.charsPerSecond) {
    typewriter.charsPerSecond = item.charsPerSecond;
    changed = true;
  }
  if (item.linesPerPage) {
    typewriter.linesPerPage = item.linesPerPage;
    changed = true;
  }
  if (!changed) return template;
  return { ...template, textTypography: typography, typewriter };
}

export function musicSrc(item: ContentItem): string | null {
  const raw = (item.musicFile || "").trim();
  if (raw) {
    const cleaned = raw.replace(/^\/+/, "").replace(/^data\//, "");
    if (cleaned.startsWith("music/")) return `/${cleaned}`;
    return `/music/${cleaned}`;
  }
  if (item.music) {
    const slug = item.music.trim().toLowerCase().replace(/\s+/g, "-");
    return `/music/${slug}.mp3`;
  }
  return null;
}
