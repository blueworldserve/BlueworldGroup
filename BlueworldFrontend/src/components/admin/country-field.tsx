import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, MapPin, Search, TriangleAlert } from "lucide-react";
import { findCountry, searchCountries } from "@/data/countries";
import { useCollection } from "@/lib/cms-store";
import { cn } from "@/lib/utils";

/**
 * Searchable country picker. You can only choose a real country from the list,
 * so the name is always spelled right, and its position on the globe is looked
 * up automatically — there's nothing to type and nothing to get wrong.
 */
export function CountryField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (name: string) => void;
}) {
  const showcases = useCollection("countryShowcases");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const current = findCountry(value);
  const taken = useMemo(() => {
    const names = new Set<string>();
    for (const s of showcases) {
      const c = findCountry(s.name);
      if (c) names.add(c.name);
    }
    return names;
  }, [showcases]);

  const results = useMemo(() => searchCountries(query), [query]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(name: string) {
    onChange(name);
    setOpen(false);
    setQuery("");
  }

  function isTaken(name: string) {
    return taken.has(name) && name !== current?.name;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the form from the search box
      const pick = results[highlight];
      if (pick && !isTaken(pick.name)) choose(pick.name);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative mt-2 max-w-md">
      <button
        id={id}
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setHighlight(0);
        }}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left text-sm outline-none focus:border-primary"
      >
        <span className={cn(!value && "text-muted-foreground")}>{value || "Search and pick a country…"}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lift">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 opacity-60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Type a country, e.g. Ghana…"
              className="h-11 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
            {results.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No country matches “{query}”.</li>
            )}
            {results.map((c, i) => {
              const used = isTaken(c.name);
              return (
                <li key={c.name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.name === current?.name}
                    disabled={used}
                    onClick={() => choose(c.name)}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                      i === highlight && !used && "bg-primary-soft",
                      used && "cursor-not-allowed opacity-45",
                    )}
                  >
                    <span className={cn(c.name === current?.name && "font-bold text-primary-deep")}>{c.name}</span>
                    {used && <span className="text-xs">Already added</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {current && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-accent" />
          Pinned on the globe automatically ({current.lat.toFixed(2)}°, {current.lng.toFixed(2)}°)
        </p>
      )}
      {value && !current && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert className="h-3.5 w-3.5" />
          “{value}” isn't on the country list, so it can't be pinned on the globe. Pick it from the list above.
        </p>
      )}
    </div>
  );
}