import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppLink } from "@/components/site/app-link";
import { CmsImage, LoadingBlock, Section, SectionHeading } from "@/components/site/primitives";
import { CmsPageHero } from "@/components/site/cms-page-hero";
import { RichText, stripMarkup } from "@/components/site/rich-text";
import { useBusinessUnits } from "@/hooks/use-cms";

export const Route = createFileRoute("/business/")({
  head: () => ({
    meta: [
      { title: "Our Brands | Blueworld Cosmetics" },
      {
        name: "description",
        content:
          "Five brands under one Lagos manufacturing house: Vivon skincare, BlueCrystal hygiene, Blow Right haircare, BlueFragrance and Blueworld Cosmetics essentials.",
      },
      { property: "og:title", content: "Our Brands | Blueworld Cosmetics" },
      {
        property: "og:description",
        content: "Skincare, hygiene, haircare, fragrance and household essentials made in Nigeria.",
      },
    ],
  }),
  component: BusinessIndexPage,
});

function BusinessIndexPage() {
  const { data, isLoading } = useBusinessUnits();
  const units = [...(data ?? [])].sort((a, b) => a.order - b.order);

  return (
    <>
      <CmsPageHero
        slug="business"
        eyebrow="Business"
        title="Five brands, one factory floor"
        description="Each division owns its own chemistry, packaging and audience, all produced, tested and filled at our Obadore, Igando, Lagos manufacturing Company."
        image="hero.factory"
      />
      <Section>
        <SectionHeading eyebrow="Our house of brands" title="Choose a division" />
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {isLoading && <LoadingBlock label="Loading brands…" />}
          {units.map((unit) => (
            <div
              key={unit.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-lift"
            >
              <Link to="/business/$unit" params={{ unit: unit.slug }} className="block flex-1">
                <div className="aspect-[4/3] overflow-hidden bg-secondary">
                  <CmsImage
                    src={unit.heroImage}
                    alt={unit.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="p-6 pb-3">
                  <h3 className="font-display text-xl font-bold text-primary-deep">{unit.name}</h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-accent">
                    {stripMarkup(unit.tagline)}
                  </p>
                  <p className="mt-3 text-base leading-7 text-muted-foreground"><RichText text={unit.summary} /></p>
                </div>
              </Link>
              {unit.readMoreUrl && (
                <div className="px-6 pb-6 pt-2">
                  <AppLink
                    href={unit.readMoreUrl}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-accent-foreground transition-colors hover:bg-primary-deep hover:text-primary-foreground"
                  >
                    Read More <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
                  </AppLink>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
