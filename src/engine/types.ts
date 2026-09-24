export const OUTPUT_WIDTH = 1080;
export const OUTPUT_HEIGHT = 1920;

export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "center" | "bottom";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  cx: number;
  cy: number;
  diameter: number;
}

export interface TypographyConfig {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  align: TextAlign;
  shadowColor: string;
  shadowBlur: number;
  italic: boolean;
}

export interface TypewriterConfig {
  charsPerSecond: number;
  punctuationPauseMs: number;
  commaPauseMs: number;
  linesPerPage: number;
  holdMs: number;
  holdMsPerChar: number;
  transitionMs: number;
  endHoldMs: number;
  introMs: number;
  fps: number;
  cursor: boolean;
}

export interface BadgeConfig {
  cx: number;
  cy: number;
  diameter: number;
  inset: number;
  assets: Record<string, string>;
}

export interface TitleConfig {
  enabled: boolean;
  region: Rect;
  typography: TypographyConfig;
}

export interface TemplateConfig {
  id: string;
  name: string;
  canvas: { width: number; height: number };
  background: { src: string };
  nativeBackground?: { width: number; height: number };
  /** Pixel-accurate notes from asset inspection. */
  measurementNotes?: string;
  badge?: BadgeConfig;
  title?: TitleConfig;
  subtitle?: TitleConfig;
  textRegion: Rect;
  textTypography: TypographyConfig;
  typewriter: TypewriterConfig;
  verticalAlign: VerticalAlign;
  backgroundColor: string;
  /** Aether speeds the typewriter up, never past a readable pace, to land near this length. */
  targetSec?: number;
}

export interface ContentItem {
  id: string;
  templateId: string;
  date?: string;
  channel: string;
  title?: string;
  subtitle?: string;
  body: string;
  assetKey?: string;
  theme?: string;
  intro?: string;
  money?: string;
  love?: string;
  work?: string;
  caution?: string;
  music?: string;
  musicFile?: string;
  voice?: string;
  font?: string;
  fontSize?: number;
  textColor?: string;
  charsPerSecond?: number;
  linesPerPage?: number;
  cta?: string;
  hashtags?: string;
  status?: string;
  notes?: string;
  /** Which render of the source row this is: full, love, money, work. */
  cut?: string;
  /** Source row id when this item is a cut. */
  parentId?: string;
  /** Post description, e.g. the astrology note moved off-screen for shorts. */
  description?: string;
  /** Overrides the template's target length for this render. */
  targetSec?: number;
}

export type WorkbookFormat = "wide" | "long";

export interface WorkbookMapping {
  sheet: string;
  format: WorkbookFormat;
  dateColumn: string;
  signColumn?: string;
  readingColumn?: string;
  signColumns?: Partial<Record<string, string>>;
  headerRow: number;
}

export interface SheetPreview {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  itemId?: string;
}

export interface LogEntry {
  id: string;
  at: number;
  level: "info" | "warn" | "error";
  message: string;
  detail?: string;
}

export interface RenderResult {
  itemId: string;
  filename: string;
  ok: boolean;
  durationSec?: number;
  bytes?: number;
  error?: string;
  withheld: boolean;
}

export interface LimitsConfig {
  minChars: number;
  maxChars: number;
  warnDurationSec: number;
  errorDurationSec: number;
}

export const DEFAULT_LIMITS: LimitsConfig = {
  minChars: 60,
  maxChars: 2200,
  // Short-form: most videos 30–60s, a few may stretch toward ~74s.
  warnDurationSec: 61,
  errorDurationSec: 75,
};
