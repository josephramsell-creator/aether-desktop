import type { TemplateConfig } from "@/engine/types";
import { createBibleTemplate } from "./bible/template";
import { createHoroscopeTemplate } from "./horoscope/template";
import { createQuotesTemplate } from "./quotes/template";

export type TemplateId = "horoscope" | "quotes" | "bible";

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  ready: boolean;
  note: string;
  create: () => TemplateConfig;
}

export const TEMPLATE_REGISTRY: TemplateMeta[] = [
  {
    id: "horoscope",
    name: "Daily Horoscope",
    ready: true,
    note: "Common frame + twelve zodiac medallions.",
    create: createHoroscopeTemplate,
  },
  {
    id: "quotes",
    name: "Inspirational Quotes",
    ready: false,
    note: "Same engine. Add a background and a 365-day quote sheet to activate.",
    create: createQuotesTemplate,
  },
  {
    id: "bible",
    name: "Daily Verse",
    ready: false,
    note: "Same engine. Add a licensed translation sheet and frame to activate.",
    create: createBibleTemplate,
  },
];

export function createTemplate(id: TemplateId): TemplateConfig {
  const meta = TEMPLATE_REGISTRY.find((item) => item.id === id);
  return (meta ?? TEMPLATE_REGISTRY[0]!).create();
}
