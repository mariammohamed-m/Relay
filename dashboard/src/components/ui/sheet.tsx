import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// A right-side slide-over built on Radix Dialog for the accessibility
// primitives (focus trap, Escape to close, portal), styled and animated to
// match the mockup's one floating-overlay treatment (the task-switcher
// dropdown): rounded-lg border-line bg-surface shadow-overlay, eased with
// the mockup's ease-out-expo curve - just translating on X instead of Y/scale
// since this is a full-height edge panel, not an anchored popover.

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Which edge the panel slides in from. Defaults to "right" (the artifact-content use case). */
  side?: "left" | "right";
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "right",
}: SheetProps) {
  const edge = side === "left" ? "left-0 border-r" : "right-0 border-l";
  const enterX = side === "left" ? -24 : 24;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {/* Radix restores focus to whatever triggered the open on close, and closes on Escape - both for free. */}
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-canvas/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={description ? "sheet-description" : undefined}
            >
              <motion.div
                className={cn(
                  "fixed inset-y-0 z-50 flex w-full max-w-xl flex-col",
                  "bg-surface shadow-overlay",
                  edge,
                )}
                initial={{ x: enterX, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: enterX, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                  <div className="min-w-0">
                    <Dialog.Title className="truncate text-sm font-medium text-fg">
                      {title}
                    </Dialog.Title>
                    {description && (
                      <Dialog.Description
                        id="sheet-description"
                        className="mt-1 font-mono text-xs text-subtle"
                      >
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-raised hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <XIcon className="h-4 w-4" aria-hidden />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
