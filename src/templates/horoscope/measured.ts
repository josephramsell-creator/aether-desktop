/**
 * Pixel measurements taken from the supplied assets — not guessed.
 *
 * Background `background.png`
 *   native size: 941 × 1672 (aspect 0.5628, essentially 9:16)
 *
 * Inner dark badge aperture (algebraic circle fit on gold-flanked dark rows)
 *   center:  (469.87, 347.79)
 *   radius:  187.61   diameter: 375.23
 *   residual mean abs: 0.24px  max: 0.72px
 *   innermost gold ring begins at r ≈ 189
 *
 * Text panel (inner gold side-rails, below the circle ornament, above the sunburst)
 *   inner left rail  ≈ 134
 *   inner right rail ≈ 806
 *   usable top       ≈ 650
 *   usable bottom    ≈ 1400  (clouds/sunburst begin ~1460)
 *
 * Output canvas is 1080 × 1920. Coordinates below are native values scaled
 * independently to fill that canvas (x stretch 0.05% vs y — invisible).
 */

export const NATIVE_BACKGROUND = { width: 941, height: 1672 } as const;
export const NATIVE_BADGE = { cx: 469.87, cy: 347.79, radius: 187.61 } as const;
export const NATIVE_TEXT = { x: 150, y: 650, width: 640, height: 750 } as const;

export const OUTPUT = { width: 1080, height: 1920 } as const;

export const SCALE_X = OUTPUT.width / NATIVE_BACKGROUND.width;
export const SCALE_Y = OUTPUT.height / NATIVE_BACKGROUND.height;

export function nativeToOutputX(x: number): number {
  return x * SCALE_X;
}

export function nativeToOutputY(y: number): number {
  return y * SCALE_Y;
}

export const MEASURED_BADGE = {
  cx: nativeToOutputX(NATIVE_BADGE.cx),
  cy: nativeToOutputY(NATIVE_BADGE.cy),
  diameter: nativeToOutputX(NATIVE_BADGE.radius * 2),
} as const;

export const MEASURED_TEXT = {
  x: nativeToOutputX(NATIVE_TEXT.x),
  y: nativeToOutputY(NATIVE_TEXT.y),
  width: nativeToOutputX(NATIVE_TEXT.width),
  height: nativeToOutputY(NATIVE_TEXT.height),
} as const;
