export const ZODIAC_SIGNS = [
  "Capricorn",
  "Aquarius",
  "Pisces",
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
] as const;

export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

export const SIGN_GLYPH: Record<ZodiacSign, string> = {
  Capricorn: "♑",
  Aquarius: "♒",
  Pisces: "♓",
  Aries: "♈",
  Taurus: "♉",
  Gemini: "♊",
  Cancer: "♋",
  Leo: "♌",
  Virgo: "♍",
  Libra: "♎",
  Scorpio: "♏",
  Sagittarius: "♐",
};

export function signSlug(sign: string): string {
  return sign.trim().toLowerCase();
}

export function badgeSrc(sign: string): string {
  return `/assets/horoscope/badges/${signSlug(sign)}.png`;
}

export const BADGE_ASSETS: Record<string, string> = Object.fromEntries(
  ZODIAC_SIGNS.map((sign) => [signSlug(sign), badgeSrc(sign)]),
);
