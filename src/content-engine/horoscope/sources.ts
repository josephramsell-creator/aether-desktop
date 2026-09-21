/**
 * Monthly horoscope research is a separate process from rendering.
 *
 * Do not scrape arbitrary sites. When a source list is approved, add it here
 * with the access method that source actually permits (official API, licensed
 * dump, RSS, or manual research notes). Collection must respect terms.
 */

export type SourceAccess = "api" | "rss" | "licensed-dump" | "manual";

export interface ApprovedSource {
  id: string;
  name: string;
  access: SourceAccess;
  notes: string;
}

export const APPROVED_SOURCES: ApprovedSource[] = [];
