import type { ContentItem } from "@/engine/types";
import type { ZodiacSign } from "@/templates/horoscope/signs";

/**
 * Future monthly generator: read approved-source research notes, identify
 * recurring themes per sign, and write original daily prose into the same
 * CSV the renderer already consumes.
 *
 * This file is intentionally unimplemented. It exists so content generation
 * stays out of the video engine.
 */
export interface ResearchNote {
  sourceId: string;
  sign: ZodiacSign;
  capturedAt: string;
  themes: string[];
  summary: string;
}

export interface MonthRequest {
  year: number;
  month: number;
  notes: ResearchNote[];
}

export function synthesizeMonth(_request: MonthRequest): ContentItem[] {
  throw new Error(
    "Horoscope synthesis is not part of this milestone. Write the monthly archive into the CSV, then render.",
  );
}
