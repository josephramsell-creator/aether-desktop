import type { TemplateConfig } from "./types";

export interface LoadedAssets {
  background: HTMLImageElement | null;
  badges: Record<string, HTMLImageElement>;
}

const cache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src);
  if (hit) return hit;
  const job = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => {
      cache.delete(src);
      reject(new Error(`Failed to load ${src}`));
    };
    image.src = src;
  });
  cache.set(src, job);
  return job;
}

export async function loadPreviewAssets(
  template: TemplateConfig,
  assetKey?: string,
): Promise<LoadedAssets> {
  const badges: Record<string, HTMLImageElement> = {};
  const background = template.background.src
    ? await loadImage(template.background.src)
    : null;
  if (template.badge && assetKey) {
    const src = template.badge.assets[assetKey];
    if (src) badges[assetKey] = await loadImage(src);
  }
  return { background, badges };
}

export async function ensureBadge(
  template: TemplateConfig,
  assets: LoadedAssets,
  assetKey: string,
): Promise<LoadedAssets> {
  if (!template.badge || assets.badges[assetKey]) return assets;
  const src = template.badge.assets[assetKey];
  if (!src) return assets;
  const image = await loadImage(src);
  return { ...assets, badges: { ...assets.badges, [assetKey]: image } };
}

export async function loadTemplateAssets(template: TemplateConfig): Promise<LoadedAssets> {
  const badges: Record<string, HTMLImageElement> = {};
  const jobs: Promise<void>[] = [];

  let background: HTMLImageElement | null = null;
  if (template.background.src) {
    jobs.push(
      loadImage(template.background.src).then((image) => {
        background = image;
      }),
    );
  }

  if (template.badge) {
    for (const [key, src] of Object.entries(template.badge.assets)) {
      jobs.push(
        loadImage(src).then((image) => {
          badges[key] = image;
        }),
      );
    }
  }

  await Promise.allSettled(jobs);
  return { background, badges };
}

export async function loadVideoFonts(families: string[]): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const unique = [...new Set(families.filter(Boolean))];
  await Promise.all(
    unique.flatMap((family) => [
      document.fonts.load(`500 44px "${family}"`),
      document.fonts.load(`600 30px "${family}"`),
      document.fonts.load(`italic 500 20px "${family}"`),
    ]),
  );
  await document.fonts.ready;
}
