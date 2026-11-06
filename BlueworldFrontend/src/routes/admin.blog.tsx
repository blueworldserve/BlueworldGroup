// blog.tsx
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { WriteGate } from "@/components/admin/write-gate";
import { CatalogManager, type CatalogField, type CatalogGroup } from "@/components/admin/catalog-manager";
import { deleteItem, newId, upsertItem, useCollection } from "@/lib/cms-store";
import { BLOG_CATEGORIES } from "@/data/placeholder-content";
import type { BlogPost } from "@/lib/types";

export const Route = createFileRoute("/admin/blog")({
  head: () => ({
    meta: [
      { title: "Blog Posts — Blue World CMS" },
      { name: "description", content: "Write and edit articles published on the Blue World blog." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Blog Posts — Blue World CMS" },
      { property: "og:description", content: "Write and edit blog articles." },
    ],
  }),
  component: BlogAdmin,
});

const POST_CATEGORIES = BLOG_CATEGORIES.filter((c) => c !== "All");

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const fields: CatalogField<BlogPost>[] = [
  { name: "title", label: "Article title" },
  { name: "excerpt", label: "Short summary", type: "textarea", rows: 3, help: "A one- or two-sentence teaser shown on the blog listing page." },
  { name: "body", label: "Full article", type: "textarea", rich: true, rows: 14, help: "Leave a blank line between paragraphs to start a new one." },
  { name: "category", label: "Category", type: "select", options: POST_CATEGORIES, half: true },
  { name: "author", label: "Written by", half: true },
  { name: "publishedAt", label: "Publish date", type: "date", help: "The date this article should go live.", half: true },
  { name: "readingMinutes", label: "Reading time (minutes)", type: "number", half: true },
  { name: "coverImage", label: "Cover photo", type: "image" },
];

const DEFAULT_SLUG_PLACEHOLDER = "new-post";

const needsAttention = (p: BlogPost) => !p.coverImage || !p.excerpt;

function BlogAdmin() {
  const posts = [...useCollection("blogPosts")].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  // One sidebar button per category (including any category an old post still uses).
  const categories = Array.from(new Set([...POST_CATEGORIES, ...posts.map((p) => p.category).filter(Boolean)]));
  const groups: CatalogGroup<BlogPost>[] = [
    ...categories.map((c) => ({ key: `cat:${c}`, title: c, match: (p: BlogPost) => p.category === c })),
    { key: "attention", title: "Needs attention", hint: "Missing a cover photo or summary", alert: true, match: needsAttention },
  ];

  return (
    <AdminShell title="Blog Posts" description="Articles published under /blog. Pick a category, open a card to edit it.">
      <WriteGate resource="blog-posts">
        <CatalogManager<BlogPost>
          items={posts}
          singular="Post"
          allLabel="All posts"
          groups={groups}
          fields={fields}
          imageField="coverImage"
          imageAspect="landscape"
          getImage={(p) => p.coverImage}
          getTitle={(p) => p.title}
          getSubtitle={(p) => [p.author, p.publishedAt].filter(Boolean).join(" · ")}
          getBadges={(p) => [
            ...(p.category ? [{ label: p.category }] : []),
            ...(needsAttention(p) ? [{ label: !p.coverImage ? "Needs cover photo" : "Needs summary", tone: "warn" as const }] : []),
          ]}
          searchText={(p) => [p.title, p.category, p.author, p.excerpt]}
          searchPlaceholder="Search title, author…"
          validate={(p) => (p.title.trim() ? null : "Give the article a title first.")}
          emptyItem={() => ({
            id: newId("b"),
            slug: DEFAULT_SLUG_PLACEHOLDER,
            title: "",
            excerpt: "",
            body: "",
            category: "Company News",
            author: "",
            publishedAt: new Date().toISOString().slice(0, 10),
            coverImage: "",
            readingMinutes: 4,
          })}
          onSave={(item) => {
            // The web-address slug is generated automatically from the title —
            // only regenerate it for a brand-new post, so editing an existing
            // post's title never breaks a link someone already shared.
            const needsSlug = !item.slug || item.slug === DEFAULT_SLUG_PLACEHOLDER;
            const finalItem = needsSlug ? { ...item, slug: slugify(item.title) || newId("post") } : item;
            return upsertItem("blogPosts", finalItem);
          }}
          onDelete={(id) => deleteItem("blogPosts", id)}
        />
      </WriteGate>
    </AdminShell>
  );
}