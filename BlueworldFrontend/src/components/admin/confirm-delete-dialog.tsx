import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

/** Best human-readable name for a record: title, name, headline, then id. */
export function labelOf(item: object): string {
  const r = item as Record<string, unknown>;
  const pick = [r["title"], r["name"], r["headline"], r["label"], r["slug"], r["id"]].find(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
  return String(pick ?? "this item");
}

/**
 * Two-step delete confirmation. Step 1 asks if they're sure; step 2 is the
 * final, irreversible warning, and its delete button stays locked for a
 * moment so a double-click can't sail straight through both steps.
 */
export function ConfirmDeleteDialog({
  open,
  title,
  itemLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  itemLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [locked, setLocked] = useState(true);

  // Always start at step 1 when (re)opened.
  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  // Lock the final button briefly each time step 2 appears.
  useEffect(() => {
    if (!open || step !== 2) return;
    setLocked(true);
    const t = setTimeout(() => setLocked(false), 1200);
    return () => clearTimeout(t);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-primary-deep/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm dark:bg-black/70"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lift"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Step {step} of 2
            </p>
            <h2 id="confirm-delete-title" className="font-display text-lg font-bold text-primary-deep">
              {step === 1 ? title : "This can't be undone"}
            </h2>
          </div>
        </div>

        <p className="mt-4 break-words text-sm text-foreground/80">
          {step === 1 ? (
            <>
              You're about to delete <span className="font-semibold text-primary-deep">“{itemLabel}”</span>.
              Are you sure?
            </>
          ) : (
            <>
              <span className="font-semibold text-primary-deep">“{itemLabel}”</span> will be permanently
              removed from the CMS and the live website. There is no undo and no recycle bin.
            </>
          )}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            autoFocus
            onClick={step === 1 ? onCancel : () => setStep(1)}
            className="min-h-11 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground/80"
          >
            {step === 1 ? "Cancel" : "Go back"}
          </button>
          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="min-h-11 rounded-full border border-destructive/50 px-5 py-2.5 text-sm font-bold text-destructive"
            >
              Yes, continue
            </button>
          ) : (
            <button
              type="button"
              disabled={locked}
              onClick={onConfirm}
              className="min-h-11 rounded-full bg-destructive px-5 py-2.5 text-sm font-bold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {locked ? "Please wait…" : "Delete permanently"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}