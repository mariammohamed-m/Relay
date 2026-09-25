import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// A centered modal, built on the same Radix Dialog primitives as Sheet
// (focus trap, Escape to close, portal) but anchored to the viewport center
// with a scale+fade entrance instead of an edge slide - the mockup's
// "floating overlay" treatment (rounded-lg border-line bg-surface
// shadow-overlay) applied to a dialog instead of a drawer.

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-canvas/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              />
            </DialogPrimitive.Overlay>
            <div className="fixed inset-0 z-50 grid place-items-center p-6">
              <DialogPrimitive.Content asChild forceMount>
                <motion.div
                  className={cn(
                    "flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-overlay",
                    className,
                  )}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                    <div className="min-w-0">
                      <DialogPrimitive.Title className="truncate text-sm font-medium text-fg">
                        {title}
                      </DialogPrimitive.Title>
                      {description && (
                        <DialogPrimitive.Description className="mt-1 text-xs text-subtle">
                          {description}
                        </DialogPrimitive.Description>
                      )}
                    </div>
                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        aria-label="Close"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-raised hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <XIcon className="h-4 w-4" aria-hidden />
                      </button>
                    </DialogPrimitive.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    {children}
                  </div>
                  {footer && (
                    <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
