import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockType } from "@/lib/types";
import { BLOCK_TYPE_LABELS } from "@/components/admin/page-block-editor";

const HELP: Record<BlockType, string> = {
  prose: "A heading and one or more paragraphs of text.",
  prose_image: "Text on one side, a photo on the other.",
  card_grid: "Cards with a title and short text, in 2–4 columns.",
  numbered_grid: "Numbered cards (01, 02, 03…) — good for steps or values.",
  feature_pair: "Two big side-by-side statements, e.g. Vision and Mission.",
  link_cards: "Cards that link to other pages.",
  team_grid: "Shows the people from the Team tab.",
  globe_reach: "The interactive world map of where we ship.",
};

const bar = "rounded bg-foreground/15";
const accent = "rounded bg-accent/70";
const card = "rounded-lg border border-border bg-card p-2.5";

function Lines({ n = 3 }: { n?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={cn(bar, "h-1.5", i === n - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

function Heading() {
  return (
    <div className="mb-4 space-y-1.5">
      <div className={cn(accent, "h-1.5 w-12")} />
      <div className="h-3 w-2/5 rounded bg-primary-deep/70" />
    </div>
  );
}

function Wireframe({ type }: { type: BlockType }) {
  switch (type) {
    case "prose":
      return (
        <div>
          <Heading />
          <div className="space-y-4">
            <Lines n={4} />
            <Lines n={3} />
          </div>
        </div>
      );
    case "prose_image":
      return (
        <div className="grid grid-cols-2 items-center gap-4">
          <div className="grid aspect-[4/3] place-items-center rounded-xl bg-primary-soft text-[0.65rem] font-bold text-primary-deep/60">Photo</div>
          <div>
            <Heading />
            <Lines n={5} />
          </div>
        </div>
      );
    case "card_grid":
      return (
        <div>
          <Heading />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={card}>
                <div className="mb-2 h-2.5 w-1/2 rounded bg-primary-deep/70" />
                <Lines n={3} />
              </div>
            ))}
          </div>
        </div>
      );
    case "numbered_grid":
      return (
        <div>
          <Heading />
          <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3">
            {["01", "02", "03"].map((n) => (
              <div key={n} className={card}>
                <div className="mb-1.5 font-display text-lg font-extrabold text-accent">{n}</div>
                <div className="mb-2 h-2.5 w-2/3 rounded bg-primary-deep/70" />
                <Lines n={3} />
              </div>
            ))}
          </div>
        </div>
      );
    case "feature_pair":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-primary/20 p-4">
            <div className={cn(accent, "mb-3 h-1.5 w-10")} />
            <div className="space-y-1.5"><div className="h-3 w-full rounded bg-primary-deep/70" /><div className="h-3 w-3/4 rounded bg-primary-deep/70" /></div>
          </div>
          <div className="rounded-2xl bg-accent-soft p-4">
            <div className={cn(accent, "mb-3 h-1.5 w-10")} />
            <div className="space-y-1.5"><div className="h-3 w-full rounded bg-primary-deep/70" /><div className="h-3 w-2/3 rounded bg-primary-deep/70" /></div>
          </div>
        </div>
      );
    case "link_cards":
      return (
        <div>
          <Heading />
          <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={card}>
                <div className="mb-2 h-2.5 w-2/3 rounded bg-primary-deep/70" />
                <Lines n={2} />
                <div className={cn(accent, "mt-3 h-1.5 w-1/2")} />
              </div>
            ))}
          </div>
        </div>
      );
    case "team_grid":
      return (
        <div>
          <Heading />
          <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="aspect-[3/4] rounded-lg bg-primary-soft" />
                <div className="mt-2 h-2 w-3/4 rounded bg-primary-deep/70" />
                <div className={cn(accent, "mt-1.5 h-1.5 w-1/2")} />
              </div>
            ))}
          </div>
        </div>
      );
    case "globe_reach":
      return (
        <div className="grid grid-cols-2 items-center gap-4">
          <div>
            <Heading />
            <Lines n={3} />
          </div>
          <div className="mx-auto grid aspect-square w-3/4 place-items-center rounded-full border-2 border-primary/30 bg-primary-soft text-[0.65rem] font-bold text-primary-deep/60">Globe</div>
        </div>
      );
  }
}

/**
 * Pick a section type: the left panel previews the layout of the type you choose,
 * the right panel lists the types and holds the "Add section" button.
 */
export function BlockTypePicker({
  value,
  onChange,
  onAdd,
}: {
  value: BlockType;
  onChange: (t: BlockType) => void;
  onAdd: () => void;
}) {
  const types = Object.keys(BLOCK_TYPE_LABELS) as BlockType[];
  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-card md:grid-cols-[1fr_17rem]">
      <div className="order-2 md:order-1">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Preview — {BLOCK_TYPE_LABELS[value]}</p>
        <div className="mt-2 rounded-xl border border-dashed border-border bg-secondary p-5">
          <div className="rounded-lg bg-background p-5 shadow-sm">
            <Wireframe type={value} />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{HELP[value]}</p>
      </div>

      <div className="order-1 flex flex-col gap-2 md:order-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Choose a section type</p>
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              aria-pressed={value === t}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors",
                value === t
                  ? "border-primary-deep bg-primary-deep text-primary-foreground"
                  : "border-border hover:bg-primary-soft",
              )}
            >
              {BLOCK_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-accent-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add section
        </button>
      </div>
    </div>
  );
}
