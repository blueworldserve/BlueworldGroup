import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { CatalogManager, type CatalogField, type CatalogGroup } from "@/components/admin/catalog-manager";
import { deleteItem, newId, upsertItem, useCollection } from "@/lib/cms-store";
import type { BusinessUnit } from "@/lib/types";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/admin/business-units")({
  head: () => ({
    meta: [
      { title: "Business Units — Blue World CMS" },
      { name: "description", content: "Manage the five Blue World brand divisions." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Business Units — Blue World CMS" },
      { property: "og:description", content: "Manage brand divisions and their stories." },
    ],
  }),
  component: BusinessUnitsAdmin,
});

const fields: CatalogField<BusinessUnit>[] = [
  {
    name: "slug",
    label: "Which brand is this?",
    type: "select",
    options: ["vivon", "bluecrystal", "blow-right", "bluefragrance", "blueworld-cosmetics"],
    help: "This is fixed to one of the five brands — it controls which page on the website this content appears on.",
  },
  { name: "name", label: "Brand Name (as shown on the page)" },
  { name: "tagline", label: "Short slogan", help: "A one-line phrase shown under the brand name, e.g. 'Skincare that listens to your skin'." },
  { name: "summary", label: "Short description", type: "textarea", rows: 3, help: "A brief overview shown on the homepage card for this brand." },
  { name: "story", label: "Full brand story", type: "textarea", rows: 8, help: "The longer story shown on the brand's own page. Leave a blank line to start a new paragraph." },
  {
    name: "heroImage",
    label: "Cover Photo",
    type: "image",
    help: "This is the ONE main photo for this brand — shown on the homepage and at the top of the brand's page. To show several product photos, add them as separate Products (see the Products tab) and tag them to this brand.",
  },
  {
    name: "mobileHeroImage",
    label: "Mobile Cover Photo (optional)",
    type: "image",
    help: "Shown at the top of the brand's page on phones instead of the cover photo. Use a tall (portrait) photo. Leave blank to reuse the cover photo.",
  },
  { name: "accent", label: "Colour Theme", type: "select", options: ["blue", "orange"], help: "Which brand colour is used for highlights on this brand's page.", half: true },
  { name: "order", label: "Display Order", type: "number", help: "Lower numbers appear first on the homepage.", half: true },
];
const needsAttention = (u: BusinessUnit) => !u.heroImage || !u.summary || !u.story;

const groups: CatalogGroup<BusinessUnit>[] = [
  { key: "attention", title: "Needs attention", hint: "Missing a cover photo, description or story", alert: true, match: needsAttention },
];

function BusinessUnitsAdmin() {
  const units = [...useCollection("businessUnits")].sort((a, b) => a.order - b.order);
  const isAdmin = useIsAdmin();

  return (
    <AdminShell
      title="Business Units"
      description="Each division shown under the Business menu. Each brand has one cover photo here; individual product photos are managed under Products."
    >
      <CatalogManager<BusinessUnit>
        items={units}
        singular="Business unit"
        allLabel="All brands"
        groups={groups}
        fields={fields}
        imageField="heroImage"
        imageAspect="landscape"
        getImage={(u) => u.heroImage}
        getTitle={(u) => u.name}
        getSubtitle={(u) => u.tagline}
        getBadges={(u) => [
          { label: u.accent === "orange" ? "Orange theme" : "Blue theme", tone: u.accent === "orange" ? ("accent" as const) : ("primary" as const) },
          ...(needsAttention(u) ? [{ label: "Needs attention", tone: "warn" as const }] : []),
        ]}
        reorder={{ field: "order", start: 1 }}
        searchText={(u) => [u.name, u.tagline, u.slug, u.summary]}
        searchPlaceholder="Search brand name…"
        validate={(u) => (u.name.trim() ? null : "Give the brand a name first.")}
        canDelete={isAdmin}
        emptyItem={() =>
          ({
            id: newId("bu"),
            slug: "vivon",
            name: "",
            tagline: "",
            summary: "",
            story: "",
            heroImage: "",
            mobileHeroImage: "",
            accent: "blue",
            order: units.length + 1,
          }) as BusinessUnit
        }
        onSave={(item) => upsertItem("businessUnits", item)}
        onDelete={(id) => deleteItem("businessUnits", id)}
      />
    </AdminShell>
  );
}