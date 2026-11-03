import type { ReactNode } from "react";
import { PageHero } from "@/components/site/primitives";
import { usePage } from "@/hooks/use-cms";

/**
 * The top banner of a page whose layout lives in the code (Contact, Career, Blog...).
 * Whatever is set in the CMS under Pages (text, photo, mobile photo) wins; anything left blank
 * falls back to the built-in values passed in here, so the page never ends up empty.
 */
export function CmsPageHero({
  slug,
  eyebrow,
  title,
  description,
  image,
  children,
}: {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  children?: ReactNode;
}) {
  const { data: page } = usePage(slug);
  return (
    <PageHero
      eyebrow={page?.eyebrow || eyebrow}
      title={page?.title || title}
      description={page?.description || description}
      image={page?.heroImage || image}
      {...(page?.mobileHeroImage ? { mobileImage: page.mobileHeroImage } : {})}
    >
      {children}
    </PageHero>
  );
}