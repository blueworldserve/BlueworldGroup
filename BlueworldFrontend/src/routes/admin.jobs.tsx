import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { WriteGate } from "@/components/admin/write-gate";
import { ResourceManager, type ColumnConfig, type FieldConfig } from "@/components/admin/resource-manager";
import { deleteItem, newId, upsertItem, useCollection } from "@/lib/cms-store";
import type { JobPosting } from "@/lib/types";
import { CatalogManager, type CatalogField, type CatalogGroup } from "@/components/admin/catalog-manager";

export const Route = createFileRoute("/admin/jobs")({
  head: () => ({
    meta: [
      { title: "Job Postings — Blue World CMS" },
      { name: "description", content: "Publish and close roles listed on the careers page." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Job Postings — Blue World CMS" },
      { property: "og:description", content: "Manage open roles." },
    ],
  }),
  component: JobsAdmin,
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

const fields: CatalogField<JobPosting>[] = [
  { name: "title", label: "Role title" },
  { name: "department", label: "Department", half: true },
  { name: "location", label: "Location", half: true },
  {
    name: "employmentType",
    label: "Employment type",
    type: "select",
    options: ["Full-time", "Contract", "Internship"],
  },
  { name: "summary", label: "Role summary", type: "textarea", rows: 3, help: "A short overview of the role, shown on the careers listing." },
  { name: "responsibilities", label: "What they'll do", type: "list", rows: 6, help: "One responsibility per line." },
  { name: "requirements", label: "What we're looking for", type: "list", rows: 6, help: "One requirement per line." },
  { name: "postedAt", label: "Posted on", type: "date", help: "The date this role should start showing on the careers page.", half: true },
  { name: "closesAt", label: "Applications close on", type: "date", help: "Optional. Leave blank if there's no deadline.", half: true },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const isClosed = (j: JobPosting) => !!j.closesAt && j.closesAt < todayISO();

const groups: CatalogGroup<JobPosting>[] = [
  { key: "open", title: "Open now", hint: "No deadline, or it hasn't passed yet", match: (j) => !isClosed(j) },
  { key: "closed", title: "Closed", hint: "Application deadline has passed", match: isClosed },
];

const DEFAULT_SLUG_PLACEHOLDER = "new-role";
function JobsAdmin() {
  const jobs = [...useCollection("jobPostings")].sort((a, b) => b.postedAt.localeCompare(a.postedAt));

  return (
    <AdminShell title="Job Postings" description="Roles listed on the Career page. Filter by status or department, open a card to edit it.">
      <WriteGate resource="jobs">
        <CatalogManager<JobPosting>
          items={jobs}
          singular="Job"
          allLabel="All roles"
          groups={groups}
          pills={{ allLabel: "All departments", get: (j) => j.department }}
          fields={fields}
          getTitle={(j) => j.title}
          getSubtitle={(j) => [j.department, j.location].filter(Boolean).join(" · ")}
          getBadges={(j) => [
            { label: j.employmentType },
            ...(j.closesAt ? [{ label: isClosed(j) ? "Closed" : `Closes ${j.closesAt}`, tone: isClosed(j) ? ("muted" as const) : ("accent" as const) }] : []),
          ]}
          searchText={(j) => [j.title, j.department, j.location, j.summary]}
          searchPlaceholder="Search role, department, location…"
          validate={(j) => (j.title.trim() ? null : "Give the role a title first.")}
          deleteNote="It will disappear from the Careers page."
          emptyItem={() => ({
            id: newId("j"),
            slug: DEFAULT_SLUG_PLACEHOLDER,
            title: "",
            department: "",
            location: "Ikeja, Lagos",
            employmentType: "Full-time",
            summary: "",
            responsibilities: [],
            requirements: [],
            postedAt: new Date().toISOString().slice(0, 10),
            closesAt: null,
          })}
          onSave={(item) => {
            const needsSlug = !item.slug || item.slug === DEFAULT_SLUG_PLACEHOLDER;
            const finalItem = needsSlug ? { ...item, slug: slugify(item.title) || newId("role") } : item;
            return upsertItem("jobPostings", finalItem);
          }}
          onDelete={(id) => deleteItem("jobPostings", id)}
        />
      </WriteGate>
    </AdminShell>
  );
}