# Aether

Vertical video engine for daily horoscope Shorts (1080×1920).

## Windows download

**v2.0.0 (full install):** [Aether-Windows-x64.zip](https://github.com/josephramsell-creator/aether-desktop/releases/download/v2.0.0/Aether-Windows-x64.zip)

**v2.0.0 (update patch, if you already have v1):** [Aether-v2-patch.zip](https://github.com/josephramsell-creator/aether-desktop/releases/download/v2.0.0/Aether-v2-patch.zip)

Unzip the full pack and run `Aether.exe`. First launch can create a desktop shortcut.

If v1 is already installed: unzip the patch, run `APPLY-v2.bat`, and start `Aether.exe`. That overwrites the studio inside your current folder and leaves your readings workbook alone if it already exists.

### v2

- Production workbook: date, sign, reading, music, voice, font, typewriter, lenses
- Edit a reading in the studio and **Save to workbook** — writes that cell back into the spreadsheet
- Open workbook / column mapping still work. Aether does not change the medallion.

Drop mp3s into `data/music` named after Catalog ids (`ambient-gold.mp3`, …). Missing audio still renders silent.

Videos save to `output/review/<date>/`.
