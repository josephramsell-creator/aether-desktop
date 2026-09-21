#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const CSV = "/workspace/public/content/horoscopes.csv";
const OUT = "/workspace/public/content/aether-production.xlsx";
const TEMPLATE = "/workspace/public/content/aether-production.template.xlsx";

const SIGNS = [
  "Capricorn","Aquarius","Pisces","Aries","Taurus","Gemini",
  "Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius",
];

const MUSIC = [
  ["ambient-gold", "Warm pad under the typewriter"],
  ["night-pulse", "Low pulse for night readings"],
  ["temple-air", "Open air, light chimes"],
  ["ember-low", "Quiet ember drone"],
  ["silver-orbit", "Soft arpeggio bed"],
  ["still-water", "Held tone, very still"],
  ["brass-dawn", "Soft dawn brass"],
  ["velvet-hour", "Evening velvet texture"],
  ["north-line", "Sparse piano line"],
  ["close-circle", "Closing-day sustain"],
];

const THEMES = {
  "2026-09-21": "Communication and structure",
  "2026-09-22": "Follow-through",
  "2026-09-23": "Adjustment",
  "2026-09-24": "Momentum",
  "2026-09-25": "Clarity",
  "2026-09-26": "Integration",
  "2026-09-27": "Courage",
  "2026-09-28": "Repair",
  "2026-09-29": "Discernment",
  "2026-09-30": "Close the circle",
};

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let quoted = false;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim()));
}

function splitLenses(body) {
  const labels = ["Money", "Love", "Work", "Caution"];
  const parts = {};
  let remaining = body.replace(/\r\n/g, "\n");
  let intro = remaining;
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const start = remaining.search(new RegExp(`\\b${label}:`, "i"));
    if (start < 0) continue;
    if (i === 0) intro = remaining.slice(0, start).trim();
    remaining = remaining.slice(start + label.length + 1);
    const next = labels[i + 1];
    if (next) {
      const end = remaining.search(new RegExp(`\\b${next}:`, "i"));
      parts[label] = remaining.slice(0, end < 0 ? undefined : end).replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
      if (end >= 0) remaining = remaining.slice(end);
    } else {
      parts[label] = remaining.replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
    }
  }
  return {
    intro: intro.replace(/\n+/g, " ").trim(),
    money: parts.Money ?? "",
    love: parts.Love ?? "",
    work: parts.Work ?? "",
    caution: parts.Caution ?? "",
  };
}

function monthDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[m - 1]} ${d}, ${y}`;
}

const csvRows = parseCsv(fs.readFileSync(CSV, "utf8"));
const header = csvRows[0];
const dateIdx = header.findIndex((h) => h.trim().toLowerCase() === "date");
const signIdx = Object.fromEntries(SIGNS.map((sign) => [sign, header.findIndex((h) => h.trim() === sign)]));

const readingRows = [[
  "date","sign","title","subtitle","theme","intro","money","love","work","caution","reading",
  "music","music_file","voice","font","font_size","text_color","chars_per_second","lines_per_page",
  "cta","hashtags","status","notes",
]];
const dayRows = [["date","theme","music","voice","font"]];

csvRows.slice(1).forEach((row, index) => {
  const date = row[dateIdx]?.trim();
  if (!date) return;
  const music = MUSIC[index % MUSIC.length][0];
  const theme = THEMES[date] ?? "Daily horoscope";
  dayRows.push([date, theme, music, "none", "Cormorant Garamond"]);
  for (const sign of SIGNS) {
    const body = (row[signIdx[sign]] ?? "").trim();
    const lenses = splitLenses(body);
    readingRows.push([
      date,
      sign,
      sign.toUpperCase(),
      monthDay(date),
      theme,
      lenses.intro,
      lenses.money,
      lenses.love,
      lenses.work,
      lenses.caution,
      body,
      music,
      `music/${music}.mp3`,
      "none",
      "Cormorant Garamond",
      57,
      "#f3eee4",
      10,
      6,
      "Follow Aether for tomorrow's reading.",
      `#horoscope #${sign.toLowerCase()} #shorts`,
      "ready",
      "Drop the named mp3 into data/music to attach audio. Voice stays none while the typewriter is the spoken line.",
    ]);
  }
});

