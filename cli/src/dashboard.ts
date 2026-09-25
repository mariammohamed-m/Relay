// `relay dashboard` - serves the prebuilt dashboard (shipped in
// dashboard-dist/, see cli/scripts/copy-dashboard-dist.mjs) against the
// current project's compiled data, so it looks exactly like the Relay
// monorepo's own dashboard without needing Vite or a second project.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadConfig, dashboardDataPath } from "./paths.js";

const DASHBOARD_DIST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dashboard-dist",
);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {
    // Best-effort only - not being able to auto-open isn't fatal.
  });
}

export interface DashboardOptions {
  port?: string;
  open?: boolean;
}

/**
 * Binds `server` starting at `startPort`, retrying on the next port if one
 * is already in use, instead of hanging forever - an http.Server's 'error'
 * event on a failed listen() has no default handler, so without this the
 * process just sits there with no feedback and nothing actually listening.
 */
async function listenOnFreePort(
  server: ReturnType<typeof createServer>,
  startPort: number,
  maxAttempts = 20,
): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, () => {
          server.removeListener("error", reject);
          resolve();
        });
      });
      return port;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
    }
  }
  throw new Error(
    `No free port found in ${startPort}-${startPort + maxAttempts - 1} - pass --port to pick one manually.`,
  );
}

export async function cmdDashboard(opts: DashboardOptions): Promise<void> {
  if (!existsSync(DASHBOARD_DIST)) {
    throw new Error(
      "dashboard-dist/ not found in this install - the published package is missing its bundled dashboard build.",
    );
  }
  const requestedPort = Number(opts.port ?? 4317);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (url.pathname === "/relay-data.json") {
        try {
          const cfg = await loadConfig();
          const data = await readFile(dashboardDataPath(cfg));
          res.writeHead(200, { "Content-Type": MIME[".json"] });
          res.end(data);
        } catch {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("relay-data.json not found - run `relay compile` first.");
        }
        return;
      }

      const reqPath = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = path.join(DASHBOARD_DIST, reqPath);
      if (!filePath.startsWith(DASHBOARD_DIST) || !existsSync(filePath)) {
        // Single-page app: any unmatched route falls back to index.html.
        const indexHtml = await readFile(path.join(DASHBOARD_DIST, "index.html"));
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(indexHtml);
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
      res.end(await readFile(filePath));
    } catch (err) {
      // A single bad request must never take the whole dashboard server down.
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Internal error: ${(err as Error).message}`);
    }
  });

  const port = await listenOnFreePort(server, requestedPort);
  server.on("error", (err) => {
    // Fires for errors after the server is already listening (e.g. a
    // client resetting a connection) - log and keep serving, never crash.
    console.error(`Dashboard server error: ${(err as Error).message}`);
  });
  const url = `http://localhost:${port}`;
  if (port !== requestedPort) {
    console.log(`Port ${requestedPort} was in use - using ${port} instead.`);
  }
  console.log(`Dashboard running at ${url}`);
  console.log("Press Ctrl+C to stop.");
  if (opts.open !== false) openBrowser(url);
}
