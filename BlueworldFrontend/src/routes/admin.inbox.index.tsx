import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Inbox as InboxIcon,
  Mail,
  MailOpen,
  RefreshCw,
  Reply,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import {
  MessageBubble,
  StatusBadge,
  SubmittedDetails,
  TypeBadge,
  fullWhen,
  initials,
  shortWhen,
} from "@/components/admin/inbox-parts";
import { getAdminUser } from "@/hooks/use-admin-auth";
import { apiErrorDetail, apiFetch, ENDPOINTS } from "@/lib/api";
import type { InboxMessage, InboxMessageDetail, MailboxStatus, NewsletterSubscriber } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/inbox/")({
  head: () => ({
    meta: [
      { title: "Inbox — Blue World CMS" },
      { name: "description", content: "Contact messages and newsletter signups." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InboxPage,
});

type Tab = "messages" | "newsletter";
type Filter = "all" | "unread" | "replied";

function canManage(): boolean {
  const u = getAdminUser();
  return !!u && (u.role === "admin" || u.role === "editor" || u.isSuperuser === true);
}

function InboxPage() {
  const manage = canManage();

  const [tab, setTab] = useState<Tab>("messages");
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [detail, setDetail] = useState<InboxMessageDetail | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mailboxes, setMailboxes] = useState<MailboxStatus[]>([]);
  const [checkingMail, setCheckingMail] = useState(false);

  const loadMailboxes = useCallback(async () => {
    try {
      setMailboxes(await apiFetch<MailboxStatus[]>(ENDPOINTS.adminMailboxStatus));
    } catch {
      /* the banner is optional: the inbox still works without it */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        apiFetch<InboxMessage[]>(ENDPOINTS.adminContactMessages),
        apiFetch<NewsletterSubscriber[]>(ENDPOINTS.adminNewsletter),
      ]);
      setMessages(m);
      setSubscribers(s);
      void loadMailboxes();
    } catch (err) {
      toast.error("Could not load the inbox.", { description: apiErrorDetail(err, "Check that the API is running.") });
    } finally {
      setLoading(false);
    }
  }, [loadMailboxes]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reads the mailboxes (sales@, the Gmail test inbox…) right now instead of waiting for the automatic check.
  async function checkMail() {
    setCheckingMail(true);
    try {
      const r = await apiFetch<{ new: number; errors?: string[] }>(
        ENDPOINTS.adminMailboxCheck,
        { method: "POST" },
        60_000,
      );
      toast.success(r.new ? `${r.new} new email${r.new === 1 ? "" : "s"}` : "No new emails", {
        description: r.errors?.length ? r.errors.join(" ") : undefined,
      });
      await load();
    } catch (err) {
      toast.error("Could not read the mailbox", { description: apiErrorDetail(err, "Please try again.") });
      void loadMailboxes();
    } finally {
      setCheckingMail(false);
    }
  }

  const unreadCount = messages.filter((m) => m.status === "new").length;
  const pendingSync = subscribers.filter((s) => !s.syncedAt).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      if (filter === "unread" && m.status !== "new") return false;
      if (filter === "replied" && m.status !== "replied") return false;
      if (!q) return true;
      return [m.fullName, m.email, m.subject ?? "", m.message, m.enquiryType].some((v) =>
        v.toLowerCase().includes(q),
      );
    });
  }, [messages, filter, query]);

  async function openMessage(id: string) {
    selectedRef.current = id;
    setSelectedId(id);
    setDetail(null);
    try {
      const d = await apiFetch<InboxMessageDetail>(`${ENDPOINTS.adminContactMessages}/${id}`);
      if (selectedRef.current !== id) return; // user already clicked another message
      setDetail(d);
      if (d.status === "new" && manage) {
        const updated = await apiFetch<InboxMessage>(`${ENDPOINTS.adminContactMessages}/${id}/read`, {
          method: "POST",
        });
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: updated.status } : m)));
        if (selectedRef.current === id) setDetail({ ...d, status: updated.status });
      }
    } catch (err) {
      toast.error("Could not open this message.", { description: apiErrorDetail(err, "Please try again.") });
    }
  }

  function closeMessage() {
    selectedRef.current = null;
    setSelectedId(null);
    setDetail(null);
  }

  async function deleteSelected() {
    if (!detail) return;
    try {
      await apiFetch(`${ENDPOINTS.adminContactMessages}/${detail.id}`, { method: "DELETE" });
      setMessages((prev) => prev.filter((m) => m.id !== detail.id));
      closeMessage();
      toast.success("Message deleted");
    } catch (err) {
      toast.error("Could not delete this message.", { description: apiErrorDetail(err, "Please try again.") });
    } finally {
      setConfirmDelete(false);
    }
  }

  async function syncNewsletter() {
    setSyncing(true);
    try {
      const r = await apiFetch<{ synced: number; failed: number; remaining: number; error?: string | null }>(
        `${ENDPOINTS.adminNewsletter}/sync`,
        { method: "POST" },
        120_000, // up to 50 contacts, paced to respect Resend's rate limit
      );
      if (r.synced === 0 && r.failed > 0) {
        toast.error("Resend rejected the sync", { description: r.error ?? "Check RESEND_API_KEY (it needs full access) and the segment / audience id." });
        return;
      }
      toast.success(`Synced ${r.synced} subscriber${r.synced === 1 ? "" : "s"} to Resend`, {
        description:
          r.failed || r.remaining
            ? `${r.failed} failed · ${r.remaining} still waiting. Press sync again to continue.`
            : "Everyone is on your Resend list.",
      });
      await load();
    } catch (err) {
      toast.error("Sync failed", { description: apiErrorDetail(err, "Please try again.") });
    } finally {
      setSyncing(false);
    }
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      "email,subscribed_at,synced_to_resend",
      ...subscribers.map((s) => [esc(s.email), esc(s.createdAt), s.syncedAt ? "yes" : "no"].join(",")),
    ];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell
      title="Inbox"
      description="Messages from the contact form and newsletter signups."
      actions={
        <div className="flex items-center gap-2">
          {manage && mailboxes.length > 0 && (
            <button
              type="button"
              onClick={() => void checkMail()}
              disabled={checkingMail}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-primary-soft disabled:opacity-60"
            >
              <Mail className={cn("h-4 w-4", checkingMail && "animate-pulse")} />
              <span className="hidden sm:inline">{checkingMail ? "Checking…" : "Check mail"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-primary-soft disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      }
    >
      {/* A mailbox the server cannot log in to: shows the reason right here instead of only in the server logs. */}
      {mailboxes.filter((m) => !m.ok).map((m) => (
        <div
          key={m.address}
          role="alert"
          className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-semibold">Can’t read {m.address}</p>
          <p className="mt-1 break-words text-destructive/90">{m.lastError}</p>
        </div>
      ))}
      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        <TabButton active={tab === "messages"} onClick={() => setTab("messages")} icon={<Mail className="h-4 w-4" />}>
          Messages
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-foreground">
              {unreadCount}
            </span>
          )}
        </TabButton>
        <TabButton
          active={tab === "newsletter"}
          onClick={() => setTab("newsletter")}
          icon={<InboxIcon className="h-4 w-4" />}
        >
          Newsletter
          <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-bold text-muted-foreground">
            {subscribers.length}
          </span>
        </TabButton>
      </div>

      {tab === "messages" ? (
        <div className="grid gap-5 lg:h-[calc(100vh-13rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(320px,400px)_1fr]">
          {/* ---------------------------- message list ---------------------------- */}
          <section
            className={cn(
              "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card",
              selectedId && "hidden lg:flex",
            )}
          >
            <div className="space-y-3 border-b border-border p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, subject…"
                  aria-label="Search messages"
                  className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
              <div className="flex gap-2">
                {(
                  [
                    ["all", `All (${messages.length})`],
                    ["unread", `Unread (${unreadCount})`],
                    ["replied", "Replied"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
                      filter === key
                        ? "border-primary-deep bg-primary-deep text-primary-foreground"
                        : "border-border text-foreground/70 hover:bg-primary-soft",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
              {loading && messages.length === 0 && (
                <li className="p-8 text-center text-sm text-muted-foreground">Loading messages…</li>
              )}
              {!loading && messages.length === 0 && (
                <li className="p-8 text-center text-sm text-muted-foreground">
                  No messages yet. They'll appear here as soon as someone uses the contact form.
                </li>
              )}
              {!loading && messages.length > 0 && filtered.length === 0 && (
                <li className="p-8 text-center text-sm text-muted-foreground">Nothing matches your search.</li>
              )}
              {filtered.map((m) => {
                const isNew = m.status === "new";
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => void openMessage(m.id)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-primary-soft/60",
                        selectedId === m.id && "bg-primary-soft",
                      )}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-deep text-xs font-bold text-primary-foreground">
                        {initials(m.fullName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-sm",
                              isNew ? "font-bold text-primary-deep" : "font-semibold text-foreground/80",
                            )}
                          >
                            {m.fullName}
                          </span>
                          <span className="shrink-0 text-[0.7rem] text-muted-foreground">{shortWhen(m.createdAt)}</span>
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block truncate text-sm",
                            isNew ? "font-semibold text-primary-deep" : "text-foreground/80",
                          )}
                        >
                          {m.subject}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{m.message}</span>
                        <span className="mt-2 flex items-center gap-2">
                          <TypeBadge type={m.enquiryType} />
                          {m.status !== "read" && <StatusBadge status={m.status} />}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ---------------------------- reading pane ---------------------------- */}
          <section
            className={cn(
              "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card",
              !selectedId && "hidden lg:flex",
            )}
          >
            {!selectedId ? (
              <div className="grid flex-1 place-items-center p-10 text-center">
                <div>
                  <MailOpen className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-4 font-display text-lg font-bold text-primary-deep">Select a message</p>
                  <p className="mt-1 text-sm text-muted-foreground">Pick one from the list to read it and reply.</p>
                </div>
              </div>
            ) : !detail ? (
              <div className="grid flex-1 place-items-center p-10 text-sm text-muted-foreground">Opening message…</div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <button
                    type="button"
                    onClick={closeMessage}
                    className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary-deep lg:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to inbox
                  </button>

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="font-display text-2xl font-bold leading-tight text-primary-deep">{detail.subject}</h2>
                    <StatusBadge status={detail.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {detail.fullName} · {fullWhen(detail.createdAt)}
                  </p>

                  <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-[0.16em] text-accent">
                    Submitted details
                  </h3>
                  <SubmittedDetails message={detail} />

                  <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-[0.16em] text-accent">Message</h3>
                  <MessageBubble>{detail.message}</MessageBubble>

                  {detail.replies.length > 0 && (
                    <>
                      <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-[0.16em] text-accent">
                        Conversation
                      </h3>
                      <div className="space-y-3">
                        {detail.replies.map((r) => (
                          <div key={r.id}>
                            <p className="mb-1.5 text-xs text-muted-foreground">
                              {r.direction === "in" ? `${detail.fullName} replied by email` : (r.sentBy ?? "Team")} ·{" "}
                              {fullWhen(r.sentAt)} · “{r.subject}”
                            </p>
                            <MessageBubble tone={r.direction === "in" ? "customer" : "team"}>{r.body}</MessageBubble>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* action bar */}
                <div className="flex flex-wrap items-center gap-3 border-t border-border bg-card px-6 py-4">
                  {manage ? (
                    <Link
                      to="/admin/inbox/$messageId/reply"
                      params={{ messageId: detail.id }}
                      className="inline-flex max-w-full items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground shadow-card transition-transform hover:-translate-y-0.5"
                    >
                      <Reply className="h-4 w-4 shrink-0" />
                      <span className="truncate">Respond to {detail.fullName}</span>
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Your role is view-only, so replying is disabled.</span>
                  )}
                  <a
                    href={`mailto:${detail.email}?subject=${encodeURIComponent(`Re: ${detail.subject ?? ""}`)}`}
                    className="text-sm font-semibold text-primary-deep underline-offset-2 hover:underline"
                  >
                    Open in mail app
                  </a>
                  {manage && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        /* ------------------------------ newsletter tab ------------------------------ */
        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="font-display text-lg font-bold text-primary-deep">Newsletter subscribers</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {subscribers.length} total · {pendingSync} waiting to sync to Resend
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportCsv}
                disabled={subscribers.length === 0}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-primary-soft disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              {manage && (
                <button
                  type="button"
                  onClick={() => void syncNewsletter()}
                  disabled={syncing || pendingSync === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-primary-deep px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <UploadCloud className="h-4 w-4" /> {syncing ? "Syncing…" : "Sync to Resend"}
                </button>
              )}
            </div>
          </div>
          {subscribers.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {loading ? "Loading…" : "No subscribers yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-bold">Email</th>
                    <th className="px-5 py-3 font-bold">Subscribed</th>
                    <th className="px-5 py-3 font-bold">Resend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subscribers.map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3 font-semibold text-primary-deep">{s.email}</td>
                      <td className="px-5 py-3 text-muted-foreground">{fullWhen(s.createdAt)}</td>
                      <td className="px-5 py-3">
                        {s.syncedAt ? (
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">
                            Synced
                          </span>
                        ) : (
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <ConfirmDeleteDialog
        open={confirmDelete}
        title="Delete this message?"
        itemLabel={detail ? `${detail.fullName} — ${detail.subject ?? ""}` : "this message"}
        onConfirm={() => void deleteSelected()}
        onCancel={() => setConfirmDelete(false)}
      />
    </AdminShell>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition-colors",
        active
          ? "border-primary-deep bg-primary-deep text-primary-foreground"
          : "border-border bg-card text-foreground/70 hover:bg-primary-soft",
      )}
    >
      {icon}
      {children}
    </button>
  );
}