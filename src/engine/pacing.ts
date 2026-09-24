import { createCanvasMeasurer, layoutCopy, type MeasureFn } from "./layout";
import { buildTimeline, type Timeline } from "./timeline";
import { templateForItem } from "./production";
import type { ContentItem, TemplateConfig, TypewriterConfig } from "./types";

/** Fastest the typewriter may run while still being comfortable to read (≈ 250 wpm). */
export const MAX_READABLE_CPS = 24;

export interface PacedRender {
  template: TemplateConfig;
  lines: string[];
  pages: string[][];
  timeline: Timeline;
  /** Speed multiplier applied to the template typewriter (1 = unchanged). */
  pace: number;
}

/** Typing gets faster and holds/pauses shorter; intro, page transitions and end hold stay fixed. */
function scaleTypewriter(base: TypewriterConfig, pace: number): TypewriterConfig {
  if (pace === 1) return base;
  return {
    ...base,
    charsPerSecond: base.charsPerSecond * pace,
    punctuationPauseMs: base.punctuationPauseMs / pace,
    commaPauseMs: base.commaPauseMs / pace,
    holdMs: base.holdMs / pace,
    holdMsPerChar: base.holdMsPerChar / pace,
  };
}

/**
 * Lay out an item and pick the slowest pace that fits its target length.
 * Items already under target keep the template pace; items that cannot fit
 * at a readable speed run long and are flagged by the validator.
 */
export function paceRender(template: TemplateConfig, item: ContentItem, measure?: MeasureFn): PacedRender {
  const resolved = templateForItem(template, item);
  const measureFn = measure ?? sharedMeasurer(resolved);
  const { lines, pages } = layoutCopy(item.body, resolved.textRegion.width, resolved.typewriter.linesPerPage, measureFn);
  const base = resolved.typewriter;
  const target = item.targetSec ?? template.targetSec;
  // A per-row chars_per_second from the workbook is an explicit choice; respect it.
  const fixedSpeed = Boolean(item.charsPerSecond);
  const timelineAt = (pace: number) => buildTimeline(pages, scaleTypewriter(base, pace));

  let pace = 1;
  let timeline = timelineAt(1);
  const maxPace = Math.max(1, MAX_READABLE_CPS / Math.max(1, base.charsPerSecond));
  if (target && !fixedSpeed && timeline.duration > target && maxPace > 1) {
    let lo = 1;
    let hi = maxPace;
    if (timelineAt(hi).duration > target) {
      lo = hi;
    } else {
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (timelineAt(mid).duration > target) lo = mid;
        else hi = mid;
      }
      lo = hi;
    }
    pace = lo;
    timeline = timelineAt(pace);
  }

  return {
    template: pace === 1 ? resolved : { ...resolved, typewriter: scaleTypewriter(base, pace) },
    lines,
    pages,
    timeline,
    pace,
  };
}

let shared: { ctx: CanvasRenderingContext2D } | null = null;

function sharedMeasurer(template: TemplateConfig): MeasureFn {
  if (!shared) {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable for text measurement.");
    shared = { ctx };
  }
  return createCanvasMeasurer(shared.ctx, template.textTypography);
}
