import type { TemplateConfig } from "@/engine/types";

/**
 * Scaffold for the inspirational-quotes channel.
 * Swap the background, drop the badge slot, keep the shared renderer.
 */
export function createQuotesTemplate(): TemplateConfig {
  return {
    id: "quotes",
    name: "Daily Quote",
    canvas: { width: 1080, height: 1920 },
    background: { src: "" },
    textRegion: { x: 120, y: 420, width: 840, height: 1080 },
    textTypography: {
      fontFamily: "Cormorant Garamond",
      fontWeight: 500,
      fontSize: 52,
      lineHeight: 1.32,
      letterSpacing: 0,
      color: "#f3eee4",
      align: "center",
      shadowColor: "rgba(0,0,0,0.6)",
      shadowBlur: 8,
      italic: true,
    },
    typewriter: {
      charsPerSecond: 20,
      punctuationPauseMs: 260,
      commaPauseMs: 100,
      linesPerPage: 4,
      holdMs: 2000,
      holdMsPerChar: 14,
      transitionMs: 480,
      endHoldMs: 1600,
      introMs: 400,
      fps: 30,
      cursor: false,
    },
    verticalAlign: "center",
    backgroundColor: "#0c0b0a",
  };
}
