import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AppLink } from "@/components/site/app-link";
import { CmsImage, EmptyBlock, Hl, LoadingBlock, PageHero, Section, SectionHeading } from "@/components/site/primitives";
import { useTeamMembers, usePage } from "@/hooks/use-cms";
import { HeroFlag } from "@/components/site/hero-context";
import { memberSlug } from "@/lib/team-slug";

export const Route = createFileRoute("/about/leadership/")({
  head: () => ({
    meta: [
      { title: "Leadership — Blue World Cosmetics" },
      {
        name: "description",
        content:
          "Meet the executive team running manufacturing, brands, R&D and commercial operations at Blue World Cosmetics.",
      },
      { property: "og:title", content: "Leadership — Blue World Cosmetics" },
      {
        property: "og:description",
        content: "The people accountable for every batch that leaves the Organization, and every brand that carries our name.",
      },
    ],
  }),
  component: LeadershipPage,
});

function LeadershipPage() {
  const { data, isLoading } = useTeamMembers();
  const { data: page } = usePage("about/leadership");
  const members = [...(data ?? [])].sort((a, b) => a.order - b.order);
  const featured = members.find((m) => m.isFeatured);
  const rest = members.filter((m) => m.id !== featured?.id);

  return (
    <>
      <HeroFlag />
        <PageHero
        eyebrow={page?.eyebrow || "About us"}
        title={page?.title || "Leadership"}
        description={
          page?.description ||
          "Our strength lies in visionary leadership that inspires growth, drives innovation, and ensures sustainability across every brand we run."
        }
        image={page?.heroImage || undefined}
      />

      {/* Mission & Vision — a confident, editorial statement before the people themselves */}
      <Section className="py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="font-display text-sm font-bold uppercase tracking-[0.3em] text-accent"
          >
            Our Vision
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 font-display text-xl leading-relaxed text-primary-deep sm:text-2xl"
          >
            To be among the <Hl>globally accepted</Hl>, most sought-after, user and eco-friendly, <Hl>quality and affordable</Hl> cosmetics products manufacturing company in Nigeria.
          </motion.p>
          <div className="mx-auto my-12 h-px w-16 bg-accent" />
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="font-display text-sm font-bold uppercase tracking-[0.3em] text-accent"
          >
            Our Mission
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 font-display text-xl leading-relaxed text-primary-deep sm:text-2xl"
          >
            To produce and market <Hl>quality</Hl>, <Hl>safe</Hl> and <Hl>affordable</Hl> cosmetics products in an eco-friendly manner.
          </motion.p>
        </div>
      </Section>

      {/* Featured leader — the MD/Chief Visionary spotlight */}
      {isLoading && (
        <Section tone="muted">
          <LoadingBlock label="Loading leadership…" />
        </Section>
      )}

      {!isLoading && featured && (
        <Section tone="muted" className="py-20 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="mx-auto grid max-w-5xl items-center gap-10 text-center lg:grid-cols-[340px_1fr] lg:gap-16 lg:text-left"
          >
            <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-full border-4 border-white shadow-lift lg:max-w-[340px]">
              <CmsImage src={featured.photo} alt={featured.name} className="h-full w-full object-cover" eager />
            </div>
            <div>
              <p className="eyebrow">Meet our founder &amp; chief visionary</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold text-primary-deep sm:text-4xl">
                {featured.name}
              </h2>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.14em] text-accent">{featured.role}</p>
              <div className="mx-auto mt-3 h-px w-24 bg-accent lg:mx-0" />
              <p className="mt-5 line-clamp-6 text-base leading-relaxed text-muted-foreground lg:text-lg">
                {featured.bio.split("\n\n")[0]}
              </p>
              <AppLink
                href={`/about/leadership/${memberSlug(featured)}`}
                className="btn-corporate mt-6"
              >
                Read full profile →
              </AppLink>
            </div>
          </motion.div>
        </Section>
      )}

      {/* The rest of the leadership team — hover reveals name/role in color,
          others stay desaturated; click opens their own profile page. */}
      <Section className="py-16 lg:py-20">
        <SectionHeading
          eyebrow="Leadership"
          title="The team behind every brand"
          align="center"
          description="Each member brings their own discipline to the same standard — click through for their full story."
        />
        {!isLoading && rest.length === 0 && !featured && <EmptyBlock label="No leadership profiles published yet." />}
        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
          {rest.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: (i % 4) * 0.06 }}
            >
              <AppLink href={`/about/leadership/${memberSlug(member)}`} className="group block text-center">
                <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-secondary shadow-card">
                  <CmsImage
                    src={member.photo}
                    alt={member.name}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  {/* Diagonal shine sweep — same treatment as the business-unit cards */}
                  <div className="pointer-events-none absolute inset-0 -translate-x-[150%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-[150%]" />
                  <span className="pointer-events-none absolute bottom-0 left-0 h-1 w-0 bg-accent transition-all duration-500 group-hover:w-full" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-primary-deep">{member.name}</h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-accent">{member.role}</p>
                <span className="mt-2 block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary-deep opacity-0 transition-opacity duration-300 group-hover:opacity-100">View profile →</span>
              </AppLink>
            </motion.div>
          ))}
        </div>
      </Section>
    </>
  );
}