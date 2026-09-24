import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import { createServer } from "node:http";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
};

const renderOneArg = process.argv.find((arg) => arg.startsWith("--render-one"));
const renderOne = renderOneArg
  ? renderOneArg.slice("--render-one=".length) || process.argv[process.argv.indexOf("--render-one") + 1]
  : null;

if (process.platform === "win32") {
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  app.commandLine.appendSwitch("enable-accelerated-video-encode");
  app.commandLine.appendSwitch("enable-accelerated-video-decode");
  app.commandLine.appendSwitch("use-angle", "d3d11");
} else {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
}

function packagedExeDir() {
  if (app.isPackaged) return dirname(app.getPath("exe"));
  return process.cwd();
}

function uiDir() {
  return join(__dirname, "dist");
}

function resolveUiFile(urlPath) {
  const root = uiDir();
  let rel = decodeURIComponent((urlPath.split("?")[0] ?? "/"));
  if (rel === "/") rel = "/index.html";
  const candidate = safeJoin(root, rel);
  if (candidate && existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  if (rel !== "/index.html") {
    const index = join(root, "index.html");
    if (existsSync(index)) return index;
  }
  return null;
}

function safeJoin(root, relPath) {
  const resolved = resolve(root, String(relPath).replace(/^[/\\]+/, ""));
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || rel.includes(`..${sep}`)) return null;
  return resolved;
}

function dataDir() {
  const nextToExe = join(packagedExeDir(), "data");
  if (existsSync(nextToExe)) return nextToExe;
  if (existsSync(join(process.cwd(), "public", "assets"))) return join(process.cwd(), "public");
  return nextToExe;
}

function outputDir() {
  const dir = join(packagedExeDir(), "output", "review");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function ffmpegBin() {
  const bundledWin = join(packagedExeDir(), "bin", "ffmpeg.exe");
  const bundledNix = join(packagedExeDir(), "bin", "ffmpeg");
  if (process.platform === "win32" && existsSync(bundledWin)) return bundledWin;
  if (existsSync(bundledNix)) return bundledNix;
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["ffmpeg"], { encoding: "utf8" });
  const line = which.stdout?.trim().split(/\r?\n/)[0];
  return line && existsSync(line) ? line : null;
}

function encoderPreference() {
  return process.platform === "win32" ? "prefer-hardware" : "prefer-software";
}

function startServer() {
  const data = dataDir();
  const output = outputDir();
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://aether.local");
    const pathname = url.pathname;

    const sendFile = (file) => {
      const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
      res.writeHead(200, {
        "content-type": type,
        "cache-control": pathname.startsWith("/review/") ? "no-store" : "public, max-age=60",
      });
      createReadStream(file).pipe(res);
    };

    const uiFile = resolveUiFile(pathname);
    if (uiFile && (pathname === "/" || !pathname.startsWith("/assets/horoscope/") && !pathname.startsWith("/content/") && !pathname.startsWith("/review/"))) {
      sendFile(uiFile);
      return;
    }

    if (pathname.startsWith("/assets/") || pathname.startsWith("/content/") || pathname.startsWith("/music/")) {
      const file = safeJoin(data, pathname.slice(1));
      if (file && existsSync(file) && statSync(file).isFile()) {
        sendFile(file);
        return;
      }
    }

    if (pathname.startsWith("/review/")) {
      const file = safeJoin(output, pathname.slice("/review/".length));
      if (file && existsSync(file) && statSync(file).isFile()) {
        sendFile(file);
        return;
      }
      if (pathname === "/review/manifest.json") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(JSON.stringify({ date: "", folder: "/review", videos: [] }));
        return;
      }
    }

    if (uiFile) {
      sendFile(uiFile);
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolvePromise({ server, port, data, output });
    });
  });
}

