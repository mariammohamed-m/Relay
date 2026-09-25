// Resolves .relay/ paths relative to cwd (the CLI is always run from repo root)
// and loads config.yml for the dashboard output path.
//
// These are functions, not module-level constants: computing them once at
// import time would freeze them to whatever cwd was active when the module
// first loaded, which breaks anything that changes cwd later (tests included).
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';

export const relayRoot = (): string => path.join(process.cwd(), '.relay');
export const tasksDir = (): string => path.join(relayRoot(), 'tasks');
export const knowledgeDir = (): string => path.join(relayRoot(), 'knowledge');
export const gotchasFile = (): string => path.join(knowledgeDir(), 'gotchas.md');
export const eventsFile = (): string => path.join(relayRoot(), 'metrics', 'events.jsonl');
export const activeFile = (): string => path.join(relayRoot(), '.active');
export const configFile = (): string => path.join(relayRoot(), 'config.yml');

export function taskDir(id: string, slug?: string): string {
  if (slug) return path.join(tasksDir(), `${id}-${slug}`);
  // Fall back to scanning when only the id is known.
  return path.join(tasksDir(), id);
}

export interface RelayConfig {
  project: string;
  schemaVersion: number;
  stages: string[];
  paths: {
    tasks: string;
    knowledge: string;
    metrics: string;
    dashboardData: string;
  };
  recovery?: {
    /** Minutes a stage may sit "running" before `relay recover` flags it as stuck. Default 30. */
    timeoutMinutes: number;
  };
}

const DEFAULT_RECOVERY_TIMEOUT_MINUTES = 30;

export async function loadConfig(): Promise<RelayConfig> {
  const raw = await readFile(configFile(), 'utf8');
  return parseYaml(raw) as RelayConfig;
}

export function recoveryTimeoutMinutes(cfg: RelayConfig): number {
  return cfg.recovery?.timeoutMinutes ?? DEFAULT_RECOVERY_TIMEOUT_MINUTES;
}

export function relayInitialized(): boolean {
  return existsSync(relayRoot());
}

export function dashboardDataPath(cfg: RelayConfig): string {
  return path.join(process.cwd(), cfg.paths.dashboardData);
}
