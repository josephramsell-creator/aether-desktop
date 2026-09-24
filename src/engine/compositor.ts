import { createCanvasMeasurer, fontShorthand } from "./layout";
import { stateAt, type FrameState, type Timeline } from "./timeline";
import type { LoadedAssets } from "./assets";
import type { ContentItem, Rect, TemplateConfig, TypographyConfig } from "./types";
import { templateForItem } from "./production";
import { paceRender } from "./pacing";

export interface PreparedRender {
  template: TemplateConfig;
  item: ContentItem;
  timeline: Timeline;
  pages: string[][];
  lines: string[];
}

export function prepareRender(
  ctx: CanvasRenderingContext2D,
  template: TemplateConfig,
  item: ContentItem,
): PreparedRender {
  const measure = createCanvasMeasurer(ctx, templateForItem(template, item).textTypography);
  const paced = paceRender(template, item, measure);
  return { template: paced.template, item, timeline: paced.timeline, pages: paced.pages, lines: paced.lines };
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  prepared: PreparedRender,
  assets: LoadedAssets,
  time: number,
  options?: { guides?: boolean; stillLayout?: boolean },
): FrameState {
  const { template, item } = prepared;
  const { width, height } = template.canvas;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = template.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  if (assets.background) {
    ctx.drawImage(assets.background, 0, 0, width, height);
  }

  if (template.badge && item.assetKey) {
    const badge = assets.badges[item.assetKey];
    if (badge) drawBadge(ctx, template, badge);
  }

  if (template.title?.enabled && item.title) {
    drawTextBlock(ctx, item.title.toUpperCase(), template.title.region, template.title.typography);
  }
  if (template.subtitle?.enabled && item.subtitle) {
    drawTextBlock(ctx, item.subtitle, template.subtitle.region, template.subtitle.typography);
  }

  const frame = options?.stillLayout
    ? stillLayoutFrame(prepared)
    : stateAt(prepared.timeline, time);
  drawTypewriter(ctx, template, frame);

  if (options?.guides) drawGuides(ctx, template);
  ctx.restore();
  return frame;
}

function stillLayoutFrame(prepared: PreparedRender): FrameState {
  const page = prepared.pages[0] ?? [];
  return {
    pageIndex: 0,
    lines: page,
    charsVisible: page.join("\n").length,
    totalChars: page.join("\n").length,
    opacity: 1,
    offsetY: 0,
    typing: false,
    done: false,
  };
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  template: TemplateConfig,
  image: HTMLImageElement,
) {
  const badge = template.badge!;
  const radius = badge.diameter / 2 - badge.inset;
  const cx = badge.cx;
  const cy = badge.cy;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1, radius), 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const scale = (radius * 2) / Math.max(image.width, image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function drawTypewriter(
  ctx: CanvasRenderingContext2D,
  template: TemplateConfig,
  frame: FrameState,
) {
  const type = template.textTypography;
  const region = template.textRegion;
  const lineHeight = type.fontSize * type.lineHeight;
  const blockHeight = Math.max(frame.lines.length, 1) * lineHeight;
  let originY = region.y;
  if (template.verticalAlign === "center") {
    originY = region.y + (region.height - template.typewriter.linesPerPage * lineHeight) / 2;
  } else if (template.verticalAlign === "bottom") {
    originY = region.y + region.height - template.typewriter.linesPerPage * lineHeight;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, frame.opacity));
  ctx.translate(0, frame.offsetY);
  ctx.font = fontShorthand(type);
  ctx.fillStyle = type.color;
  ctx.textAlign = type.align;
  ctx.textBaseline = "top";
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${type.letterSpacing}px`;
  }
  ctx.shadowColor = type.shadowColor;
  ctx.shadowBlur = type.shadowBlur;
  ctx.shadowOffsetY = 1;

  const x = anchorX(region, type.align);
  frame.lines.forEach((line, index) => {
    ctx.fillText(line, x, originY + index * lineHeight, region.width);
  });

  if (template.typewriter.cursor && frame.typing) {
    const last = frame.lines[frame.lines.length - 1] ?? "";
    const y = originY + (frame.lines.length - 1) * lineHeight;
    const measured = ctx.measureText(last).width;
    let caretX = x;
    if (type.align === "center") caretX = x + measured / 2 + 3;
    else if (type.align === "right") caretX = x + 3;
    else caretX = x + measured + 3;
    ctx.shadowBlur = 0;
    ctx.fillStyle = type.color;
    ctx.globalAlpha *= 0.85;
    ctx.fillRect(caretX, y + 4, 2, type.fontSize * 0.85);
  }

  ctx.restore();
  void blockHeight;
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  region: Rect,
  type: TypographyConfig,
) {
  ctx.save();
  ctx.font = fontShorthand(type);
  ctx.fillStyle = type.color;
  ctx.textAlign = type.align;
  ctx.textBaseline = "middle";
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${type.letterSpacing}px`;
  }
  ctx.shadowColor = type.shadowColor;
  ctx.shadowBlur = type.shadowBlur;
  ctx.fillText(text, anchorX(region, type.align), region.y + region.height / 2, region.width);
  ctx.restore();
}

function anchorX(region: Rect, align: TypographyConfig["align"]): number {
  if (align === "center") return region.x + region.width / 2;
  if (align === "right") return region.x + region.width;
  return region.x;
}

function drawGuides(ctx: CanvasRenderingContext2D, template: TemplateConfig) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  if (template.badge) {
    const { cx, cy, diameter } = template.badge;
    ctx.strokeStyle = "rgba(110, 196, 140, 0.9)";
    ctx.beginPath();
    ctx.arc(cx, cy, diameter / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(120, 176, 220, 0.9)";
  const r = template.textRegion;
  ctx.strokeRect(r.x, r.y, r.width, r.height);
  if (template.title?.enabled) {
    ctx.strokeStyle = "rgba(198, 163, 106, 0.75)";
    const t = template.title.region;
    ctx.strokeRect(t.x, t.y, t.width, t.height);
  }
  if (template.subtitle?.enabled) {
    ctx.strokeStyle = "rgba(198, 163, 106, 0.45)";
    const s = template.subtitle.region;
    ctx.strokeRect(s.x, s.y, s.width, s.height);
  }
  ctx.restore();
}
