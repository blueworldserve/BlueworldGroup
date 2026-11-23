import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [{ title: "Analytics | Blueworld CMS" }, { name: "robots", content: "noindex" }],
  }),
  component: AnalyticsPage,
});

interface NameCount {
  name: string;
  count: number;
}
interface Summary {
  totals: {
    visitors: number;
    returningVisitors: number;
    sessions: number;
    pageviews: number;
    clicks: number;
    avgSecondsOnPage: number;
    pagesPerSession: number;
  };
  daily: { date: string; visitors: number; pageviews: number }[];
  topPages: { path: string; views: number; visitors: number; avgSeconds: number; avgScroll: number }[];
  topClicks: { label: string; target: string | null; section: string | null; clicks: number; visitors: number }[];
  sections: NameCount[];
  referrers: NameCount[];
  devices: NameCount[];
  countries: NameCount[];
  hours: number[];
  conversions: { contactMessages: number; newsletterSignups: number; jobApplications: number };
}

type Range = "today" | "7d" | "30d" | "90d";
const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
function sinceFor(range: Range): string {
  const today = startOfDay(new Date());
  const back = range === "today" ? 0 : range === "7d" ? 6 : range === "30d" ? 29 : 89;
  return addDays(today, -back).toISOString();
}

const fmtDuration = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** "/business/vivon" -> "Business · Vivon", "/" -> "Home" */
function prettyPath(path: string): string {
  if (path === "/") return "Home";
  return path
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()))
    .join(" · ");
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const eyebrow = "text-xs font-bold uppercase tracking-[0.14em] text-accent";
const card = "rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6";

function StatCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className={card}>
      <p className={cn(eyebrow, "break-words")}>{label}</p>
      <p className="mt-3 font-display text-3xl font-extrabold text-primary-deep sm:text-4xl">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** A ranked list where each row has a bar behind it showing its share of the top row. */
