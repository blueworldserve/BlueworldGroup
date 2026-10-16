import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [{ title: "Audit Log — Blue World CMS" }, { name: "robots", content: "noindex" }],
  }),
  component: AuditPage,
});

interface Entry {
  id: string;
  createdAt: string;
  category: "critical" | "activity";
  action: string;
  resource: string | null;
  summary: string;
  actorEmail: string | null;
  actorRole: string | null;
  ip: string | null;
  details: Record<string, unknown> | null;
}

const PAGE = 50;

function AuditPage() {
  const me = useMe();
  const [tab, setTab] = useState<"critical" | "activity">("critical");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ category: tab, limit: String(PAGE), offset: String(offset) });
      if (q.trim()) params.set("q", q.trim());
      const data = (await apiFetch(`/admin/audit?${params}`)) as { items: Entry[]; total: number };
      setItems(data.items);
      setTotal(data.total);
      setError(false);
    } catch {
      setError(true);
    }
  }, [tab, q, offset]);

  useEffect(() => {
    if (me && (me.role === "admin" || me.isSuperuser)) void load();
  }, [me, load]);

  if (me && me.role !== "admin" && !me.isSuperuser) {
    return (
      <AdminShell title="Audit Log" description="Admins only.">
        <p className="rounded-2xl border border-border bg-card p-6 text-sm">You don't have access to this section.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Audit Log" description="Every sign-in, sign-out, access change and edit — newest first.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {(["critical", "activity"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setOffset(0);
            }}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold",
              tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-primary-soft",
            )}
          >
            {t === "critical" ? "Critical logs" : "Activity logs"}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
          placeholder="Search person, action or section…"
          className="min-w-[220px] flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm"
        />
      </div>

      {error && <p className="mb-3 text-sm text-destructive">Could not load the audit log.</p>}

      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {items.length === 0 && <p className="p-6 text-sm text-foreground/60">Nothing recorded yet.</p>}
        {items.map((e) => (
          <div key={e.id} className="p-4 text-sm">
            <button type="button" className="w-full text-left" onClick={() => setOpen(open === e.id ? null : e.id)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{e.summary}</span>
                <span className="text-xs text-foreground/60">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-xs text-foreground/60">
                {e.action} · {e.actorEmail ?? "unknown"} ({e.actorRole ?? "—"}) · {e.ip ?? "—"}
              </div>
            </button>
            {open === e.id && e.details && (
              <pre className="mt-3 overflow-x-auto rounded-lg bg-primary-soft p-3 text-xs">{JSON.stringify(e.details, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span>
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE, total)} of {total}
        </span>
        <div className="flex gap-2">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} className="rounded-full border border-border px-4 py-2 disabled:opacity-40">
            Previous
          </button>
          <button disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)} className="rounded-full border border-border px-4 py-2 disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
    </AdminShell>
  );
}