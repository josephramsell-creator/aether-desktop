import type { ContentItem } from "./types";

/**
 * One source reading renders as up to four videos: the full reading plus a
 * focused short for each of Love, Money and Work.
 */
export type CutId = "full" | "love" | "money" | "work";

export interface CutMeta {
  id: CutId;
  label: string;
  targetSec: number;
  /** Hashtag added to this cut's post. */
  tag: string;
}

export const CUTS: CutMeta[] = [
  { id: "full", label: "Full", targetSec: 60, tag: "horoscope" },
  { id: "love", label: "Love", targetSec: 30, tag: "love" },
  { id: "money", label: "Money", targetSec: 30, tag: "money" },
  { id: "work", label: "Work", targetSec: 30, tag: "career" },
];

export const CUT_IDS = CUTS.map((cut) => cut.id);

export function cutMeta(id: CutId): CutMeta {
  return CUTS.find((cut) => cut.id === id)!;
}

export interface ReadingSections {
  intro: string;
  love?: string;
  money?: string;
  work?: string;
  caution?: string;
  /** "Astrology note:" commentary. */
  note?: string;
}

const LABELS: [RegExp, keyof ReadingSections][] = [
  [/^love(?:\s*(?:&|and)\s*relationships?)?$/i, "love"],
  [/^(?:money|finances?|money\s*(?:&|and)\s*finances?)$/i, "money"],
  [/^(?:work|career|work\s*(?:&|and)\s*career)$/i, "work"],
  [/^caution$/i, "caution"],
  [/^(?:astrology\s*note|note|astro\s*note|commentary)$/i, "note"],
];

function labelKey(label: string): keyof ReadingSections | null {
  const clean = label.trim();
  return LABELS.find(([pattern]) => pattern.test(clean))?.[1] ?? null;
}

/**
 * Split a reading into its labeled parts, in whatever order they appear.
 * Text before the first label is the intro; unlabeled lines after a label
 * belong to that label.
 */
export function parseSections(body: string): ReadingSections {
  const sections: ReadingSections = { intro: "" };
  let current: keyof ReadingSections = "intro";
  const append = (key: keyof ReadingSections, text: string) => {
    const value = text.trim();
    if (!value) return;
    sections[key] = sections[key] ? `${sections[key]} ${value}` : value;
  };
  // Labels written mid-paragraph ("... today. Money: ...") start their own line.
  const text = body
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+(?=(?:love|money|work|career|caution|astrology note)\s*:)/gi, "\n");
  for (const line of text.split(/\n+/)) {
    const match = /^\s*([A-Za-z][A-Za-z &]{1,30}?)\s*:\s*(.*)$/.exec(line);
    const key = match ? labelKey(match[1]!) : null;
    if (key) {
      current = key;
      append(key, match![2]!);
    } else {
      append(current, line);
    }
  }
  return sections;
}

function capitalize(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

function hashtagsFor(item: ContentItem, cut: CutMeta): string {
  const base = item.hashtags?.trim() || `#horoscope #${item.channel.toLowerCase()} #shorts`;
  const extra = `#${cut.tag}`;
  return base.split(/\s+/).includes(extra) ? base : `${base} ${extra}`;
}

/**
 * The render for one cut of a source item, or null when the reading has no
 * such section. Shorts show the intro plus one section; the astrology note
 * moves off-screen into the post description.
 */
export function cutItem(item: ContentItem, id: CutId): ContentItem | null {
  const meta = cutMeta(id);
  const sections = parseSections(item.body);
  if (id === "full") {
    return {
      ...item,
      id: `${item.id}__full`,
      parentId: item.id,
      cut: "full",
      targetSec: meta.targetSec,
      description: item.description,
      hashtags: hashtagsFor(item, meta),
    };
  }
  const text = sections[id];
  if (!text) return null;
  const body = [sections.intro, `${meta.label}: ${capitalize(text)}`].filter(Boolean).join("\n\n");
  const note = sections.note ? `Astrology note: ${sections.note}` : "";
  return {
    ...item,
    id: `${item.id}__${id}`,
    parentId: item.id,
    cut: id,
    title: `${item.channel.toUpperCase()} · ${meta.label.toUpperCase()}`,
    body,
    targetSec: meta.targetSec,
    description: note || item.description,
    hashtags: hashtagsFor(item, meta),
  };
}

export function cutsFor(item: ContentItem, enabled: Record<CutId, boolean>): ContentItem[] {
  return CUT_IDS.filter((id) => enabled[id])
    .map((id) => cutItem(item, id))
    .filter((entry): entry is ContentItem => Boolean(entry));
}

/** Everything a scheduler (or Nami) needs to post a rendered video. */
export function postInfo(item: ContentItem, file: string, durationSec: number) {
  const cut = CUTS.find((entry) => entry.id === item.cut);
  const date = item.date ?? "";
  const pretty = date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const topic = cut && cut.id !== "full" ? `${cut.label} ` : "";
  const title = `${item.channel} ${topic}Horoscope${pretty ? ` — ${pretty}` : ""}`;
  const description = [item.description, item.cta].filter(Boolean).join("\n\n");
  return {
    file,
    title,
    description,
    hashtags: item.hashtags ?? "",
    caption: [title, description, item.hashtags].filter(Boolean).join("\n\n"),
    date,
    sign: item.channel,
    cut: item.cut ?? "full",
    format: item.cut && item.cut !== "full" ? "short" : "full",
    durationSec: Math.round(durationSec * 10) / 10,
    sourceId: item.parentId ?? item.id,
    music: item.music ?? null,
    status: "rendered",
  };
}
