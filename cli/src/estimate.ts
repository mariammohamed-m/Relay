// `relay task estimate` - computes/records the estimated manual-completion
// baseline for a task (see EstimatedBaseline in ./types.ts). This command's
// own computation only ever produces the fallback tiers (historical average
// or default) since the CLI has no LLM access; the `ai-estimated` tier is
// produced by Bob's LLM call during the brief stage, which records it here
// via --method ai-estimated. Useful on its own for testing the fallback
// tiers without spending Bob coins on a real brief run.
import path from "node:path";
import { resolveActiveTask } from "./active.js";
import { saveTask } from "./fsutil.js";
import { loadConfig, type RelayConfig } from "./paths.js";
import {
  STAGES,
  type EstimatedBaseline,
  type EstimationMethod,
  type StageId,
} from "./types.js";

const DEFAULT_FALLBACK_SEC = 21600; // see config.yml's estimation.defaultFallbackSec comment

function parsePerStage(spec: string | undefined): Partial<Record<StageId, number>> {
  const out: Partial<Record<StageId, number>> = {};
  if (!spec) return out;
  for (const pair of spec.split(",")) {
    const [stage, sec] = pair.split("=").map((s) => s.trim());
    if (STAGES.includes(stage as StageId) && sec && !Number.isNaN(Number(sec))) {
      out[stage as StageId] = Number(sec);
    }
  }
  return out;
}

/** Tier 2/3: never requires an LLM call, so it's safe to (re)run freely. */
export function fallbackEstimate(cfg: RelayConfig): EstimatedBaseline {
  const avg = cfg.estimation?.averageTicketDurationSec;
  const estimatedAt = new Date().toISOString();
  if (avg != null) {
    return { totalSec: avg, perStage: {}, method: "historical-average", estimatedAt };
  }
  const fallback = cfg.estimation?.defaultFallbackSec ?? DEFAULT_FALLBACK_SEC;
  return { totalSec: fallback, perStage: {}, method: "default-fallback", estimatedAt };
}

export interface TaskEstimateOptions {
  task?: string;
  method?: EstimationMethod;
  totalSec?: number;
  perStage?: string;
  basedOn?: string;
}

export async function cmdTaskEstimate(opts: TaskEstimateOptions): Promise<void> {
  const { dir, task } = await resolveActiveTask(opts.task);

  if (opts.method && opts.method !== "ai-estimated") {
    throw new Error(
      '--method only accepts "ai-estimated" here - the fallback tiers are computed automatically when --method is omitted.',
    );
  }

  let estimate: EstimatedBaseline;
  if (opts.method === "ai-estimated") {
    if (opts.totalSec === undefined) {
      throw new Error("--total-sec is required with --method ai-estimated.");
    }
    estimate = {
      totalSec: opts.totalSec,
      perStage: parsePerStage(opts.perStage),
      method: "ai-estimated",
      estimatedAt: new Date().toISOString(),
      ...(opts.basedOn ? { basedOnSimilarTask: opts.basedOn } : {}),
    };
  } else {
    const cfg = await loadConfig();
    estimate = fallbackEstimate(cfg);
  }

  task.estimatedBaseline = estimate;
  await saveTask(path.join(dir, "task.json"), task);
  console.log(
    `${task.id}: estimated baseline ${Math.round(estimate.totalSec / 60)}m (method: ${estimate.method})`,
  );
  if (task.estimatedBaseline.basedOnSimilarTask) {
    console.log(`  based on similar task: ${task.estimatedBaseline.basedOnSimilarTask}`);
  }
}
