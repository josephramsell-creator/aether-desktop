import { useEffect, useMemo, useRef } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { drawFrame, prepareRender, type PreparedRender } from "@/engine/compositor";
import type { LoadedAssets } from "@/engine/assets";
import { previewItem, useStudio } from "@/store/studio";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { GuideOverlay } from "./GuideOverlay";

export function PreviewStage({ assets }: { assets: LoadedAssets | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preparedRef = useRef<PreparedRender | null>(null);
  const template = useStudio((s) => s.template);
  const items = useStudio((s) => s.items);
  const selectedId = useStudio((s) => s.selectedId);
  const playhead = useStudio((s) => s.playhead);
  const playing = useStudio((s) => s.playing);
  const duration = useStudio((s) => s.duration);
  const showGuides = useStudio((s) => s.showGuides);
  const fontsReady = useStudio((s) => s.fontsReady);
  const assetsReady = useStudio((s) => s.assetsReady);
  const previewCut = useStudio((s) => s.previewCut);
  const source = items.find((entry) => entry.id === selectedId);
  const item = useMemo(() => previewItem(source, previewCut), [source, previewCut]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !item || !fontsReady) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const prepared = prepareRender(ctx, template, item);
    preparedRef.current = prepared;
    useStudio.getState().setDuration(prepared.timeline.duration);
  }, [item, template, fontsReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const prepared = preparedRef.current;
    if (!canvas || !assets || !prepared || !fontsReady) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    drawFrame(ctx, prepared, assets, playhead, {
      guides: showGuides,
      stillLayout: !playing && playhead < 0.08,
    });
  }, [assets, playhead, showGuides, fontsReady, item, template, playing]);

  useEffect(() => {
    const w = window as Window & {
      __aether?: () => {
        playing: boolean;
        playhead: number;
        duration: number;
        pageCount: number;
        pages: string[][];
        lineCount: number;
        sourceName: string;
        itemCount: number;
        music: string | null;
        voice: string | null;
        font: string | null;
        status: string | null;
        channel: string | null;
        date: string | null;
      };
    };
    w.__aether = () => {
      const s = useStudio.getState();
      const prepared = preparedRef.current;
      const selected = s.items.find((entry) => entry.id === s.selectedId);
      return {
        playing: s.playing,
        playhead: s.playhead,
        duration: s.duration,
        pageCount: prepared?.pages.length ?? 0,
        pages: prepared?.pages ?? [],
        lineCount: prepared?.lines.length ?? 0,
        sourceName: s.sourceName,
        itemCount: s.items.length,
        music: selected?.music ?? null,
        voice: selected?.voice ?? null,
        font: selected?.font ?? null,
        status: selected?.status ?? null,
        channel: selected?.channel ?? null,
        date: selected?.date ?? null,
      };
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    const origin = useStudio.getState().playhead;
    const id = window.setInterval(() => {
      const state = useStudio.getState();
      if (!state.playing) return;
      const elapsed = (performance.now() - started) / 1000;
      const dur = state.duration;
      if (dur <= 0.25) return;
      const next = origin + elapsed;
      if (next >= dur) {
        state.setPlayhead(dur);
        state.setPlaying(false);
      } else {
        state.setPlayhead(next);
      }
    }, 40);
    return () => window.clearInterval(id);
  }, [playing]);

  const mmss = formatTime(playhead);
  const total = formatTime(duration);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4">
      <div className="relative aspect-[9/16] h-full max-h-[calc(100dvh-245px)] w-auto max-w-full overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg shadow-[0_0_0_1px_rgba(198,163,106,0.16)]">
        <canvas
          ref={canvasRef}
          width={template.canvas.width}
          height={template.canvas.height}
          className="absolute inset-0 size-full bg-bg bg-center bg-cover"
          style={{
            backgroundImage: template.background.src ? `url(${template.background.src})` : undefined,
          }}
        />
        <GuideOverlay />
        {!assetsReady ? (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-surface/90 px-3 py-1 text-xs text-muted">
            Preparing frame
          </div>
        ) : null}
      </div>

      <div className="flex w-full max-w-md items-center gap-3">
        <Button
          variant="secondary"
          size="icon"
          className="size-11 shrink-0"
          onClick={() => {
            const state = useStudio.getState();
            if (state.playhead >= state.duration - 0.05) state.setPlayhead(0);
            state.setPlaying(!state.playing);
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          onClick={() => {
            useStudio.getState().setPlaying(false);
            useStudio.getState().setPlayhead(0);
          }}
          aria-label="Restart"
        >
          <RotateCcw className="size-4" />
        </Button>
        <Slider
          min={0}
          max={Math.max(0.1, duration)}
          step={0.01}
          value={[playhead]}
          onPointerDown={() => useStudio.getState().setPlaying(false)}
          onValueChange={(value) => {
            useStudio.getState().setPlayhead(value[0] ?? 0);
          }}
        />
        <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
          {mmss} / {total}
        </span>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
