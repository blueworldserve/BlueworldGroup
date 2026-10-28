import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { CatalogManager, type CatalogGroup } from "@/components/admin/catalog-manager";
import { deleteAdminPage, listAdminPages } from "@/lib/pages-admin";
import { useIsAdmin } from "@/hooks/use-is-admin";
import type { CmsPage } from "@/lib/types";

export const Route = createFileRoute("/admin/pages/")({
  component: AdminPagesList,
});

const needsAttention = (p: CmsPage) => !p.heroImage || !p.description;

const groups: CatalogGroup<CmsPage>[] = [
  { key: "published", title: "Published", hint: "Live on the website", match: (p) => p.status === "published" },
  { key: "draft", title: "Drafts", hint: "Not visible on the website yet", match: (p) => p.status === "draft" },
  { key: "attention", title: "Needs attention", hint: "Missing a cover photo or description", alert: true, match: needsAttention },
];

function AdminPagesList() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "pages"],
    queryFn: listAdminPages,
  });

  useEffect(() => {
    if (isError) toast.error("Could not load pages — check your connection or permissions.");
  }, [isError]);

  const pages = [...(data ?? [])].sort((a, b) => a.slug.localeCompare(b.slug));

  return (
    <AdminShell
      title="About Pages"
      description="Content and images for the About section — Index, Who We Are, Vision & Mission, Leadership. Open a card to edit it."
    >
      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">Loading pages…</div>
      ) : (
        <CatalogManager<CmsPage>
          items={pages}
          singular="Page"
          allLabel="All pages"
          groups={groups}
          pills={{ allLabel: "All sections", get: (p) => (p.slug.includes("/") ? p.slug.split("/")[0] : "top level") }}
          imageAspect="landscape"
          getImage={(p) => p.heroImage ?? ""}
          getTitle={(p) => p.title}
          getSubtitle={(p) => `/${p.slug}`}
          getBadges={(p) => [
            { label: p.status === "published" ? "Published" : "Draft", tone: p.status === "published" ? ("primary" as const) : ("muted" as const) },
            { label: `${p.blocks.length} section${p.blocks.length === 1 ? "" : "s"}`, tone: "muted" as const },
            ...(needsAttention(p) ? [{ label: "Needs attention", tone: "warn" as const }] : []),
          ]}
          searchText={(p) => [p.title, p.slug, p.description ?? undefined]}
          searchPlaceholder="Search title or path…"
          canDelete={isAdmin}
          deleteNote="It will disappear from the website."
          onOpen={(p) => void navigate({ to: "/admin/pages/$pageId", params: { pageId: p.id } })}
          onAdd={() => void navigate({ to: "/admin/pages/new" })}
          onDelete={async (id) => {
            await deleteAdminPage(id);
            await refetch();
          }}
        />
      )}
    </AdminShell>
  );
}