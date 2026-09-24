import { zipSync } from "fflate";
import type { ContentItem } from "./types";
import { blockingErrors, filenameFor, validateDataset } from "./validator";
import { createCanvasMeasurer } from "./layout";
import { downloadBlob, renderVideo } from "./recorder";
import type { LoadedAssets } from "./assets";
import { ensureBadge, loadTemplateAssets } from "./assets";
import { enabledJobsForDate, enabledJobsForItem, useStudio } from "@/store/studio";
import { postInfo } from "./cuts";
import { ZODIAC_SIGNS } from "@/templates/horoscope/signs";

export type SaveReviewFile = (filename: string, bytes: Uint8Array) => Promise<number | void>;

interface BatchHostWindow extends Window {
  __aetherRenderDate?: (date: string) => Promise<{
    date: string;
    saved: { name: string; bytes: number; durationSec: number }[];
    failed: { name: string; error: string }[];
  }>;
  __aetherRenderItem?: (id: string) => Promise<{
    sign: string;
    date: string;
    saved: { name: string; bytes: number; durationSec: number }[];
    failed: { name: string; error: string }[];
  }>;
  __aetherListDate?: (date: string) => { id: string; sign: string; date: string }[];
  __aetherSaveReviewFile?: SaveReviewFile;
  __aetherEncoderProbe?: () => Promise<{ videoEncoder: boolean; codec: string | null }>;
}

