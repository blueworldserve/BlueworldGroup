import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight text styling that lives inside ordinary CMS text fields, so no
 * database or backend change is needed. The admin editor toolbar inserts these
 * markers for the editor; they can also be typed by hand.
 *
 *   **bold**        bold
 *   *italic*        italic
 *   ==orange==      orange italic accent
 *   ++bigger++      larger, heavier text
 *   ~~highlight~~   bold with an orange highlighter underline
 *   > a line        (start of a paragraph) pull-quote callout
 */

type Kind = "bold" | "italic" | "orange" | "big" | "fancy";
type Node = string | { kind: Kind; children: Node[] };

const TOKENS: { open: string; kind: Kind }[] = [
  { open: "**", kind: "bold" },
  { open: "==", kind: "orange" },
  { open: "++", kind: "big" },
  { open: "~~", kind: "fancy" },
  { open: "*", kind: "italic" },
];

/** Index of the closing marker for a token that opens at `start - open.length`, or -1. */
function findClose(src: string, start: number, open: string): number {
  let from = start + 1;
  while (from <= src.length - open.length) {
    const j = src.indexOf(open, from);
    if (j === -1) return -1;
    const before = src[j - 1] ?? "";
    const okBefore = !/\s/.test(before);
    if (open === "*") {
      // A lone * must not be part of a ** pair.
      if (okBefore && src[j + 1] !== "*" && before !== "*") return j;
    } else if (okBefore) {
      return j;
    }
    from = j + 1;
  }
  return -1;
}

function parse(src: string): Node[] {
  const out: Node[] = [];
  let buf = "";
  let i = 0;
  while (i < src.length) {
    let matched = false;
    for (const t of TOKENS) {
      if (!src.startsWith(t.open, i)) continue;
      const start = i + t.open.length;
      const next = src[start];
      if (next === undefined || /\s/.test(next)) continue;
      if (t.open === "*" && next === "*") continue;
      const close = findClose(src, start, t.open);
      if (close === -1) continue;
      if (buf) {
        out.push(buf);
        buf = "";
      }
      out.push({ kind: t.kind, children: parse(src.slice(start, close)) });
      i = close + t.open.length;
      matched = true;
      break;
    }
    if (!matched) {
      buf += src[i];
      i += 1;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function render(nodes: Node[]): ReactNode[] {
  return nodes.map((n, i) => {
    if (typeof n === "string") return n;
    const kids = render(n.children);
    switch (n.kind) {
      case "bold":
        return <strong key={i} className="font-bold">{kids}</strong>;
      case "italic":
        return <em key={i}>{kids}</em>;
      case "orange":
        return <span key={i} className="rt-mark">{kids}</span>;
      case "big":
        return <span key={i} className="rt-big">{kids}</span>;
      case "fancy":
        return <span key={i} className="rt-fancy">{kids}</span>;
    }
  });
}

function plain(nodes: Node[]): string {
  return nodes.map((n) => (typeof n === "string" ? n : plain(n.children))).join("");
}

/** Text with the markers removed, for page titles, meta descriptions and the like. */
export function stripMarkup(text: string): string {
  return plain(parse(text)).replace(/^>\s+/gm, "");
}

/** Splits a long text field into paragraphs on blank lines. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Inline styled text. Safe inside headings, buttons and single lines. */
export function RichText({ text }: { text: string }) {
  return <>{render(parse(text))}</>;
}

/**
 * Body copy: comfortable large type, with the first paragraph set bigger as an
 * introduction and "> " paragraphs shown as pull-quotes.
 */
export function RichParagraphs({
  paragraphs,
  lead = true,
  className,
}: {
  paragraphs: string[];
  lead?: boolean;
  className?: string;
}) {
  let leadUsed = !lead;
  return (
    <div className={cn("space-y-6 [&_strong]:text-foreground", className)}>
      {paragraphs.map((raw, i) => {
        if (raw.startsWith("> ")) {
          return (
            <blockquote key={i} className="rt-callout">
              <RichText text={raw.slice(2)} />
            </blockquote>
          );
        }
        const isLead = !leadUsed;
        leadUsed = true;
        return (
          <p
            key={i}
            className={cn(
              "whitespace-pre-line",
              isLead
                ? "text-xl leading-9 text-foreground lg:text-2xl lg:leading-[1.6]"
                : "text-lg leading-8 text-muted-foreground lg:text-[1.2rem] lg:leading-9",
            )}
          >
            <RichText text={raw} />
          </p>
        );
      })}
    </div>
  );
}