function BarList({
  rows,
  empty,
}: {
  rows: { key: string; title: string; sub?: string | undefined; value: number; valueLabel?: string | undefined }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="relative overflow-hidden rounded-xl bg-secondary/60">
          <div className="absolute inset-y-0 left-0 bg-primary-soft" style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }} />
          <div className="relative flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-primary-deep">{r.title}</span>
              {r.sub && <span className="block truncate text-xs text-foreground/60">{r.sub}</span>}
            </span>
            <span className="shrink-0 font-bold tabular-nums text-primary-deep">{r.valueLabel ?? r.value}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AnalyticsPage() {
  const [range, setRange] = useState<Range>("7d");
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Phones have no hover, so a tap on a bar shows its numbers in a line above the chart.
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const [pickedHour, setPickedHour] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPickedDay(null);
    setPickedHour(null);
    void (async () => {
      try {
        const params = new URLSearchParams({ since: sinceFor(range) });
        const result = await apiFetch<Summary>(`/admin/analytics/summary?${params}`, {}, 15_000);
        if (cancelled) return;
        setData(result);
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
  }, [range]);

  const chartMax = useMemo(() => Math.max(1, ...(data?.daily ?? []).map((d) => d.pageviews)), [data]);
  const hourMax = useMemo(() => Math.max(1, ...(data?.hours ?? [])), [data]);

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:py-2 sm:text-sm",
      active ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border hover:bg-primary-soft",
    );

  const t = data?.totals;
  const noVisits = !!t && t.pageviews === 0;
  const first = data?.daily[0];
  const last = data?.daily[data.daily.length - 1];

  return (
    <AdminShell title="Analytics" description="Who visits the website, what they look at and what they click. Anonymous: no names, emails or IP addresses are stored.">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className={cn(eyebrow, "mr-1")}>Time frame</span>
        {RANGES.map((r) => (
          <button key={r.key} type="button" onClick={() => setRange(r.key)} className={chip(range === r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-2xl border border-border bg-card p-4 text-sm text-destructive">Could not load the analytics. Check your connection and try again.</p>}

      {!data && loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && t && (
        <div className={cn("space-y-5 transition-opacity sm:space-y-6", loading && "opacity-60")}>
          {noVisits && (
            <p className={cn(card, "text-sm text-foreground/70")}>
              No visits recorded in this time frame yet. Visits appear here a few seconds after someone opens the public site.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
            <StatCard label="Visitors" value={t.visitors} note={`${t.returningVisitors} came back`} />
            <StatCard label="Page views" value={t.pageviews} note={`${t.pagesPerSession} pages per visit`} />
            <StatCard label="Clicks" value={t.clicks} note={`${t.sessions} visits`} />
            <StatCard label="Time on a page" value={fmtDuration(t.avgSecondsOnPage)} note="average" />
          </div>

          <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-3 sm:gap-5">
            <StatCard label="Messages" value={data.conversions.contactMessages} note="contact form" />
            <StatCard label="Subscribers" value={data.conversions.newsletterSignups} note="newsletter" />
            <StatCard label="Applications" value={data.conversions.jobApplications} note="careers" />
          </div>

          <section className={card}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className={eyebrow}>Visitors per day</h2>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary-deep/25" />Page views</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary-deep" />Visitors</span>
              </span>
            </div>
            <p className="mb-2 min-h-5 text-xs font-semibold text-primary-deep">
              {pickedDay !== null && data.daily[pickedDay]
                ? `${fmtDay(data.daily[pickedDay].date)}: ${data.daily[pickedDay].visitors} visitors, ${data.daily[pickedDay].pageviews} page views`
                : <span className="font-normal text-muted-foreground">Tap a bar to see that day.</span>}
            </p>
            <div className="overflow-x-auto pb-1">
              <div className="flex h-40 items-end gap-px sm:gap-1" style={{ minWidth: `${data.daily.length * 10}px` }}>
                {data.daily.map((d, i) => (
                  <button
                    key={d.date}
                    type="button"
                    aria-label={`${fmtDay(d.date)}: ${d.visitors} visitors, ${d.pageviews} page views`}
                    onClick={() => setPickedDay(i)}
                    title={`${fmtDay(d.date)}: ${d.visitors} visitors, ${d.pageviews} page views`}
                    className={cn("relative flex h-full min-w-0 flex-1 items-end rounded-sm", pickedDay === i && "ring-2 ring-accent")}
                  >
                    <div className="w-full rounded-t-sm bg-primary-deep/25" style={{ height: `${(d.pageviews / chartMax) * 100}%` }} />
                    <div className="absolute inset-x-0 bottom-0 rounded-t-sm bg-primary-deep" style={{ height: `${(Math.min(d.visitors, d.pageviews || d.visitors) / chartMax) * 100}%` }} />
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{first ? fmtDay(first.date) : ""}</span>
              <span>{last ? fmtDay(last.date) : ""}</span>
            </div>
          </section>

          <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
            <section className={card}>
              <h2 className={cn(eyebrow, "mb-4")}>Most viewed pages</h2>
              <BarList
                empty="No page views yet."
                rows={data.topPages.map((p) => ({
                  key: p.path,
                  title: prettyPath(p.path),
                  sub: p.avgSeconds > 0 ? `${fmtDuration(p.avgSeconds)} on page · ${p.avgScroll}% scrolled` : p.path,
                  value: p.views,
                }))}
              />
            </section>

            <section className={card}>
              <h2 className={cn(eyebrow, "mb-4")}>What they click most</h2>
              <BarList
                empty="No clicks yet."
                rows={data.topClicks.map((c, i) => ({
                  key: `${c.label}|${c.target ?? ""}|${c.section ?? ""}|${i}`,
                  title: c.label,
                  sub: [c.section, c.target ? `→ ${c.target}` : null].filter(Boolean).join(" · ") || undefined,
                  value: c.clicks,
                }))}
              />
            </section>

            <section className={card}>
              <h2 className={cn(eyebrow, "mb-4")}>What they're interested in</h2>
              <BarList empty="Nothing yet." rows={data.sections.map((s) => ({ key: s.name, title: prettyPath(`/${s.name === "home" ? "" : s.name}`), value: s.count }))} />
            </section>

            <section className={card}>
              <h2 className={cn(eyebrow, "mb-4")}>Where they come from</h2>
              <BarList empty="Most visitors typed the address or used a bookmark, so no referring site was recorded." rows={data.referrers.map((r) => ({ key: r.name, title: r.name, value: r.count }))} />
            </section>

            <section className={card}>
              <h2 className={cn(eyebrow, "mb-4")}>Devices</h2>
              <BarList empty="Nothing yet." rows={data.devices.map((d) => ({ key: d.name, title: d.name.replace(/^\w/, (c) => c.toUpperCase()), value: d.count }))} />
            </section>

            <section className={card}>
              <h2 className={cn(eyebrow, "mb-4")}>Countries</h2>
              <BarList empty="Country isn't available unless the API sits behind Cloudflare (or similar)." rows={data.countries.map((c) => ({ key: c.name, title: countryName(c.name), value: c.count }))} />
            </section>
          </div>

          <section className={card}>
            <h2 className={cn(eyebrow, "mb-4")}>Busiest hours (Lagos time)</h2>
            <p className="mb-2 min-h-5 text-xs font-semibold text-primary-deep">
              {pickedHour !== null
                ? `${String(pickedHour).padStart(2, "0")}:00: ${data.hours[pickedHour] ?? 0} page views`
                : <span className="font-normal text-muted-foreground">Tap a bar to see that hour.</span>}
            </p>
            <div className="flex h-24 items-end gap-px sm:gap-1">
              {data.hours.map((n, h) => (
                <button
                  key={h}
                  type="button"
                  aria-label={`${String(h).padStart(2, "0")}:00, ${n} page views`}
                  onClick={() => setPickedHour(h)}
                  title={`${String(h).padStart(2, "0")}:00 · ${n} page views`}
                  className={cn("flex h-full min-w-0 flex-1 items-end rounded-sm", pickedHour === h && "ring-2 ring-accent")}
                >
                  <div className="w-full rounded-t-sm bg-accent" style={{ height: `${(n / hourMax) * 100}%`, minHeight: n > 0 ? 2 : 0 }} />
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>12am</span>
              <span>6am</span>
              <span>12pm</span>
              <span>6pm</span>
              <span>11pm</span>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}