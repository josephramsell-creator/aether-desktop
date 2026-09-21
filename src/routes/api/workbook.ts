import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/workbook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawName = request.headers.get("x-aether-filename") ?? "aether-production.xlsx";
        const filename = basename(rawName);
        if (!/^[A-Za-z0-9._-]+\.xlsx$/i.test(filename)) {
          return Response.json({ ok: false, error: "Invalid workbook name." }, { status: 400 });
        }
        const buffer = Buffer.from(await request.arrayBuffer());
        if (!buffer.byteLength) {
          return Response.json({ ok: false, error: "Empty workbook." }, { status: 400 });
        }
        try {
          const dir = join(process.cwd(), "public", "content");
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, filename), buffer);
          return Response.json({ ok: true, name: filename });
        } catch {
          return Response.json({ ok: false, error: "Workbook is not writable here." }, { status: 501 });
        }
      },
    },
  },
});
