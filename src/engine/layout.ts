import type { TypographyConfig } from "./types";

export type MeasureFn = (text: string) => number;

export function wrapText(
  text: string,
  maxWidth: number,
  measure: MeasureFn,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n+/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let current = words[0] ?? "";
    for (let i = 1; i < words.length; i++) {
      const word = words[i] ?? "";
      const trial = `${current} ${word}`;
      if (measure(trial) <= maxWidth) {
        current = trial;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

export function paginateLines(lines: string[], linesPerPage: number): string[][] {
  const size = Math.max(1, Math.floor(linesPerPage));
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += size) {
    pages.push(lines.slice(i, i + size));
  }
  return pages.filter((page) => page.some((line) => line.length > 0));
}

export function longestUnbreakableWord(text: string): string {
  const words = text.trim().split(/\s+/);
  let longest = "";
  for (const word of words) {
    if (word.length > longest.length) longest = word;
  }
  return longest;
}

export function fontShorthand(type: TypographyConfig): string {
  const italic = type.italic ? "italic " : "";
  return `${italic}${type.fontWeight} ${type.fontSize}px "${type.fontFamily}"`;
}

export function createCanvasMeasurer(
  ctx: CanvasRenderingContext2D,
  type: TypographyConfig,
): MeasureFn {
  ctx.save();
  ctx.font = fontShorthand(type);
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${type.letterSpacing}px`;
  }
  const measure: MeasureFn = (text) => ctx.measureText(text).width;
  ctx.restore();
  return (text) => {
    ctx.save();
    ctx.font = fontShorthand(type);
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${type.letterSpacing}px`;
    }
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  };
}

export function layoutCopy(
  body: string,
  maxWidth: number,
  linesPerPage: number,
  measure: MeasureFn,
) {
  const lines = wrapText(body, maxWidth, measure);
  const pages = paginateLines(lines, linesPerPage);
  return { lines, pages };
}
