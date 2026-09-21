import type { TemplateConfig, TypographyConfig } from "@/engine/types";
import { BADGE_ASSETS } from "./signs";
import { MEASURED_BADGE, MEASURED_TEXT, NATIVE_BACKGROUND } from "./measured";

const BODY: TypographyConfig = {
  fontFamily: "Cormorant Garamond",
  fontWeight: 500,
  fontSize: 57,
  lineHeight: 1.32,
  letterSpacing: 0.15,
  color: "#f3eee4",
  align: "center",
  shadowColor: "rgba(0,0,0,0.72)",
  shadowBlur: 10,
  italic: false,
};

const TITLE: TypographyConfig = {
  fontFamily: "Cormorant Garamond",
  fontWeight: 600,
  fontSize: 30,
  lineHeight: 1.1,
  letterSpacing: 6,
  color: "#e4d3a8",
  align: "center",
  shadowColor: "rgba(0,0,0,0.55)",
  shadowBlur: 6,
  italic: false,
};

const SUBTITLE: TypographyConfig = {
  fontFamily: "Cormorant Garamond",
  fontWeight: 500,
  fontSize: 20,
  lineHeight: 1.2,
  letterSpacing: 2.4,
  color: "#c6a36a",
  align: "center",
  shadowColor: "rgba(0,0,0,0.5)",
  shadowBlur: 4,
  italic: true,
};

export function createHoroscopeTemplate(): TemplateConfig {
  return {
    id: "horoscope",
    name: "Daily Horoscope",
    canvas: { width: 1080, height: 1920 },
    background: { src: "/assets/horoscope/background.png" },
    nativeBackground: { ...NATIVE_BACKGROUND },
    measurementNotes:
      "Badge circle fit on native 941×1672: cx 469.87, cy 347.79, r 187.61 (0.24px mean residual). Scaled to 1080×1920.",
    badge: {
      cx: MEASURED_BADGE.cx,
      cy: MEASURED_BADGE.cy,
      diameter: MEASURED_BADGE.diameter,
      inset: 2,
      assets: { ...BADGE_ASSETS },
    },
    title: {
      enabled: true,
      region: { x: 180, y: 628, width: 720, height: 44 },
      typography: { ...TITLE },
    },
    subtitle: {
      enabled: true,
      region: { x: 180, y: 672, width: 720, height: 32 },
      typography: { ...SUBTITLE },
    },
    textRegion: {
      x: MEASURED_TEXT.x,
      y: 742,
      width: MEASURED_TEXT.width,
      height: 620,
    },
    textTypography: { ...BODY },
    typewriter: {
      charsPerSecond: 10,
      punctuationPauseMs: 380,
      commaPauseMs: 160,
      linesPerPage: 6,
      holdMs: 2400,
      holdMsPerChar: 14,
      transitionMs: 560,
      endHoldMs: 2000,
      introMs: 700,
      fps: 30,
      cursor: true,
    },
    verticalAlign: "center",
    backgroundColor: "#050505",
  };
}