function writeManifest(date) {
  const dir = join(outputDir(), date);
  mkdirSync(dir, { recursive: true });
  const videos = readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".mp4") || name.toLowerCase().endsWith(".webm"))
    .sort()
    .map((file) => {
      const sign = file.replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/\.(mp4|webm)$/i, "");
      const bytes = statSync(join(dir, file)).size;
      return {
        sign,
        file,
        url: `/review/${date}/${file}`,
        bytes,
        durationSec: 0,
      };
    });
  const payload = {
    date,
    folder: `/review/${date}`,
    running: false,
    videos,
    message: `${videos.length} videos`,
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(payload, null, 2));
  writeFileSync(join(outputDir(), "manifest.json"), JSON.stringify(payload, null, 2));
  return payload;
}

function createShortcut() {
  if (process.platform !== "win32") return false;
  const exe = app.isPackaged ? app.getPath("exe") : process.execPath;
  const desktop = app.getPath("desktop");
  const lnk = join(desktop, "Aether.lnk");
  const script = [
    `$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${JSON.stringify(lnk)})`,
    `$s.TargetPath = ${JSON.stringify(exe)}`,
    `$s.WorkingDirectory = ${JSON.stringify(dirname(exe))}`,
    `$s.Description = "Aether Vertical Video Engine"`,
    `$s.Save()`,
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    windowsHide: true,
    encoding: "utf8",
  });
  return result.status === 0 && existsSync(lnk);
}

function seedDataIfNeeded() {
  const dest = join(packagedExeDir(), "data");
  mkdirSync(join(packagedExeDir(), "output", "review"), { recursive: true });
  if (existsSync(join(dest, "assets")) && existsSync(join(dest, "content"))) return;
  const source = join(process.cwd(), "public");
  if (!existsSync(join(source, "assets"))) return;
  mkdirSync(join(dest, "assets"), { recursive: true });
  mkdirSync(join(dest, "content"), { recursive: true });
  mkdirSync(join(dest, "music"), { recursive: true });
  const copyTree = (from, to) => {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (entry.name === "review") continue;
      const src = join(from, entry.name);
      const out = join(to, entry.name);
      if (entry.isDirectory()) copyTree(src, out);
      else copyFileSync(src, out);
    }
  };
  if (!existsSync(join(dest, "assets", "horoscope"))) copyTree(join(source, "assets"), join(dest, "assets"));
  if (!existsSync(join(dest, "content", "horoscopes.csv"))) copyTree(join(source, "content"), join(dest, "content"));
  for (const name of ["aether-production.xlsx", "aether-production.template.xlsx", "horoscopes.xlsx"]) {
    const from = join(source, "content", name);
    const to = join(dest, "content", name);
    if (existsSync(from) && !existsSync(to)) copyFileSync(from, to);
  }
  if (existsSync(join(source, "music")) && !existsSync(join(dest, "music", "README.txt"))) {
    copyTree(join(source, "music"), join(dest, "music"));
  }
  const readme = join(__dirname, "DATA.txt");
  if (existsSync(readme) && !existsSync(join(dest, "README.txt"))) copyFileSync(readme, join(dest, "README.txt"));
}

let mainWindow = null;

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#0c0b0a",
    autoHideMenuBar: true,
    show: !renderOne,
    title: "Aether",
    webPreferences: {
      preload: join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  // A file dropped outside the drop zone would otherwise replace the studio with the file.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) event.preventDefault();
  });
  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  if (!renderOne) mainWindow.show();
}

ipcMain.handle("review:save", async (_event, payload) => {
  const filename = String(payload?.filename ?? "clip.mp4").replace(/[/\\]/g, "");
  const date = String(payload?.date ?? "undated").replace(/[/\\]/g, "");
  const bytes = payload?.bytes;
  const dir = join(outputDir(), date);
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, filename);
  const buffer = Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []));
  if (!buffer.byteLength) throw new Error("Empty file.");
  writeFileSync(dest, buffer);
  writeManifest(date);
  return buffer.byteLength;
});

ipcMain.handle("desktop:paths", async () => ({
  dataDir: dataDir(),
  outputDir: outputDir(),
  contentFile: join(dataDir(), "content", "aether-production.xlsx"),
  ffmpeg: ffmpegBin(),
  encoder: encoderPreference(),
}));

ipcMain.handle("desktop:open-output", async (_event, date) => {
  const dir = date ? join(outputDir(), String(date)) : outputDir();
  mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
});

ipcMain.handle("desktop:shortcut", async () => createShortcut());

