import { useEffect, useState } from "react";
import { ENDPOINTS, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * "Send from" box: type any address, or tap one of the configured ones.
 * An empty box means the server's default sender.
 */
export function SenderField({
  value,
  onChange,
  disabled,
  preferred,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Pre-select this address when it is one of ours (e.g. the mailbox a customer's email arrived at). */
  preferred?: string | null | undefined;
}) {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ senders: string[]; default: string | null }>(ENDPOINTS.adminSenders)
      .then((r) => {
        if (cancelled) return;
        setOptions(r.senders);
        const wanted = preferred && r.senders.find((s) => s.toLowerCase() === preferred.toLowerCase());
        if (wanted) onChange(wanted);
        else if (r.default) onChange(r.default);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Load once; onChange only pre-fills the default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <label htmlFor="send-from" className="text-sm font-semibold text-primary-deep">
        Send from
      </label>
      <input
        id="send-from"
        type="email"
        inputMode="email"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="hr@blueworldcosmetics.org"
        className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary disabled:opacity-60"
      />
      {options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o)}
              className={cn(
                "max-w-full truncate rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                value.trim().toLowerCase() === o.toLowerCase()
                  ? "border-primary-deep bg-primary-deep text-primary-foreground"
                  : "border-border text-foreground/75 hover:bg-primary-soft",
              )}
            >
              {o}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">
        Type any address, or pick one. Replies go to the address the mail is sent from.
      </p>
    </div>
  );
}
