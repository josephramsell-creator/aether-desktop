# Aether

Vertical video engine for daily horoscope Shorts (1080×1920).

## Windows download

**v2.0.0:** [Aether-Windows-x64.zip](https://github.com/josephramsell-creator/aether-desktop/releases/download/v2.0.0/Aether-Windows-x64.zip)

Unzip and run `Aether.exe`. First launch can create a desktop shortcut.

If you already have v1, unzip v2 into a new folder (or replace the old folder). Keep a copy of `data/content` first if you edited readings.

### v2

- Production workbook: date, sign, reading, music, voice, font, typewriter, lenses
- Edit a reading in the studio and **Save to workbook** — writes that cell back into the spreadsheet
- Open workbook / column mapping still work. Aether does not change the medallion.

Drop mp3s into `data/music` named after Catalog ids (`ambient-gold.mp3`, …). Missing audio still renders silent.

Videos save to `output/review/<date>/`.
