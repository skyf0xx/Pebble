import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

let server: Server | null = null;

// mcp/dist/http-server.js → repo root is two levels up.
function repoRoot(): string {
  const here = fileURLToPath(import.meta.url);
  return resolve(here, "..", "..", "..");
}

export function startHttpServer(port: number): Promise<void> {
  const root = join(repoRoot(), "dist");

  return new Promise((res, rej) => {
    server = createServer(async (req, response) => {
      try {
        const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
        let filePath = join(root, urlPath === "/" ? "index.html" : urlPath);

        // SPA fallback: if the path has no extension and the file isn't there,
        // serve index.html so client-side routing works.
        try {
          const s = await stat(filePath);
          if (s.isDirectory()) filePath = join(filePath, "index.html");
        } catch {
          if (!extname(urlPath)) filePath = join(root, "index.html");
        }

        // Block traversal outside dist/.
        if (!filePath.startsWith(root)) {
          response.writeHead(403).end("Forbidden");
          return;
        }

        const body = await readFile(filePath);
        const mime = MIME[extname(filePath)] ?? "application/octet-stream";
        response.writeHead(200, {
          "Content-Type": mime,
          "Cache-Control": "no-cache",
        });
        response.end(body);
      } catch {
        response.writeHead(404).end("Not found");
      }
    });

    server.on("error", rej);
    server.listen(port, () => res());
  });
}

export function stopHttpServer(): Promise<void> {
  return new Promise((res) => {
    if (!server) return res();
    server.close(() => {
      server = null;
      res();
    });
  });
}