const guide = [
  ["Aether production workbook"],
  ["One row in Readings = one vertical video. Aether reads this file; it does not write back unless you export."],
  [],
  ["Sheet", "Purpose"],
  ["Readings", "Canonical content. Date + Sign + Reading required. Other columns are optional production controls."],
  ["Days", "Day-level defaults (theme, music, voice, font) inherited when a Readings cell is blank."],
  ["Defaults", "Engine-wide fallbacks."],
  ["Catalog", "Ids Aether understands for music, voice, and font. Keep ids stable."],
  [],
  ["Column", "Used for"],
  ["date", "Calendar day (YYYY-MM-DD). Selects the twelve-sign set."],
  ["sign", "Zodiac sign. Pairs to the existing medallion asset."],
  ["reading", "Full on-screen text. If blank, Aether assembles intro + Money/Love/Work/Caution."],
  ["intro / money / love / work / caution", "Structured copy. Optional if reading is filled."],
  ["title / subtitle", "On-card lines under the medallion."],
  ["theme", "Shown in the control panel; not burned into the card unless you put it in the reading."],
  ["music / music_file", "Bed id and file path. Aether looks in data/music. Video still renders if the file is missing."],
  ["voice", "Voiceover id. none = typewriter only. Reserved for the VO module."],
  ["font / font_size / text_color", "Per-video type overrides. Empty = template defaults."],
  ["chars_per_second / lines_per_page", "Per-video typewriter overrides."],
  ["cta / hashtags", "Publishing fields for later modules. Stored with the item, not drawn yet."],
  ["status", "draft / ready / rendered. Aether reads this; it does not write it back."],
];

const defaults = [
  ["key", "value"],
  ["font", "Cormorant Garamond"],
  ["font_size", "57"],
  ["text_color", "#f3eee4"],
  ["voice", "none"],
  ["music", "ambient-gold"],
  ["chars_per_second", "10"],
  ["lines_per_page", "6"],
  ["status", "ready"],
];

const catalog = [
  ["type", "id", "label", "file", "notes"],
  ...MUSIC.map(([id, notes]) => ["music", id, id.replace(/-/g, " "), `music/${id}.mp3`, notes]),
  ["voice", "none", "Typewriter only", "", "Current default. No spoken track."],
  ["voice", "narrator-warm", "Warm narrator", "voice/narrator-warm", "Reserved. Add a VO file later."],
  ["font", "Cormorant Garamond", "Cormorant Garamond", "", "Default reading face. Bundled."],
  ["font", "Figtree", "Figtree", "", "Alternate. Bundled."],
];

function book(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return wb;
}

const filled = book([
  ["Guide", guide],
  ["Readings", readingRows],
  ["Days", dayRows],
  ["Defaults", defaults],
  ["Catalog", catalog],
]);
XLSX.writeFile(filled, OUT);

const blankReadings = [readingRows[0], [
  "2026-09-21","Capricorn","CAPRICORN","September 21, 2026","Example theme","Intro sentence.",
  "Money lens","Love lens","Work lens","Caution lens","","ambient-gold","music/ambient-gold.mp3",
  "none","Cormorant Garamond",57,"#f3eee4",10,6,"Follow Aether.","#horoscope","draft","Replace this row.",
]];
const blank = book([
  ["Guide", guide],
  ["Readings", blankReadings],
  ["Days", [dayRows[0]]],
  ["Defaults", defaults],
  ["Catalog", catalog],
]);
XLSX.writeFile(blank, TEMPLATE);

const items = readingRows.slice(1).map((row) => ({
  id: `${row[0]}_${row[1]}`,
  templateId: "horoscope",
  date: row[0],
  channel: row[1],
  title: row[2],
  subtitle: row[3],
  body: row[10],
  assetKey: String(row[1]).toLowerCase(),
  theme: row[4],
  intro: row[5],
  money: row[6],
  love: row[7],
  work: row[8],
  caution: row[9],
  music: row[11],
  musicFile: row[12],
  voice: row[13],
  font: row[14],
  fontSize: Number(row[15]),
  textColor: row[16],
  charsPerSecond: Number(row[17]),
  linesPerPage: Number(row[18]),
  cta: row[19],
  hashtags: row[20],
  status: row[21],
  notes: row[22],
}));
const dates = [...new Set(items.map((item) => item.date))];
const payload = JSON.stringify({ sourceName: "aether-production.xlsx", dates, items });
fs.writeFileSync("/workspace/public/content/aether-production.json", payload);
fs.mkdirSync("/workspace/src/data", { recursive: true });
fs.writeFileSync("/workspace/src/data/aether-production.json", payload);

console.log(`wrote ${OUT} (${readingRows.length - 1} readings)`);
console.log(`wrote ${TEMPLATE}`);
console.log("wrote /workspace/public/content/aether-production.json");
console.log("wrote /workspace/src/data/aether-production.json");

