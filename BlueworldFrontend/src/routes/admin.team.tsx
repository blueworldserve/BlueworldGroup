import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { ResourceManager, type ColumnConfig, type FieldConfig } from "@/components/admin/resource-manager";
import { deleteItem, newId, upsertItem, useCollection } from "@/lib/cms-store";
import type { TeamMember } from "@/lib/types";

export const Route = createFileRoute("/admin/team")({
  head: () => ({
    meta: [
      { title: "Team — Blue World CMS" },
      { name: "description", content: "Manage the leadership team shown on the About pages." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Team — Blue World CMS" },
      { property: "og:description", content: "Manage leadership profiles." },
    ],
  }),
  component: TeamAdmin,
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const columns: ColumnConfig<TeamMember>[] = [
  { key: "photo", label: "Photo", image: true },
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "order", label: "Order" },
];

const fields: FieldConfig<TeamMember>[] = [
  { name: "name", label: "Full name" },
  { name: "role", label: "Job title", help: "e.g. 'Chief Executive Officer', 'Head of Production'." },
  {
    name: "isFeatured",
    label: "Feature as top leader",
    type: "boolean",
    help: "Spotlights this person first on the Leadership page, with their photo and a longer statement — use this for the Founder/MD/Chief Visionary. Only one person should normally be turned on at a time.",
  },
  {
    name: "bio",
    label: "Full write-up",
    type: "textarea",
    rows: 6,
    help: "Shown on this person's own profile page, and as the statement if they're featured as the top leader. Leave a blank line between paragraphs.",
  },
  { name: "photo", label: "Photo", type: "image" },
  { name: "order", label: "Display order", type: "number", help: "Lower numbers appear first. 1 shows before 2, and so on." },
];

const DEFAULT_SLUG_PLACEHOLDER = "new-leader";

function TeamAdmin() {
  const members = [...useCollection("teamMembers")].sort((a, b) => a.order - b.order);

  return (
    <AdminShell title="Team" description="Executives listed on About Us → Leadership.">
      <ResourceManager<TeamMember>
        items={members}
        columns={columns}
        fields={fields}
        singular="Team member"
        emptyItem={() => ({
          id: newId("t"),
          name: "",
          slug: DEFAULT_SLUG_PLACEHOLDER,
          role: "",
          bio: "",
          photo: "",
          order: members.length + 1,
          isFeatured: false,
        })}
        onSave={(item) => {
          const needsSlug = !item.slug || item.slug === DEFAULT_SLUG_PLACEHOLDER;
          const finalItem = needsSlug ? { ...item, slug: slugify(item.name) || newId("leader") } : item;
          upsertItem("teamMembers", finalItem);
        }}
        onDelete={(id) => deleteItem("teamMembers", id)}
      />
    </AdminShell>
  );
}