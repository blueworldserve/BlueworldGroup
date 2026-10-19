import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin/admin-shell";
import { WriteGate } from "@/components/admin/write-gate";
import { ResourceManager, type ColumnConfig, type FieldConfig } from "@/components/admin/resource-manager";
import { deleteItem, newId, upsertItem, useCollection } from "@/lib/cms-store";
import type { CountryShowcase } from "@/lib/types";
import { resolveTint, TINT_COLOR_NAMES } from "@/lib/tint";

export const Route = createFileRoute("/admin/country-showcase")({
  head: () => ({
    meta: [
      { title: "Country Showcase — Blue World CMS" },
      { name: "description", content: "The photo and write-up shown when a visitor taps a country marker on the homepage globe." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CountryShowcaseAdmin,
});

const columns: ColumnConfig<CountryShowcase>[] = [
  { key: "image", label: "Image", image: true },
  { key: "name", label: "Country" },
  { key: "place", label: "Place" },
  { key: "headline", label: "Headline" },
  { key: "order", label: "Order" },
];

const fields: FieldConfig<CountryShowcase>[] = [
  {
    name: "name",
    label: "Country",
    type: "country",
    help: "Search and pick the country. Its pin appears on the homepage globe automatically, and it joins the list beside the globe.",
  },
  { name: "place", label: "City / place", help: "Shown as the small label above the headline, e.g. \"Lagos\", \"Nairobi\"." },
  { name: "headline", label: "Headline" },
  { name: "blurb", label: "First paragraph", type: "textarea", rows: 4 },
  { name: "detail", label: "Second paragraph", type: "textarea", rows: 4 },
  { name: "statValue", label: "Stat value", help: "The big number/word, e.g. \"200+\", \"2016\", \"2 way\"." },
  { name: "statLabel", label: "Stat label", help: "What the stat means, e.g. \"People employed here\"." },
  { name: "points", label: "Bullet points", type: "list", rows: 6, help: "One point per line. These fill the card top-down — add as many as you like." },
  { name: "image", label: "Backdrop photo", type: "image" },
  { name: "video", label: "Backdrop video URL (optional)" },
  {
    name: "tint",
    label: "Fallback tint",
    type: "select",
    options: TINT_COLOR_NAMES,
    help: "Shown behind the globe while the photo loads or if it's missing. Pick the colour closest to the country's photo.",
    preview: (item) => (
      <span
        aria-hidden="true"
        className="h-11 w-16 shrink-0 rounded-lg border border-border"
        style={{ background: resolveTint(item.tint) }}
      />
    ),
  },
  { name: "order", label: "Display order", type: "number" },
];

function CountryShowcaseAdmin() {
  const items = [...useCollection("countryShowcases")].sort((a, b) => a.order - b.order);

  return (
    <AdminShell
      title="Country Showcase"
      description="What appears when someone taps a market on the homepage globe — one entry per country marker."
    >
      <WriteGate resource="country-showcases">
        <ResourceManager<CountryShowcase>
          items={items}
          columns={columns}
          fields={fields}
          singular="Country"
          emptyItem={() => ({
            id: newId("cs"),
            name: "",
            place: "",
            headline: "",
            blurb: "",
            detail: "",
            statValue: "",
            statLabel: "",
            points: [],
            image: "",
            video: null,
            tint: "green",
            order: items.length,
          })}
          onSave={(item) => upsertItem("countryShowcases", item)}
          onDelete={(id) => deleteItem("countryShowcases", id)}
        />
      </WriteGate>
    </AdminShell>
  );
}