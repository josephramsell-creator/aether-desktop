import { useEffect, useState } from "react";

export interface ReviewVideo {
  sign: string;
  file: string;
  url: string;
  bytes: number;
  durationSec: number;
}

export interface ReviewManifest {
  date: string;
  folder: string;
  running?: boolean;
  current?: string;
  index?: number;
  total?: number;
  message?: string;
  videos: ReviewVideo[];
}

export function ReviewGallery() {
  const [manifest, setManifest] = useState<ReviewManifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/review/manifest.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as ReviewManifest;
        if (!cancelled) setManifest(data);
      } catch {
        /* no pack yet */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!manifest) {
    return (
      <div className="space-y-2 border-t border-border pt-5">
        <p className="font-serif text-lg text-fg">Review folder</p>
        <p className="text-sm text-muted">
          Twelve-sign packs land here after a day is rendered. Nothing in the folder yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border pt-5">
      <div>
        <p className="font-serif text-lg text-fg">Review folder</p>
        <p className="text-sm text-muted">
          {manifest.date}
          {manifest.running
            ? ` · encoding ${manifest.current ?? "…"} (${manifest.index ?? 0}/${manifest.total ?? 12})`
            : ` · ${manifest.videos.length} videos`}
        </p>
      </div>
      {manifest.running ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-gilt"
            style={{
              width: `${Math.round(((manifest.index ?? 0) / Math.max(1, manifest.total ?? 12)) * 100)}%`,
            }}
          />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {manifest.videos.map((video) => (
          <figure key={video.file} className="space-y-2">
            <video
              className="aspect-[9/16] w-full rounded-[var(--radius-md)] border border-border bg-black object-cover"
              src={video.url}
              controls
              playsInline
              preload="metadata"
            />
            <figcaption className="text-xs text-muted">
              {video.sign}
              {video.durationSec ? ` · ${video.durationSec.toFixed(0)}s` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