ipcMain.handle("desktop:open-workbook", async () => {
  const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
    title: "Open workbook",
    filters: [
      { name: "Excel", extensions: ["xlsx", "xls"] },
      { name: "CSV", extensions: ["csv"] },
    ],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const bytes = new Uint8Array(readFileSync(filePath));
  return { name: basename(filePath), path: filePath, bytes };
});

ipcMain.handle("desktop:save-workbook", async (_event, payload) => {
  const bytes = payload?.bytes;
  const buffer = Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []));
  if (!buffer.byteLength) throw new Error("Empty workbook.");
  const requested = typeof payload?.path === "string" ? payload.path : "";
  const fallback = join(dataDir(), "content", "aether-production.xlsx");
  const dest = requested ? requested : fallback;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buffer);
  return { path: dest };
});

const WORKBOOK_EXT = /\.(xlsx|xls|csv)$/i;

// Dropped or picked workbooks are copied into data/content/workbooks so Aether always
// runs from its own folder. Re-importing a file with the same name keeps a timestamped backup.
ipcMain.handle("desktop:import-workbook", async (_event, payload) => {
  const name = basename(String(payload?.name ?? "")).replace(/[<>:"|?*]/g, "_");
  if (!WORKBOOK_EXT.test(name)) throw new Error("Only .xlsx, .xls, or .csv workbooks can be imported.");
  const bytes = payload?.bytes;
  const buffer = Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []));
  if (!buffer.byteLength) throw new Error("Empty workbook.");
  const dir = join(dataDir(), "content", "workbooks");
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, name);
  if (existsSync(dest)) {
    const backups = join(dir, "backups");
    mkdirSync(backups, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    copyFileSync(dest, join(backups, `${stamp}_${name}`));
  }
  writeFileSync(dest, buffer);
  return { name, path: dest };
});

ipcMain.handle("desktop:read-workbook", async (_event, filePath) => {
  const target = String(filePath ?? "");
  if (!WORKBOOK_EXT.test(target) || !existsSync(target)) return null;
  return { name: basename(target), path: target, bytes: new Uint8Array(readFileSync(target)) };
});

ipcMain.handle("desktop:save-config", async (_event, name, data) => {
  const dir = join(dataDir(), "config");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, basename(String(name || "config.json")));
  writeFileSync(file, JSON.stringify(data, null, 2));
});

ipcMain.handle("desktop:load-config", async (_event, name) => {
  const file = join(dataDir(), "config", basename(String(name || "config.json")));
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
});

app.whenReady().then(async () => {
  seedDataIfNeeded();
  const { server, port } = await startServer();
  await createWindow(port);

  if (process.platform === "win32" && app.isPackaged) {
    const flag = join(packagedExeDir(), "output", ".desktop-shortcut");
    if (!existsSync(flag)) {
      if (createShortcut()) writeFileSync(flag, new Date().toISOString());
    }
  }

  if (renderOne && mainWindow) {
    const [date, sign] = renderOne.split(":");
    try {
      await mainWindow.webContents.executeJavaScript(`
        new Promise(async (resolve, reject) => {
          const started = Date.now();
          const wait = async () => {
            if (document.fonts) await document.fonts.ready;
            if (typeof window.__aetherRenderItem === "function" && window.aetherDesktop) return;
            if (Date.now() - started > 45000) throw new Error("Studio did not boot");
            await new Promise((r) => setTimeout(r, 250));
            return wait();
          };
          await wait();
          window.__aetherSaveReviewFile = async (filename, bytes) => {
            const date = filename.slice(0, 10);
            return window.aetherDesktop.saveReviewFile(filename, bytes, date);
          };
          const jobs = window.__aetherListDate(${JSON.stringify(date || "2026-09-21")});
          const job = jobs.find((entry) => entry.sign === ${JSON.stringify(sign || "Capricorn")}) || jobs[0];
          if (!job) throw new Error("No job");
          const result = await window.__aetherRenderItem(job.id);
          resolve(result);
        })
      `);
      app.exit(0);
    } catch (err) {
      console.error(err);
      app.exit(1);
    }
  }

  app.on("before-quit", () => {
    server.close();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
