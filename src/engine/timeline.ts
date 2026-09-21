import type { TypewriterConfig } from "./types";

export interface PageTiming {
  index: number;
  lines: string[];
  fullText: string;
  start: number;
  typeEnd: number;
  holdEnd: number;
  exitEnd: number;
  charTimes: number[];
}

export interface Timeline {
  duration: number;
  pages: PageTiming[];
  fps: number;
}

export interface FrameState {
  pageIndex: number;
  lines: string[];
  charsVisible: number;
  totalChars: number;
  opacity: number;
  offsetY: number;
  typing: boolean;
  done: boolean;
}

function charDelay(ch: string, config: TypewriterConfig): number {
  const base = 1000 / Math.max(1, config.charsPerSecond);
  if (/[.!?…]/.test(ch)) return base + config.punctuationPauseMs;
  if (/[,;:]/.test(ch)) return base + config.commaPauseMs;
  if (ch === "—" || ch === "–") return base + config.commaPauseMs;
  if (ch === "\n") return base * 0.35;
  return base;
}

export function buildTimeline(pages: string[][], config: TypewriterConfig): Timeline {
  const pageTimings: PageTiming[] = [];
  let t = Math.max(0, config.introMs) / 1000;

  pages.forEach((lines, index) => {
    const fullText = lines.join("\n");
    const start = t;
    const charTimes: number[] = [];
    let cursorMs = t * 1000;

    for (const ch of fullText) {
      cursorMs += charDelay(ch, config);
      charTimes.push(cursorMs / 1000);
    }

    const typeEnd = fullText.length === 0 ? start : (charTimes[charTimes.length - 1] ?? start);
    const hold =
      (config.holdMs + config.holdMsPerChar * fullText.length) / 1000;
    const holdEnd = typeEnd + Math.max(0.2, hold);
    const isLast = index === pages.length - 1;
    const transition = isLast ? config.endHoldMs / 1000 : config.transitionMs / 1000;
    const exitEnd = holdEnd + Math.max(0, transition);
    pageTimings.push({
      index,
      lines,
      fullText,
      start,
      typeEnd,
      holdEnd,
      exitEnd,
      charTimes,
    });
    t = exitEnd;
  });

  const duration = pageTimings.length === 0 ? config.introMs / 1000 + 1 : t;

  return { duration, pages: pageTimings, fps: config.fps };
}

function easeOutCubic(x: number): number {
  return 1 - (1 - x) ** 3;
}

export function stateAt(timeline: Timeline, time: number): FrameState {
  if (timeline.pages.length === 0) {
    return {
      pageIndex: 0,
      lines: [],
      charsVisible: 0,
      totalChars: 0,
      opacity: 0,
      offsetY: 0,
      typing: false,
      done: true,
    };
  }

  const last = timeline.pages[timeline.pages.length - 1]!;
  if (time >= timeline.duration) {
    return {
      pageIndex: last.index,
      lines: last.lines,
      charsVisible: last.fullText.length,
      totalChars: last.fullText.length,
      opacity: 1,
      offsetY: 0,
      typing: false,
      done: true,
    };
  }

  const first = timeline.pages[0]!;
  if (time < first.start) {
    return {
      pageIndex: 0,
      lines: [],
      charsVisible: 0,
      totalChars: first.fullText.length,
      opacity: 0,
      offsetY: 0,
      typing: false,
      done: false,
    };
  }

  let page = first;
  for (const candidate of timeline.pages) {
    if (time >= candidate.start) page = candidate;
  }

  const totalChars = page.fullText.length;
  let charsVisible = 0;
  if (time >= page.typeEnd) {
    charsVisible = totalChars;
  } else {
    for (let i = 0; i < page.charTimes.length; i++) {
      if (page.charTimes[i]! <= time) charsVisible = i + 1;
      else break;
    }
  }

  const visible = visibleLines(page.lines, charsVisible);
  const typing = time >= page.start && time < page.typeEnd;

  let opacity = 1;
  let offsetY = 0;
  const isLast = page.index === last.index;
  if (!isLast && time >= page.holdEnd && time < page.exitEnd) {
    const span = Math.max(0.001, page.exitEnd - page.holdEnd);
    const u = easeOutCubic(Math.min(1, (time - page.holdEnd) / span));
    opacity = 1 - u;
    offsetY = -28 * u;
  }

  return {
    pageIndex: page.index,
    lines: visible,
    charsVisible,
    totalChars,
    opacity,
    offsetY,
    typing,
    done: false,
  };
}

export function visibleLines(page: string[], charsVisible: number): string[] {
  const full = page.join("\n");
  const sliced = full.slice(0, Math.max(0, charsVisible));
  if (!sliced) return page.length ? [""] : [];
  return sliced.split("\n");
}

export function frameCount(timeline: Timeline): number {
  return Math.max(1, Math.ceil(timeline.duration * timeline.fps));
}
