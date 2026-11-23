import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppLink } from "@/components/site/app-link";
import {
  CmsImage,
  EmptyBlock,
  LoadingBlock,
  PageHero,
  Section,
  SectionHeading,
} from "@/components/site/primitives";
import { ProductBrowser } from "@/components/site/product-browser";
import { resolveImage } from "@/data/images";
import { RichParagraphs, splitParagraphs, stripMarkup } from "@/components/site/rich-text";
import type { Product } from "@/lib/types";
import { useBusinessUnits, useProducts } from "@/hooks/use-cms";
import { BUSINESS_UNITS } from "@/data/placeholder-content";

export const Route = createFileRoute("/business/$unit/")({
  loader: ({ params }) => {
    const unit = BUSINESS_UNITS.find((u) => u.slug === params.unit);
    if (!unit) throw notFound();
    return { name: unit.name, tagline: unit.tagline, summary: unit.summary };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Brand not found | Blueworld Cosmetics" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.name} | Blueworld Cosmetics`;
    return {
      meta: [
        { title },
        { name: "description", content: stripMarkup(loaderData.summary).slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: stripMarkup(loaderData.tagline) },
      ],
    };
  },
  component: BusinessUnitPage,
});

function BusinessUnitPage() {
  const { unit: slug } = Route.useParams();
  const { data: units, isLoading } = useBusinessUnits();
  const { data: products } = useProducts();
  const unit = units?.find((u) => u.slug === slug);
  const unitProducts = useMemo(() => (products ?? []).filter((p) => p.unit === slug), [products, slug]);

  if (isLoading && !unit) {
    return (
      <Section>
        <LoadingBlock label="Loading brand…" />
      </Section>
    );
  }
  if (!unit) {
    return (
      <Section>
        <EmptyBlock label="This brand is not published yet." />
      </Section>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Business"
        title={unit.name}
        description={unit.tagline}
        image={unit.heroImage}
        {...(unit.mobileHeroImage ? { mobileImage: unit.mobileHeroImage } : {})}
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Brand story"
              title={<>Inside <span className="rt-mark">{unit.name}</span></>}
            />
            <RichParagraphs className="mt-8" paragraphs={splitParagraphs(unit.story)} />
            {unit.readMoreUrl && (
              <AppLink
                href={unit.readMoreUrl}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-xs font-bold uppercase tracking-[0.16em] text-accent-foreground transition-colors hover:bg-primary-deep hover:text-primary-foreground"
              >
                Read More <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
              </AppLink>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl border border-border shadow-card lg:sticky lg:top-28">
            {unit.mobileHeroImage ? (
              <picture className="block">
                <source media="(max-width: 767px)" srcSet={resolveImage(unit.mobileHeroImage, 1200)} />
                <img
                  src={resolveImage(unit.heroImage)}
                  alt={unit.name}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/5] w-full object-cover md:aspect-[4/3]"
                />
              </picture>
            ) : (
              <CmsImage
                src={unit.heroImage}
                alt={unit.name}
                className="aspect-[4/3] w-full object-cover"
              />
            )}
          </div>
        </div>
      </Section>

      {unit.subLines && unit.subLines.length > 0 && (
        <Section tone="muted">
          <SectionHeading
            eyebrow="Product ranges"
            title={`${unit.name} is built from three ranges`}
            description="Each range has its own chemistry, testing protocol and audience."
          />
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {unit.subLines.map((line) => (
              <Link
                key={line.slug}
                to="/business/$unit/$line"
                params={{ unit: unit.slug, line: line.slug }}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="aspect-[4/3] overflow-hidden bg-secondary">
                  <CmsImage
                    src={line.heroImage}
                    alt={line.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-lg font-bold text-primary-deep">{line.name}</h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-accent">
                    {line.tagline}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {line.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section>
        <SectionHeading eyebrow="Catalogue" title={`${unit.name} products`} />
        <div className="mt-12">
          {unitProducts.length === 0 ? (
            <EmptyBlock label="No products published for this brand yet." />
          ) : (
            <ProductBrowser products={unitProducts} label={unit.name} />
          )}
        </div>
      </Section>

    </>
  );
}
