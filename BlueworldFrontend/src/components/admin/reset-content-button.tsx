import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { resetCms } from "@/lib/cms-store";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PHRASE = "I want to reset the content";

export function ResetContentButton() {
  const me = useMe();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  if (!me?.isSuperuser) return null; // nobody else even sees the button

  function close() {
    setStep(0);
    setTyped("");
  }

  async function confirm() {
    setBusy(true);
    try {
      await apiFetch("/admin/system/reset-content", {
        method: "POST",
        body: JSON.stringify({ confirmation: typed }),
      });
      resetCms();
      toast.success("Content reloaded from the server");
      close();
    } catch {
      toast.error("Could not reset content.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStep(1)}
        className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground/75 hover:bg-primary-soft"
      >
        Reset content
      </button>

      {/* Step 1: warning. "Keep" is the highlighted default. */}
      <AlertDialog open={step === 1} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all content?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a destructive action for the whole site. We strongly recommend you don't do this unless you are sure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setStep(2)}>
              I understand, continue
            </Button>
            <Button onClick={close}>Keep my content</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2: type the phrase. */}
      <AlertDialog open={step === 2} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm reset</AlertDialogTitle>
            <AlertDialogDescription>
              Type <span className="font-mono font-semibold text-foreground">{PHRASE}</span> to enable the button.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={PHRASE} autoFocus />
          <AlertDialogFooter>
            <Button onClick={close}>Cancel</Button>
            <Button variant="destructive" disabled={typed.trim() !== PHRASE || busy} onClick={() => void confirm()}>
              {busy ? "Resetting…" : "Reset content"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}