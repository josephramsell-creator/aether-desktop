import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { drawFrame, prepareRender, type PreparedRender } from "./compositor";
import type { LoadedAssets } from "./assets";
import { frameCount } from "./timeline";
import type { ContentItem, TemplateConfig } from "./types";

export interface EncodeProgress {
  frame: number;
  total: number;
  ratio: number;
}

export interface EncodedVideo {
  blob: Blob;
  mime: string;
  extension: string;
  durationSec: number;
  width: number;
  height: number;
}

type ProgressFn = (progress: EncodeProgress) => void;

export interface EncodeOptions {
  yieldEvery?: number;
  bitrate?: number;
  signal?: AbortSignal;
}

export async function renderVideo(
  template: TemplateConfig,
  item: ContentItem,
  assets: LoadedAssets,
  onProgress?: ProgressFn,
  options?: EncodeOptions,
): Promise<EncodedVideo> {
  const canvas = document.createElement("canvas");
  canvas.width = template.canvas.width;
  canvas.height = template.canvas.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not open a 2D canvas context.");

  const prepared = prepareRender(ctx, template, item);
  const total = frameCount(prepared.timeline);
  const fps = prepared.timeline.fps;
  const signal = options?.signal;

  const mp4 = await encodeMp4(canvas, ctx, prepared, assets, total, fps, onProgress, options);
  if (mp4) return mp4;

  return encodeWebm(canvas, ctx, prepared, assets, total, fps, onProgress, signal);
}

async function encodeMp4(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  prepared: PreparedRender,
  assets: LoadedAssets,
  total: number,
  fps: number,
  onProgress?: ProgressFn,
  options?: EncodeOptions,
): Promise<EncodedVideo | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return null;

  const codec = await pickAvcCodec(canvas.width, canvas.height, fps);
  if (!codec) return null;

  const bitrate = options?.bitrate ?? 6_000_000;
  const yieldEvery = Math.max(1, options?.yieldEvery ?? 4);
  const signal = options?.signal;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width: canvas.width,
      height: canvas.height,
      frameRate: fps,
    },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encoderError = err instanceof Error ? err : new Error(String(err));
    },
  });

  try {
    const configured = await configureEncoder(encoder, {
      codec,
      width: canvas.width,
      height: canvas.height,
      bitrate,
      framerate: fps,
    });
    if (!configured) {
      encoder.close();
      return null;
    }
  } catch {
    encoder.close();
    return null;
  }

  try {
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (encoderError) throw encoderError;
      while (encoder.encodeQueueSize > 8) {
        await wait(4);
      }
      const time = i / fps;
      drawFrame(ctx, prepared, assets, time);
      const frame = new VideoFrame(canvas, {
        timestamp: (i * 1_000_000) / fps,
        duration: 1_000_000 / fps,
      });
      encoder.encode(frame, { keyFrame: i % fps === 0 });
      frame.close();
      if (i % yieldEvery === 0) {
        onProgress?.({ frame: i + 1, total, ratio: (i + 1) / total });
        await yieldPaint();
      }
    }
    await encoder.flush();
    muxer.finalize();
    encoder.close();
    onProgress?.({ frame: total, total, ratio: 1 });
    return {
      blob: new Blob([target.buffer], { type: "video/mp4" }),
      mime: "video/mp4",
      extension: "mp4",
      durationSec: prepared.timeline.duration,
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    try {
      encoder.close();
    } catch {
      /* already closed */
    }
    return null;
  }
}

async function encodeWebm(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  prepared: PreparedRender,
  assets: LoadedAssets,
  total: number,
  fps: number,
  onProgress?: ProgressFn,
  signal?: AbortSignal,
): Promise<EncodedVideo> {
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  const mime = pickWebmMime();
  if (!mime || !track) {
    throw new Error("This browser cannot encode video.");
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("Recording failed."));
  });

  recorder.start(200);
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) {
      recorder.stop();
      throw new DOMException("Aborted", "AbortError");
    }
    const time = i / fps;
    drawFrame(ctx, prepared, assets, time);
    track.requestFrame();
    if (i % 3 === 0) {
      onProgress?.({ frame: i + 1, total, ratio: (i + 1) / total });
      await yieldPaint();
    } else {
      await wait(1000 / fps / 3);
    }
  }
  await wait(40);
  recorder.stop();
  await stopped;
  onProgress?.({ frame: total, total, ratio: 1 });

  return {
    blob: new Blob(chunks, { type: mime }),
    mime,
    extension: "webm",
    durationSec: prepared.timeline.duration,
    width: canvas.width,
    height: canvas.height,
  };
}

async function pickAvcCodec(width: number, height: number, fps: number): Promise<string | null> {
  const candidates = ["avc1.640028", "avc1.4d0028", "avc1.64001f", "avc1.420028"];
  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: 8_000_000,
        framerate: fps,
      });
      if (support.supported) return codec;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function configureEncoder(
  encoder: VideoEncoder,
  base: { codec: string; width: number; height: number; bitrate: number; framerate: number },
): Promise<boolean> {
  const preferred = await readEncoderPreference();
  const modes: Array<"prefer-hardware" | "prefer-software" | undefined> =
    preferred === "prefer-hardware"
      ? ["prefer-hardware", "prefer-software", undefined]
      : ["prefer-software", "prefer-hardware", undefined];

  for (const hardwareAcceleration of modes) {
    const config: VideoEncoderConfig = {
      ...base,
      avc: { format: "avc" },
      ...(hardwareAcceleration ? { hardwareAcceleration } : {}),
    };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (!support.supported) continue;
      encoder.configure(config);
      return true;
    } catch {
      /* try next mode */
    }
  }
  return false;
}

async function readEncoderPreference(): Promise<string> {
  try {
    if (typeof window !== "undefined" && window.aetherDesktop) {
      return (await window.aetherDesktop.getPaths()).encoder;
    }
  } catch {
    /* web preview */
  }
  return "prefer-software";
}

function pickWebmMime(): string | null {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function yieldPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function exportFramePng(
  template: TemplateConfig,
  item: ContentItem,
  assets: LoadedAssets,
  time: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = template.canvas.width;
  canvas.height = template.canvas.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not open a 2D canvas context.");
  const prepared = prepareRender(ctx, template, item);
  drawFrame(ctx, prepared, assets, time);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("PNG export failed.");
  return blob;
}
