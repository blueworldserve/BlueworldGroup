import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Lock, Send } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  MessageBubble,
  StatusBadge,
  SubmittedDetails,
  firstName,
  fullWhen,
} from "@/components/admin/inbox-parts";
import { SenderField } from "@/components/admin/sender-field";
import { getAdminUser } from "@/hooks/use-admin-auth";
import { apiErrorDetail, apiFetch, ApiError, ENDPOINTS } from "@/lib/api";
import type { InboxMessageDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/inbox/$messageId/reply")({
  head: () => ({
    meta: [{ title: "Reply — Blue World CMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ReplyPage,
});




function RouteComponent() {
  return <div>Hello "/admin/inbox/$messageId/reply"!</div>
}

const BODY_MAX = 5000;

function ReplyPage() {
  const { messageId } = Route.useParams();
  const navigate = useNavigate();
  const session = getAdminUser();
  const canSend = !!session && (session.role === "admin" || session.role === "editor" || session.isSuperuser === true);

  const [detail, setDetail] = useState<InboxMessageDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [fromEmail, setFromEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiFetch<InboxMessageDetail>(`${ENDPOINTS.adminContactMessages}/${messageId}`);
        if (cancelled) return;
        setDetail(d);
        const re = /^re:/i.test(d.subject ?? "") ? (d.subject ?? "") : `Re: ${d.subject ?? ""}`;
        setSubject(re);
        setBody(
          `Hello ${firstName(d.fullName)},\n\nThank you for contacting Blue World Cosmetics.\n\n\n\nKind regards,\n${
            session?.fullName ?? "The Blue World team"
          }\nBlue World Cosmetics`,
        );
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        if (!(err instanceof ApiError && err.status === 404)) {
          toast.error("Could not load this message.", { description: apiErrorDetail(err, "Please try again.") });
        }
        setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
    // session is read once for the signature; messageId is the only real dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  async function send() {
    if (!detail || sending) return;
    if (subject.trim().length < 2) return void toast.error("Add a subject first.");
    if (body.trim().length < 2) return void toast.error("Write your reply first.");
    setSending(true);
    try {
      await apiFetch(
        `${ENDPOINTS.adminContactMessages}/${detail.id}/reply`,
        { method: "POST", body: JSON.stringify({ subject: subject.trim(), body: body.trim(), fromEmail: fromEmail.trim() || null }) },
        30_000,
      );
      toast.success(`Reply sent to ${detail.fullName}`, { description: `Delivered to ${detail.email}` });
      await navigate({ to: "/admin/inbox" });
    } catch (err) {
      // Keep the draft on screen so nothing they typed is lost.
      toast.error("Reply not sent", { description: apiErrorDetail(err, "Something went wrong. Your draft is still here.") });
    } finally {
      setSending(false);
    }
  }

  return (
    <AdminShell
      title={detail ? `Reply to ${detail.fullName}` : "Reply"}
      description="Your reply is sent from the official BlueWorld email address."
      actions={
        <Link
          to="/admin/inbox"
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-primary-soft"
        >
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to inbox</span>
        </Link>
      }
    >
      {state === "loading" && <p className="py-20 text-center text-sm text-muted-foreground">Loading message…</p>}

      {state === "missing" && (
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-card">
          <p className="font-display text-lg font-bold text-primary-deep">Message not found</p>
          <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
          <Link
            to="/admin/inbox"
            className="mt-6 inline-flex rounded-full bg-primary-deep px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Back to inbox
          </Link>
        </div>
      )}

      {state === "ready" && detail && (
        <div className="grid gap-6 lg:grid-cols-[1fr_390px]">
          {/* ------------------------------ composer ------------------------------ */}
          <section className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-display text-lg font-bold text-primary-deep">New reply</h2>
            </div>

            <div className="space-y-5 p-6">
              {!canSend && (
                <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary p-4 text-sm text-muted-foreground">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  Your role is view-only, so you can read this message but not send replies.
                </div>
              )}

              <SenderField value={fromEmail} onChange={setFromEmail} disabled={!canSend || sending} preferred={detail.mailbox} />

              <dl className="divide-y divide-border rounded-xl border border-border bg-secondary/50 px-4 text-sm">
                <div className="grid grid-cols-[70px_1fr] gap-3 py-2.5">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">To</dt>
                  <dd className="min-w-0 break-words text-foreground">
                    <span className="font-semibold">{detail.fullName}</span>{" "}
                    <span className="text-muted-foreground">&lt;{detail.email}&gt;</span>
                  </dd>
                </div>
              </dl>

              <div>
                <label htmlFor="subject" className="text-sm font-semibold text-primary-deep">
                  Subject
                </label>
                <input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  disabled={!canSend || sending}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="body" className="text-sm font-semibold text-primary-deep">
                  Message
                </label>
                <textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  maxLength={BODY_MAX}
                  disabled={!canSend || sending}
                  className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-primary disabled:opacity-60"
                />
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Their original message is quoted automatically underneath your reply.</span>
                  <span>
                    {body.length}/{BODY_MAX}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!canSend || sending}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-bold text-accent-foreground shadow-card transition-transform hover:-translate-y-0.5",
                    (!canSend || sending) && "pointer-events-none opacity-60",
                  )}
                >
                  <Send className="h-4 w-4" />
                  {sending ? "Sending…" : "Send mail"}
                </button>
                <Link
                  to="/admin/inbox"
                  className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground/75 transition-colors hover:bg-primary-soft"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </section>

          {/* ---------------------------- original message ---------------------------- */}
          <aside className="space-y-5 self-start rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-primary-deep">Original message</h2>
              <StatusBadge status={detail.status} />
            </div>
            <SubmittedDetails message={detail} />
            <MessageBubble>{detail.message}</MessageBubble>

            {detail.replies.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">Conversation so far</h3>
                <div className="space-y-3">
                  {detail.replies.map((r) => (
                    <div key={r.id}>
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        {r.direction === "in"
                          ? `${detail.fullName} replied by email`
                          : `${r.sentBy ?? "Team"}${r.fromEmail ? ` (from ${r.fromEmail})` : ""}`}{" "}
                        · {fullWhen(r.sentAt)}
                      </p>
                      <MessageBubble tone={r.direction === "in" ? "customer" : "team"}>{r.body}</MessageBubble>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </AdminShell>
  );
}