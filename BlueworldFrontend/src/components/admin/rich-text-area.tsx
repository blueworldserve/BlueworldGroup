import { useRef, useState, type KeyboardEvent } from "react";
import { Bold, Eye, EyeOff, Highlighter, Italic, Palette, Quote, Type } from "lucide-react";
import { RichParagraphs, splitParagraphs } from "@/components/site/rich-text";
import { cn } from "@/lib/utils";

type Mark = { open: string; label: string; title: string; icon: typeof Bold };

const MARKS: Mark[] = [
  { open: "**", label: "Bold", title: "Bold (Ctrl+B)", icon: Bold },
  { open: "*", label: "Italic", title: "Italic (Ctrl+I)", icon: Italic },
  { open: "==", label: "Orange", title: "Orange italic accent", icon: Palette },
  { open: "++", label: "Bigger", title: "Bigger, heavier text", icon: Type },
  { open: "~~", label: "Highlight", title: "Orange highlighter underline", icon: Highlighter },
];

const btn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-bold text-primary-deep transition-colors hover:bg-primary-soft";

/**
 * A textarea with a small toolbar. Select some words, press a button, and the
 * styling markers are wrapped around them (press again to remove). The preview
 * shows exactly how the text will look on the website.
 */
export function RichTextArea({
  id,
  value,
  onChange,
  rows = 6,
  className,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function apply(next: string, from: number, to: number) {
    const el = ref.current;
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(from, to);
    });
  }

  function wrap(open: string) {
    const el = ref.current;
    if (!el) return;
    const v = el.value;
    let s = el.selectionStart;
    let e = el.selectionEnd;
    // Ignore spaces dragged into the selection so the markers hug the words.
    while (s < e && /\s/.test(v[s] ?? "")) s += 1;
    while (e > s && /\s/.test(v[e - 1] ?? "")) e -= 1;
    const sel = v.slice(s, e);
    const n = open.length;

    // Selection includes the markers: remove them.
    if (sel.length >= n * 2 && sel.startsWith(open) && sel.endsWith(open) && !(open === "*" && sel.startsWith("**"))) {
      const inner = sel.slice(n, sel.length - n);
      apply(v.slice(0, s) + inner + v.slice(e), s, s + inner.length);
      return;
    }
    // Markers sit just outside the selection: remove them.
    const loneStar = open === "*" && (v[s - 2] === "*" || v[e + 1] === "*");
    if (!loneStar && v.slice(s - n, s) === open && v.slice(e, e + n) === open && s - n >= 0) {
      apply(v.slice(0, s - n) + sel + v.slice(e + n), s - n, s - n + sel.length);
      return;
    }
    const text = sel || "your text";
    apply(v.slice(0, s) + open + text + open + v.slice(e), s + n, s + n + text.length);
  }

  function toggleQuote() {
    const el = ref.current;
    if (!el) return;
    const v = el.value;
    const s = el.selectionStart;
    const lineStart = v.lastIndexOf("\n", s - 1) + 1;
    if (v.startsWith("> ", lineStart)) {
      apply(v.slice(0, lineStart) + v.slice(lineStart + 2), Math.max(lineStart, s - 2), Math.max(lineStart, s - 2));
    } else {
      apply(v.slice(0, lineStart) + "> " + v.slice(lineStart), s + 2, s + 2);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") {
      e.preventDefault();
      wrap("**");
    } else if (k === "i") {
      e.preventDefault();
      wrap("*");
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-t-lg border border-b-0 border-border bg-secondary p-1.5">
        {MARKS.map((m) => (
          <button
            key={m.open}
            type="button"
            title={m.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => wrap(m.open)}
            className={btn}
          >
            <m.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}
        <button
          type="button"
          title="Make this paragraph a large pull-quote"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleQuote}
          className={btn}
        >
          <Quote className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Quote</span>
        </button>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className={cn(btn, "ml-auto", preview && "border-accent bg-accent text-accent-foreground hover:bg-accent")}
        >
          {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {preview ? "Hide preview" : "Preview"}
        </button>
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn(className, "!mt-0 rounded-t-none")}
      />
      <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
        Select words, then press a button above. Leave a blank line to start a new paragraph. The first paragraph is shown larger as an introduction.
      </p>
      {preview && (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-card p-5">
          <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-accent">Preview</p>
          {value.trim() ? (
            <RichParagraphs paragraphs={splitParagraphs(value)} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