export async function runRenderJobs(
  assets: LoadedAssets | null,
  jobs: ContentItem[],
  asZip: boolean,
  options?: { saveFile?: SaveReviewFile; yieldEvery?: number; bitrate?: number },
): Promise<{ saved: { name: string; bytes: number; durationSec: number }[]; failed: { name: string; error: string }[] }> {
  const store = useStudio.getState();
  const saved: { name: string; bytes: number; durationSec: number }[] = [];
  const failed: { name: string; error: string }[] = [];

  if (!assets) {
    failed.push({ name: "batch", error: "Visual assets are still loading." });
    return { saved, failed };
  }
  if (!jobs.length) return { saved, failed };

  let pack = assets;
  if (jobs.length > 1) {
    pack = await loadTemplateAssets(store.template);
  }

  const canvas = document.createElement("canvas");
  canvas.width = store.template.canvas.width;
  canvas.height = store.template.canvas.height;
  const ctx = canvas.getContext("2d");
  const measure = ctx ? createCanvasMeasurer(ctx, store.template.textTypography) : null;
  const issues = validateDataset(jobs, store.template, measure);
  store.setIssues(validateDataset(store.items, store.template, measure));

  const files: { name: string; bytes: Uint8Array }[] = [];
  store.setBatch({ running: true, current: 0, total: jobs.length, ratio: 0, label: "Starting" });
  store.setTab("output");

  for (const [index, job] of jobs.entries()) {
    const blocked = blockingErrors(issues, job.id);
    const name = filenameFor(job);
    store.setBatch({
      current: index + 1,
      label: name,
      ratio: index / jobs.length,
    });
    if (blocked.length) {
      const error = blocked.map((issue) => issue.message).join(" · ");
      store.log("error", `Withheld ${name}`, error);
      failed.push({ name, error });
      continue;
    }
    try {
      if (job.assetKey) pack = await ensureBadge(store.template, pack, job.assetKey);
      const video = await renderVideo(
        store.template,
        job,
        pack,
        (progress) => {
          store.setBatch({
            ratio: (index + progress.ratio) / jobs.length,
            label: `${name} ${Math.round(progress.ratio * 100)}%`,
          });
        },
        { yieldEvery: options?.yieldEvery, bitrate: options?.bitrate },
      );
      const filename = name.replace(/\.mp4$/, `.${video.extension}`);
      const buffer = new Uint8Array(await video.blob.arrayBuffer());
      if (!buffer.byteLength) throw new Error("Empty file.");
      store.log(
        "info",
        `Wrote ${filename}`,
        `${video.durationSec.toFixed(1)}s · ${(buffer.byteLength / 1024).toFixed(0)} KB`,
      );
      saved.push({ name: filename, bytes: buffer.byteLength, durationSec: video.durationSec });
      if (options?.saveFile) {
        await options.saveFile(filename, buffer);
        // Sidecar with title, description and hashtags for the scheduler / Nami.
        const info = postInfo(job, filename, video.durationSec);
        const infoName = filename.replace(/\.[a-z0-9]+$/i, ".json");
        await options.saveFile(infoName, new TextEncoder().encode(JSON.stringify(info, null, 2)));
      } else if (asZip && jobs.length > 1) {
        files.push({ name: filename, bytes: buffer });
      } else {
        downloadBlob(video.blob, filename);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      store.log("error", `Render failed for ${name}`, message);
      failed.push({ name, error: message });
    }
  }

  if (!options?.saveFile && asZip && files.length > 1) {
    const archive = zipSync(Object.fromEntries(files.map((file) => [file.name, file.bytes])));
    const first = jobs[0]?.date ?? "batch";
    downloadBlob(new Blob([archive as BlobPart], { type: "application/zip" }), `aether_${first}.zip`);
    store.log("info", `Archive downloaded with ${files.length} videos.`);
  }

  store.setBatch({ running: false, ratio: 1, label: "Done" });
  return { saved, failed };
}

function desktopSaveHook(): SaveReviewFile | undefined {
  const desktop = window.aetherDesktop;
  if (!desktop?.saveReviewFile) return undefined;
  return async (filename, bytes) => {
    const date = /^\d{4}-\d{2}-\d{2}/.exec(filename)?.[0] ?? "undated";
    return desktop.saveReviewFile(filename, bytes, date);
  };
}

export async function runStudioJobs(
  assets: LoadedAssets | null,
  jobs: ContentItem[],
  asZip = false,
): Promise<{ saved: { name: string; bytes: number; durationSec: number }[]; failed: { name: string; error: string }[] }> {
  const saveFile = window.aetherDesktop?.saveReviewFile
    ? async (filename: string, bytes: Uint8Array) => {
        const date = /^\d{4}-\d{2}-\d{2}/.exec(filename)?.[0] ?? jobs[0]?.date ?? "undated";
        return window.aetherDesktop!.saveReviewFile(filename, bytes, date);
      }
    : window.__aetherSaveReviewFile;
  return runRenderJobs(assets, jobs, asZip && !saveFile, {
    saveFile,
    yieldEvery: saveFile ? 30 : 4,
  });
}

export function installBatchHost() {
  const w = window as BatchHostWindow;
  const desktopSave = desktopSaveHook();
  if (desktopSave) w.__aetherSaveReviewFile = desktopSave;
  w.__aetherEncoderProbe = async () => {
    if (typeof VideoEncoder === "undefined") return { videoEncoder: false, codec: null };
    const candidates = ["avc1.640028", "avc1.4d0028", "avc1.64001f", "avc1.420028"];
    for (const codec of candidates) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec,
          width: 1080,
          height: 1920,
          bitrate: 6_000_000,
          framerate: 30,
        });
        if (support.supported) return { videoEncoder: true, codec };
      } catch {
        /* try next */
      }
    }
    return { videoEncoder: true, codec: null };
  };

  w.__aetherListDate = (date: string) => {
    const items = useStudio.getState().items.filter((item) => item.date === date);
    return [...items]
      .sort((a, b) => ZODIAC_SIGNS.indexOf(a.channel as (typeof ZODIAC_SIGNS)[number]) - ZODIAC_SIGNS.indexOf(b.channel as (typeof ZODIAC_SIGNS)[number]))
      .map((item) => ({ id: item.id, sign: item.channel, date: item.date ?? date }));
  };

  w.__aetherRenderItem = async (id: string) => {
    const store = useStudio.getState();
    const job = store.items.find((item) => item.id === id);
    if (!job) throw new Error(`No reading ${id}`);
    const assets = await loadTemplateAssets(store.template);
    const saveFile = w.__aetherSaveReviewFile;
    if (!saveFile) throw new Error("Review save hook is not installed.");
    const result = await runRenderJobs(assets, enabledJobsForItem(job), false, {
      saveFile,
      yieldEvery: 45,
      bitrate: 5_500_000,
    });
    return { sign: job.channel, date: job.date ?? "", ...result };
  };

  w.__aetherRenderDate = async (date: string) => {
    const store = useStudio.getState();
    const jobs = enabledJobsForDate(date);
    if (!jobs.length) throw new Error(`No readings for ${date}`);
    const assets = await loadTemplateAssets(store.template);
    const saveFile = w.__aetherSaveReviewFile;
    if (!saveFile) throw new Error("Review save hook is not installed.");
    return {
      date,
      ...(await runRenderJobs(assets, jobs, false, {
        saveFile,
        yieldEvery: 45,
        bitrate: 5_500_000,
      })),
    };
  };
}
