// Auto-starts `relay compile --watch` (cli/src/compile.ts) alongside the Vite
// dev server, so editing .relay/ keeps dashboard/public/relay-data.json fresh
// without a developer remembering to run `relay compile` or a second terminal.
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { Plugin } from 'vite';

export function relayCompile(): Plugin {
  return {
    name: 'relay-compile-watch',
    configureServer(server) {
      const repoRoot = path.resolve(__dirname, '../..');
      const cliBin = path.join(repoRoot, 'cli/dist/index.js');
      const child: ChildProcess = spawn('node', [cliBin, 'compile', '--watch'], {
        cwd: repoRoot,
        stdio: 'inherit',
      });
      server.httpServer?.once('close', () => child.kill());
    },
  };
}
