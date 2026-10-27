import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAdminUser } from "@/hooks/use-admin-auth";
import { ENDPOINTS, apiErrorDetail, apiFetch } from "@/lib/api";
import {
  DATE_PLACEHOLDER,
  approvalEmail,
  declineEmail,
  formatInterviewTime,
  todayIso,
} from "@/lib/application-emails";
import { useCmsState } from "@/lib/cms-store";

export interface DecidableApplication {
  id: string;
  fullName: string;
  email: string;
}

/**
 * The confirmation step for Approve / Decline. It shows the exact email that will be sent,
 * addressed to the applicant by name, and HR can edit it before confirming.
 */
export function DecisionDialog<T extends DecidableApplication>({
  application,
  jobTitle,
  kind,
  onClose,
  onDone,
}: {
  application: T;
  jobTitle: string;
  kind: "approve" | "decline";
  onClose: () => void;
  onDone: (updated: T) => void;
}) {
  const { settings } = useCmsState();
  const company = settings?.companyName ?? "Blue World Cosmetics";
  const signer = getAdminUser()?.fullName || "The Hiring Team";
  const approving = kind === "approve";

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState((settings?.addressLines ?? []).join(", "));
  const base = { name: application.fullName, jobTitle, company, signer };
  const [subject, setSubject] = useState(() => (approving ? approvalEmail({ ...base, date, time, venue }) : declineEmail(base)).subject);
  const [body, setBody] = useState(() => (approving ? approvalEmail({ ...base, date, time, venue }) : declineEmail(base)).body);
  const [edited, setEdited] = useState(false);
  const [sending, setSending] = useState(false);

  // Until HR types into the message themselves, the date / time / venue fields keep it up to date.
  useEffect(() => {
    if (!approving || edited) return;
    const t = approvalEmail({ ...base, date, time, venue });
    setSubject(t.subject);
    setBody(t.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time, venue, approving, edited]);

  const missingDate = approving && !date;
  const placeholderLeft = approving && body.includes(DATE_PLACEHOLDER);
  const canSend = !sending && subject.trim().length >= 3 && body.trim().length >= 20 && !missingDate && !placeholderLeft;

  function reset() {
    const t = approving ? approvalEmail({ ...base, date, time, venue }) : declineEmail(base);
    setSubject(t.subject);
    setBody(t.body);
    setEdited(false);
  }

  async function send() {
    setSending(true);
    try {
      const updated = await apiFetch<T>(
        `${ENDPOINTS.adminApplications}/${application.id}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            decision: kind,
            subject: subject.trim(),
            body: body.trim(),
            interviewDate: approving ? date : null,
            interviewTime: approving && time ? formatInterviewTime(time) : null,
          }),
        },
        30_000,
      );
      toast.success(approving ? `Approval letter sent to ${application.fullName}` : `Rejection letter sent to ${application.fullName}`);
      onDone(updated);
    } catch (err) {
      toast.error("The email was not sent", { description: apiErrorDetail(err, "Something went wrong. Nothing was sent, so you can try again.") });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{approving ? "Send approval letter" : "Send rejection letter"}</DialogTitle>
          <DialogDescription>
            Check the email below. It goes to <span className="font-semibold text-foreground">{application.email}</span> as soon as you
            confirm, and you can edit anything first.
          </DialogDescription>
        </DialogHeader>

        {approving && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-primary-deep">
              Interview date <span className="text-destructive">*</span>
              <Input type="date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
            </label>
            <label className="text-sm font-semibold text-primary-deep">
              Time <span className="font-normal text-muted-foreground">(optional)</span>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1.5" />
            </label>
            <label className="text-sm font-semibold text-primary-deep sm:col-span-2">
              Venue <span className="font-normal text-muted-foreground">(optional)</span>
              <Input value={venue} onChange={(e) => setVenue(e.target.value)} className="mt-1.5" />
            </label>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-2.5 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span>
              To: <span className="font-semibold text-foreground">{application.fullName}</span> &lt;{application.email}&gt;
            </span>
          </div>
          <div className="border-b border-border px-4 py-2">
            <label className="sr-only" htmlFor="decision-subject">
              Subject
            </label>
            <input
              id="decision-subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setEdited(true);
              }}
              className="w-full bg-transparent text-sm font-semibold text-primary-deep outline-none"
            />
          </div>
          <textarea
            aria-label="Email message"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setEdited(true);
            }}
            rows={15}
            className="block w-full resize-y bg-background px-4 py-3 text-sm leading-relaxed outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className={missingDate || placeholderLeft ? "font-semibold text-destructive" : "text-muted-foreground"}>
            {missingDate
              ? "Set the interview date to continue."
              : placeholderLeft
                ? `Replace ${DATE_PLACEHOLDER} in the message with the date.`
                : edited && approving
                  ? "You've edited the message, so changing the date above won't update it."
                  : "This can't be undone: the applicant gets the email straight away."}
          </p>
          {edited && (
            <button type="button" onClick={reset} className="font-bold text-accent hover:underline">
              Reset to the standard message
            </button>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button variant={approving ? "default" : "destructive"} onClick={() => void send()} disabled={!canSend}>
            {sending ? "Sending…" : approving ? "Send approval letter" : "Send rejection letter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}