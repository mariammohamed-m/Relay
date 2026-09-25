import { SCHEMA_VERSION, type RelayData } from "@/lib/types";

export type RelayDataFailure =
  | { kind: "missing" }
  | { kind: "unreachable"; detail: string }
  | { kind: "malformed"; detail: string }
  | { kind: "schema-mismatch"; found: number };

export type RelayDataResult =
  | { ok: true; data: RelayData }
  | { ok: false; failure: RelayDataFailure };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Minimal structural check - not a full schema validator. It exists to turn
 * "the file doesn't look like RelayData" into a calm, typed failure instead
 * of letting components crash on `undefined.map`.
 */
function looksLikeRelayData(v: unknown): v is RelayData {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.schemaVersion === "number" &&
    typeof v.generatedAt === "string" &&
    Array.isArray(v.tasks) &&
    Array.isArray(v.knowledge) &&
    isPlainObject(v.impact)
  );
}

export async function fetchRelayData(url: string): Promise<RelayDataResult> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (err) {
    return {
      ok: false,
      failure: { kind: "unreachable", detail: (err as Error).message },
    };
  }

  if (res.status === 404) {
    return { ok: false, failure: { kind: "missing" } };
  }
  if (!res.ok) {
    return {
      ok: false,
      failure: { kind: "unreachable", detail: `HTTP ${res.status}` },
    };
  }

  const text = await res.text();

  // A dev server (Vite's included) falls back to serving index.html with a
  // 200 for any unmatched static path - so a "missing" relay-data.json
  // shows up here as an HTML document, not a 404. Treat that the same as a
  // real 404 rather than misreporting it as malformed JSON.
  const contentType = res.headers.get("content-type") ?? "";
  if (
    contentType.includes("text/html") ||
    text.trimStart().startsWith("<!doctype")
  ) {
    return { ok: false, failure: { kind: "missing" } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      failure: { kind: "malformed", detail: (err as Error).message },
    };
  }

  if (!looksLikeRelayData(parsed)) {
    return {
      ok: false,
      failure: {
        kind: "malformed",
        detail: "JSON does not match the RelayData shape",
      },
    };
  }

  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      failure: { kind: "schema-mismatch", found: parsed.schemaVersion },
    };
  }

  return { ok: true, data: parsed };
}
