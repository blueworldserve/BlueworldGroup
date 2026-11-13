import { useState } from "react";
import { ImagePicker } from "@/components/admin/catalog-manager";
import { RichTextArea } from "@/components/admin/rich-text-area";
import { BlockEditorRow } from "@/components/admin/page-block-editor";
import { BlockTypePicker } from "@/components/admin/block-type-picker";
import { emptyPageBlock, type PageInput } from "@/lib/pages-admin";
import type { BlockType } from "@/lib/types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";
const labelClass = "text-xs font-bold uppercase tracking-[0.14em] text-accent";

export function PageForm({
  initial,
  onSubmit,
  submitLabel,
  busy,
}: {
  initial: PageInput;
  onSubmit: (value: PageInput) => void;
  submitLabel: string;
  busy: boolean;
}) {
  const [form, setForm] = useState<PageInput>(initial);
  const [newBlockType, setNewBlockType] = useState<BlockType>("prose");

  function set<K extends keyof PageInput>(key: K, value: PageInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateBlock(i: number, next: PageInput["blocks"][number]) {
    setForm((f) => ({ ...f, blocks: f.blocks.map((b, j) => (j === i ? next : b)) }));
  }

  function removeBlock(i: number) {
    setForm((f) => ({ ...f, blocks: f.blocks.filter((_, j) => j !== i) }));
  }

  function moveBlock(i: number, dir: -1 | 1) {
    setForm((f) => {
      const blocks = [...f.blocks];
      const target = i + dir;
      if (target < 0 || target >= blocks.length) return f;
      [blocks[i], blocks[target]] = [blocks[target]!, blocks[i]!];
      return { ...f, blocks };
    });
  }

  function addBlock() {
    setForm((f) => ({ ...f, blocks: [...f.blocks, emptyPageBlock(newBlockType)] }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-8"
    >
      <div className="rounded-2xl border border-border bg-card p-7 shadow-card">
        <h2 className="font-display text-lg font-bold text-primary-deep">Page details</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Page title</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Page path (URL)</label>
            <input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="about/vision-mission"
              className={inputClass}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">The web address this page appears at, e.g. "about/leadership".</p>
          </div>
          <div>
            <label className={labelClass}>Small label above the title (optional)</label>
            <input value={form.eyebrow ?? ""} onChange={(e) => set("eyebrow", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as "draft" | "published")}
              className={inputClass}
            >
              <option value="draft">Draft — not visible on the website yet</option>
              <option value="published">Published — live on the website</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Short description (shown under the title)</label>
            <RichTextArea
              rows={3}
              value={form.description ?? ""}
              onChange={(v) => set("description", v)}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Cover photo (optional)</label>
            <ImagePicker value={form.heroImage ?? ""} onChange={(v) => set("heroImage", v)} aspect="landscape" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Mobile cover photo (optional)</label>
            <p className="mb-2 text-xs text-muted-foreground">Shown instead of the cover photo on phones. Use a tall (portrait) photo. Leave blank to reuse the cover photo.</p>
            <ImagePicker value={form.mobileHeroImage ?? ""} onChange={(v) => set("mobileHeroImage", v)} aspect="portrait" />
          </div>
        </div>

        <details className="mt-6 rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-semibold text-primary-deep">Advanced</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Page title in Google search results</label>
              <input value={form.metaTitle ?? ""} onChange={(e) => set("metaTitle", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Description shown under the title in Google search results</label>
              <input value={form.metaDescription ?? ""} onChange={(e) => set("metaDescription", e.target.value)} className={inputClass} />
            </div>
          </div>
        </details>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-primary-deep">Page content</h2>
        <div className="mt-4">
          <BlockTypePicker value={newBlockType} onChange={setNewBlockType} onAdd={addBlock} />
        </div>

        <div className="mt-5 space-y-5">
          {form.blocks.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-secondary py-10 text-center text-sm text-muted-foreground">
              No sections yet — pick a type above and click "Add section."
            </p>
          )}
          {form.blocks.map((block, i) => (
            <BlockEditorRow
              key={i}
              block={block}
              index={i}
              total={form.blocks.length}
              onChange={(next) => updateBlock(i, next)}
              onRemove={() => removeBlock(i)}
              onMove={(dir) => moveBlock(i, dir)}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-primary-deep px-8 py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}