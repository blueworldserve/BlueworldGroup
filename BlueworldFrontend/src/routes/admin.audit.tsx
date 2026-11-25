import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [{ title: "Audit Log | Blueworld CMS" }, { name: "robots", content: "noindex" }],
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
const PAGE = 25;

type Range = "today" | "7d" | "30d" | "all" | "custom";
const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Pick dates" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Turns the chosen time frame into the since/until the server filters on (local midnight → local midnight).
function bounds(range: Range, from: string, to: string): { since?: string | undefined; until?: string | undefined } {
  const today = startOfDay(new Date());
  if (range === "today") return { since: today.toISOString() };
  if (range === "7d") return { since: addDays(today, -6).toISOString() };
  if (range === "30d") return { since: addDays(today, -29).toISOString() };
  if (range === "custom") {
    return {
      since: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      until: to ? addDays(new Date(`${to}T00:00:00`), 1).toISOString() : undefined,
    };
  }
  return {};
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function dayTitle(key: string) {
  const today = startOfDay(new Date());
  if (key === dayKey(today.toISOString())) return "Today";
  if (key === dayKey(addDays(today, -1).toISOString())) return "Yesterday";
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function AuditPage() {
  const me = useMe();
  const allowed = !!me && (me.role === "admin" || me.isSuperuser);
  const [tab, setTab] = useState<"critical" | "activity">("critical");
  const [range, setRange] = useState<Range>("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({ category: tab, limit: String(PAGE), offset: String(offset) });
        if (q) params.set("q", q);
        const { since, until } = bounds(range, from, to);
        if (since) params.set("since", since);
        if (until) params.set("until", until);
        const data = (await apiFetch(`/admin/audit?${params}`)) as { items: Entry[]; total: number };
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, tab, q, offset, range, from, to]);

  // Entries grouped under their day (the server already sends them newest first).
  const days = useMemo(() => {
    const out: { key: string; entries: Entry[] }[] = [];
    for (const e of items) {
      const key = dayKey(e.createdAt);
      const last = out[out.length - 1];
      if (last && last.key === key) last.entries.push(e);
      else out.push({ key, entries: [e] });
    }
    return out;
  }, [items]);

  if (me && !allowed) {
    return (
      <AdminShell title="Audit Log" description="Admins only.">
        <p className="rounded-2xl border border-border bg-card p-6 text-sm">You don't have access to this section.</p>
      </AdminShell>
    );
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
      active ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border hover:bg-primary-soft",
    );

  return (
    <AdminShell title="Audit Log" description="Every sign-in, sign-out, access change and edit, grouped by day with the newest first.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["critical", "activity"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setOffset(0);
            }}
            className={chip(tab === t)}
          >
            {t === "critical" ? "Critical logs" : "Activity logs"}
          </button>
        ))}
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search person, action or section…"
          className="min-w-[220px] flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm"
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-bold uppercase tracking-[0.14em] text-accent">Time frame</span>
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => {
              setRange(r.key);
              setOffset(0);
            }}
            className={cn(chip(range === r.key), "px-3 py-1.5 text-xs")}
          >
            {r.label}
          </button>
        ))}
        {range === "custom" && (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setOffset(0);
              }}
              aria-label="From date"
              className="rounded-lg border border-border bg-background px-3 py-1.5"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setOffset(0);
              }}
              aria-label="To date"
              className="rounded-lg border border-border bg-background px-3 py-1.5"
            />
          </span>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-destructive">Could not load the audit log.</p>}

      <p className="mb-3 text-sm text-muted-foreground">
        {loading ? "Loading…" : `${total} ${total === 1 ? "entry" : "entries"} in this time frame`}
      </p>

      {!loading && items.length === 0 && !error && (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">Nothing was recorded in this time frame.</p>
      )}

      <div className={cn("space-y-5 transition-opacity", loading && "opacity-60")}>
        {days.map((day) => (
          <section key={day.key}>
            <h3 className="mb-2 flex items-center gap-3 text-sm font-bold text-primary-deep">
              {dayTitle(day.key)}
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-deep">{day.entries.length}</span>
              <span className="h-px flex-1 bg-border" />
            </h3>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {day.entries.map((e) => (
                <div key={e.id} className="text-sm">
                  <button
                    type="button"
                    className="flex w-full items-start gap-4 px-4 py-3 text-left hover:bg-primary-soft/50"
                    onClick={() => setOpen(open === e.id ? null : e.id)}
                  >
                    <span className="w-12 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{timeOf(e.createdAt)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{e.summary}</span>
                      <span className="mt-0.5 block truncate text-xs text-foreground/60">
                        {e.actorEmail ?? "unknown"} ({e.actorRole ?? "-"}) · {e.action}
                        {e.resource ? ` · ${e.resource}` : ""}
                      </span>
                    </span>
                  </button>
                  {open === e.id && (
                    <div className="space-y-2 bg-primary-soft/40 px-4 pb-4 pl-[4.5rem] text-xs text-foreground/70">
                      <p>
                        {new Date(e.createdAt).toLocaleString()} · IP {e.ip ?? "-"}
                      </p>
                      {e.details && (
                        <pre className="max-h-64 overflow-auto rounded-lg bg-background p-3">{JSON.stringify(e.details, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between text-sm">
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