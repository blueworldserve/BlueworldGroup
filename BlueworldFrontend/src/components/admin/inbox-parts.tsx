import type { ReactNode } from "react";
import { CheckCheck } from "lucide-react";
import type { InboxMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" });

/** "3:42 pm" for today, "12 Oct 2026" otherwise, used in the message list. */
export function shortWhen(iso: string): string {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? timeFmt.format(d) : dateFmt.format(d);
}

/** "12 Oct 2026 · 3:42 pm", used in the reading pane. */
export function fullWhen(iso: string): string {
  const d = new Date(iso);
  return `${dateFmt.format(d)} · ${timeFmt.format(d)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-primary-deep">
      {type}
    </span>
  );
}

export function StatusBadge({ status }: { status: InboxMessage["status"] }) {
  if (status === "new") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> New
      </span>
    );
  }
  if (status === "replied") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">
        <CheckCheck className="h-3 w-3" /> Replied
      </span>
    );
  }
  return (
    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
      Read
    </span>
  );
}

/** One labelled row of the "Submitted details" card (mirrors the fields on the public contact form). */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2.5 text-sm">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

/** The customer's form inputs, laid out exactly as they filled them in. */
export function SubmittedDetails({ message }: { message: InboxMessage }) {
  return (
    <dl className="divide-y divide-border rounded-xl border border-border bg-secondary/50 px-4">
      <DetailRow label="Full name">{message.fullName}</DetailRow>
      <DetailRow label="Email">
        <a href={`mailto:${message.email}`} className="text-primary-deep underline-offset-2 hover:underline">
          {message.email}
        </a>
      </DetailRow>
      <DetailRow label="Phone">
        {message.phone ? (
          <a href={`tel:${message.phone}`} className="text-primary-deep underline-offset-2 hover:underline">
            {message.phone}
          </a>
        ) : (
          <span className="text-muted-foreground">Not provided</span>
        )}
      </DetailRow>
      <DetailRow label="Enquiry type">
        <TypeBadge type={message.enquiryType} />
      </DetailRow>
      <DetailRow label="Subject">{message.subject}</DetailRow>
      <DetailRow label="Received">{fullWhen(message.createdAt)}</DetailRow>
    </dl>
  );
}

export function MessageBubble({ children, tone = "customer" }: { children: ReactNode; tone?: "customer" | "team" }) {
  return (
    <div
      className={cn(
        "whitespace-pre-wrap break-words rounded-2xl border px-5 py-4 text-sm leading-relaxed",
        tone === "customer"
          ? "border-border bg-card text-foreground"
          : "border-primary-deep/15 bg-primary-soft text-primary-deep",
      )}
    >
      {children}
    </div>
  );
}