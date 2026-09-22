import { layoutCopy, longestUnbreakableWord, type MeasureFn } from "./layout";
import { buildTimeline } from "./timeline";
import {
  DEFAULT_LIMITS,
  type ContentItem,
  type LimitsConfig,
  type TemplateConfig,
  type ValidationIssue,
} from "./types";
import { ZODIAC_SIGNS } from "@/templates/horoscope/signs";
import { templateForItem } from "./production";

function normalizeBody(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function validateDataset(
  items: ContentItem[],
  template: TemplateConfig,
  measure: MeasureFn | null,
  limits: LimitsConfig = DEFAULT_LIMITS,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();

  if (items.length === 0) {
    issues.push({
      level: "error",
      code: "empty-dataset",
      message: "No content rows loaded.",
    });
  }

  for (const item of items) {
    issues.push(...validateItem(item, template, measure, limits, seen));
  }

  return issues;
}

export function validateDay(
  items: ContentItem[],
  date: string,
  template: TemplateConfig,
  measure: MeasureFn | null,
  limits: LimitsConfig = DEFAULT_LIMITS,
  requiredSigns: readonly (typeof ZODIAC_SIGNS)[number][] = ZODIAC_SIGNS,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!date) {
    issues.push({ level: "error", code: "invalid-date", message: "No date is selected." });
    return issues;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    issues.push({
      level: "error",
      code: "invalid-date",
      message: `“${date}” is not a valid calendar date.`,
    });
  }

  const day = items.filter((item) => item.date === date);
  const seen = new Map<string, string>();
  for (const sign of requiredSigns) {
    const matches = day.filter((item) => item.channel === sign);
    if (matches.length === 0) {
      issues.push({
        level: "error",
        code: "missing-sign",
        message: `${date} is missing ${sign}.`,
      });
      continue;
    }
    if (matches.length > 1) {
      issues.push({
        level: "error",
        code: "duplicate-sign",
        message: `${date} has ${matches.length} ${sign} readings.`,
        itemId: matches[0]?.id,
      });
    }
    for (const item of matches) {
      issues.push(...validateItem(item, template, measure, limits, seen));
    }
  }
  return issues;
}

function validateItem(
  item: ContentItem,
  template: TemplateConfig,
  measure: MeasureFn | null,
  limits: LimitsConfig,
  seen: Map<string, string>,
): ValidationIssue[] {
  const resolved = templateForItem(template, item);
  const issues: ValidationIssue[] = [];
  const body = item.body.trim();
  if (!body) {
    issues.push({
      level: "error",
      code: "empty-content",
      message: `${label(item)} has empty text.`,
      itemId: item.id,
    });
    return issues;
  }

  if (body.length < limits.minChars) {
    issues.push({
      level: "error",
      code: "too-short",
      message: `${label(item)} is ${body.length} characters (minimum ${limits.minChars}).`,
      itemId: item.id,
    });
  }

  if (body.length > limits.maxChars) {
    issues.push({
      level: "error",
      code: "too-long",
      message: `${label(item)} is ${body.length} characters (maximum ${limits.maxChars}).`,
      itemId: item.id,
    });
  }

  const key = normalizeBody(body);
  const previous = seen.get(key);
  if (previous) {
    issues.push({
      level: "error",
      code: "duplicate-content",
      message: `${label(item)} duplicates another reading.`,
      itemId: item.id,
    });
  } else {
    seen.set(key, item.id);
  }

  if (resolved.badge && item.assetKey) {
    const src = resolved.badge.assets[item.assetKey];
    if (!src) {
      issues.push({
        level: "error",
        code: "missing-badge",
        message: `${label(item)} has no badge asset for “${item.assetKey}”.`,
        itemId: item.id,
      });
    }
  }

  if (measure) {
    const longest = longestUnbreakableWord(body);
    const wordWidth = measure(longest);
    if (wordWidth > resolved.textRegion.width) {
      issues.push({
        level: "error",
        code: "overflow-word",
        message: `${label(item)} contains an unbreakable word that is wider than the text region.`,
        itemId: item.id,
      });
    }

    const { pages } = layoutCopy(
      body,
      resolved.textRegion.width,
      resolved.typewriter.linesPerPage,
      measure,
    );
    const timeline = buildTimeline(pages, resolved.typewriter);
    if (timeline.duration > limits.errorDurationSec) {
      issues.push({
        level: "error",
        code: "too-long-duration",
        message: `${label(item)} would run ${timeline.duration.toFixed(1)}s (limit ${limits.errorDurationSec}s).`,
        itemId: item.id,
      });
    } else if (timeline.duration > limits.warnDurationSec) {
      issues.push({
        level: "warning",
        code: "long-duration",
        message: `${label(item)} runs ${timeline.duration.toFixed(1)}s.`,
        itemId: item.id,
      });
    }

    const lineHeight = resolved.textTypography.fontSize * resolved.textTypography.lineHeight;
    const blockHeight = resolved.typewriter.linesPerPage * lineHeight;
    if (blockHeight > resolved.textRegion.height) {
      issues.push({
        level: "error",
        code: "overflow-region",
        message: `${label(item)} page block is taller than the defined text region.`,
        itemId: item.id,
      });
    }
  }

  return issues;
}

export function blockingErrors(issues: ValidationIssue[], itemId?: string): ValidationIssue[] {
  return issues.filter((issue) => {
    if (issue.level !== "error") return false;
    if (!itemId) return true;
    return !issue.itemId || issue.itemId === itemId;
  });
}

export function filenameFor(item: ContentItem): string {
  const date = item.date ?? "undated";
  const channel = (item.channel || "item").replace(/\s+/g, "");
  return `${date}_${channel}.mp4`;
}

function label(item: ContentItem): string {
  const date = item.date ?? "undated";
  return `${date} ${item.channel}`;
}
