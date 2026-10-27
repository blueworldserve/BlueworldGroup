import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { WriteGate } from "@/components/admin/write-gate";
import { CatalogManager, type CatalogField, type CatalogGroup } from "@/components/admin/catalog-manager";
import { deleteItem, newId, upsertItem, useCollection } from "@/lib/cms-store";
import type { HeroSlide } from "@/lib/types";

export const Route = createFileRoute("/admin/hero-slides")({
  head: () => ({
    meta: [
      { title: "Hero Slides — Blue World CMS" },
      { name: "description", content: "Manage the homepage hero slider content." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Hero Slides — Blue World CMS" },
      { property: "og:description", content: "Manage homepage hero slides." },
    ],
  }),
  component: HeroSlidesAdmin,
});

const CTA_DESTINATIONS = [
  "/",
  "/about/who-we-are",
  "/about/vision-mission",
  "/about/leadership",
  "/business/vivon",
  "/business/bluecrystal",
  "/business/blow-right",
  "/business/bluefragrance",
  "/business/blueworld-cosmetics",
  "/career",
  "/blog",
  "/contact",
];

const fields: CatalogField<HeroSlide>[] = [
  { name: "image", label: "Background image", type: "image", help: "Required. Also shown while a video loads and if it can't play." },
  { name: "title", label: "Title" },
  { name: "subtitle", label: "Subtitle", type: "textarea", rows: 3 },
  { name: "eyebrow", label: "Eyebrow", help: "Small text above the title.", half: true },
  { name: "ctaLabel", label: "Button label", half: true },
  { name: "ctaHref", label: "Button link", type: "select", options: CTA_DESTINATIONS, half: true },
  { name: "order", label: "Order", type: "number", help: "Lower numbers show first.", half: true },
  {
    name: "videoUrl",
    label: "Background video (optional)",
    type: "video",
    help: "Upload an MP4/WebM, or paste a YouTube or Instagram link. Leave empty for a photo-only slide.",
  },
  { name: "mobileImage", label: "Mobile photo (optional)", type: "image", help: "Shown instead of the desktop photo on phones. Leave blank to reuse the desktop photo." },
];


const groups: CatalogGroup<HeroSlide>[] = [
  { key: "video", title: "Has a video", match: (s) => !!s.videoUrl },
  { key: "photo", title: "Photo only", match: (s) => !s.videoUrl },
];

function HeroSlidesAdmin() {
  const slides = [...useCollection("heroSlides")].sort((a, b) => a.order - b.order);

  return (
    <AdminShell title="Hero Slides" description="The rotating banner at the top of the homepage. Open a card to edit, use the arrows to change the order.">
      <WriteGate resource="hero-slides">
        <CatalogManager<HeroSlide>
          items={slides}
          singular="Slide"
          allLabel="All slides"
          groups={groups}
          fields={fields}
          imageField="image"
          imageAspect="landscape"
          getImage={(s) => s.image}
          getTitle={(s) => s.title}
          getSubtitle={(s) => s.eyebrow ?? ""}
          getBadges={(s) => [
            ...(s.ctaLabel ? [{ label: s.ctaLabel }] : []),
            ...(s.videoUrl ? [{ label: "Video", tone: "accent" as const }] : []),
          ]}
          reorder={{ field: "order", start: 1 }}
          searchText={(s) => [s.title, s.eyebrow, s.subtitle, s.ctaLabel]}
          searchPlaceholder="Search title, eyebrow…"
          validate={(s) => (s.image ? null : "Choose a background image first.")}
          emptyItem={() => ({
            id: newId("hs"),
            image: "hero.beauty",
            videoUrl: null,
            eyebrow: "",
            title: "",
            subtitle: "",
            ctaLabel: "Learn more",
            ctaHref: "/business",
            order: slides.length + 1,
          })}
          onSave={(item) => upsertItem("heroSlides", item)}
          onDelete={(id) => deleteItem("heroSlides", id)}
        />
      </WriteGate>
    </AdminShell>
  );
}