import type { TemplateConfig } from "@/engine/types";

/**
 * Scaffold for the daily-verse channel.
 * Translation/licensing is selected before publication; this module only
 * describes layout so the same engine can render it later.
 */
export function createBibleTemplate(): TemplateConfig {
  return {
    id: "bible",
    name: "Daily Verse",
    canvas: { width: 1080, height: 1920 },
    background: { src: "" },
    title: {
      enabled: true,
      region: { x: 140, y: 360, width: 800, height: 48 },
      typography: {
        fontFamily: "Cormorant Garamond",
        fontWeight: 600,
        fontSize: 26,
        lineHeight: 1.2,
        letterSpacing: 3,
        color: "#c6a36a",
        align: "center",
        shadowColor: "rgba(0,0,0,0.5)",
        shadowBlur: 4,
        italic: false,
      },
    },
    textRegion: { x: 130, y: 460, width: 820, height: 1000 },
    textTypography: {
      fontFamily: "Cormorant Garamond",
      fontWeight: 500,
      fontSize: 46,
      lineHeight: 1.4,
      letterSpacing: 0.1,
      color: "#f3eee4",
      align: "center",
      shadowColor: "rgba(0,0,0,0.6)",
      shadowBlur: 8,
      italic: false,
    },
    typewriter: {
      charsPerSecond: 18,
      punctuationPauseMs: 280,
      commaPauseMs: 110,
      linesPerPage: 4,
      holdMs: 2200,
      holdMsPerChar: 16,
      transitionMs: 500,
      endHoldMs: 1800,
      introMs: 500,
      fps: 30,
      cursor: false,
    },
    verticalAlign: "center",
    backgroundColor: "#0c0b0a",
  };
}
