import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import type { StageStatus } from "@/lib/types";

interface StatusIconProps {
  status: StageStatus;
  size?: "sm" | "md";
}

// Status is never carried by color alone - shape doubles it up (dashed =
// skipped, hollow = pending, filled = done) so it reads without color too.
export function StatusIcon({ status, size = "md" }: StatusIconProps) {
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const glyph = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  if (status === "done") {
    return (
      <span
        className={`${dim} grid shrink-0 place-items-center rounded-full bg-ok/15 text-ok`}
        aria-hidden
      >
        <CheckIcon className={glyph} strokeWidth={3} />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className={`${dim} relative shrink-0`} aria-hidden>
        <span className="absolute inset-0 rounded-full border-2 border-accent/25" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent motion-safe:animate-spin" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className={`${dim} grid shrink-0 place-items-center rounded-full bg-bad/15 text-bad`}
        aria-hidden
      >
        <XIcon className={glyph} strokeWidth={3} />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span
        className={`${dim} grid shrink-0 place-items-center rounded-full border border-dashed border-subtle text-subtle`}
        aria-hidden
      >
        <MinusIcon className={glyph} />
      </span>
    );
  }
  return (
    <span
      className={`${dim} shrink-0 rounded-full border border-line-strong`}
      aria-hidden
    />
  );
}
