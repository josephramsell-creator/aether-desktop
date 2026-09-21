# Aether

Vertical video engine for daily horoscope Shorts (1080×1920).

## Windows download

**Latest (v2.0.1, full install):** [Aether-Windows-x64.zip](https://github.com/josephramsell-creator/aether-desktop/releases/download/v2.0.1/Aether-Windows-x64.zip)

**Update patch (already have v1 or broken v2):** [Aether-v2-patch.zip](https://github.com/josephramsell-creator/aether-desktop/releases/download/v2.0.1/Aether-v2-patch.zip)

Unzip the full pack and run `Aether.exe`. First launch can create a desktop shortcut.

If Aether is already installed: close it, unzip the patch, run `APPLY-v2.bat`, start `Aether.exe`. That restores the studio layout inside your current folder and leaves your readings workbook alone if it already exists.

### v2.0.1

- Restores the control UI stylesheet (v2.0.0 opened as an unstyled text dump)

### v2

- Production workbook: date, sign, reading, music, voice, font, typewriter, lenses
- Edit a reading in the studio and **Save to workbook** — writes that cell back into the spreadsheet
- Open workbook / column mapping still work. Aether does not change the medallion.

Drop mp3s into `data/music` named after Catalog ids (`ambient-gold.mp3`, …). Missing audio still renders silent.

Videos save to `output/review/<date>/`.
