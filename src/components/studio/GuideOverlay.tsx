import { useRef } from "react";
import { useStudio } from "@/store/studio";
import { savePersistedLayout } from "@/engine/persist";
import type { Rect } from "@/engine/types";

interface RegionHandle {
  id: "title" | "subtitle" | "text";
  label: string;
  rect: Rect;
}

export function GuideOverlay() {
  const template = useStudio((s) => s.template);
  const showGuides = useStudio((s) => s.showGuides);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: RegionHandle["id"]; startY: number; orig: number } | null>(null);

  if (!showGuides) return null;

  const regions: RegionHandle[] = [];
  if (template.title?.enabled) {
    regions.push({ id: "title", label: "Title", rect: template.title.region });
  }
  if (template.subtitle?.enabled) {
    regions.push({ id: "subtitle", label: "Date line", rect: template.subtitle.region });
  }
  regions.push({ id: "text", label: "Reading", rect: template.textRegion });

  const toCanvasY = (clientY: number) => {
    const frame = frameRef.current;
    if (!frame) return 0;
    const box = frame.getBoundingClientRect();
    const scale = box.height / template.canvas.height;
    return (clientY - box.top) / scale;
  };

  const applyY = (id: RegionHandle["id"], y: number) => {
    const state = useStudio.getState();
    const current = state.template;
    const maxY = current.canvas.height - 40;
    const clamped = Math.max(40, Math.min(maxY, y));
    if (id === "text") {
      state.patchTemplate({
        textRegion: { ...current.textRegion, y: Math.round(clamped) },
      });
      return;
    }
    if (id === "title" && current.title) {
      state.patchTemplate({
        title: {
          ...current.title,
          region: { ...current.title.region, y: Math.round(clamped) },
        },
      });
      return;
    }
    if (id === "subtitle" && current.subtitle) {
      state.patchTemplate({
        subtitle: {
          ...current.subtitle,
          region: { ...current.subtitle.region, y: Math.round(clamped) },
        },
      });
    }
  };

  const onPointerDown = (id: RegionHandle["id"], rect: Rect, event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { id, startY: toCanvasY(event.clientY), orig: rect.y };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    const delta = toCanvasY(event.clientY) - drag.current.startY;
    applyY(drag.current.id, drag.current.orig + delta);
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    const state = useStudio.getState();
    void savePersistedLayout(state.template, state.showGuides);
  };

  return (
    <div
      ref={frameRef}
      className="absolute inset-0 z-10"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {regions.map((region) => {
        const left = `${(region.rect.x / template.canvas.width) * 100}%`;
        const top = `${(region.rect.y / template.canvas.height) * 100}%`;
        const width = `${(region.rect.width / template.canvas.width) * 100}%`;
        const height = `${(region.rect.height / template.canvas.height) * 100}%`;
        return (
          <div
            key={region.id}
            className="absolute"
            style={{ left, top, width, height }}
          >
            <button
              type="button"
              aria-label={`Move ${region.label} vertically`}
              className="absolute left-1/2 top-0 z-10 flex h-5 w-16 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize items-center justify-center rounded-full border border-gilt/80 bg-surface/90 text-[10px] uppercase tracking-wider text-gilt"
              onPointerDown={(event) => onPointerDown(region.id, region.rect, event)}
            >
              {region.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
