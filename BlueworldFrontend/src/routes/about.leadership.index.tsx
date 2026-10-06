import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AppLink } from "@/components/site/app-link";
import { CmsImage, EmptyBlock, LoadingBlock, PageHero, Section, SectionHeading } from "@/components/site/primitives";
import { useTeamMembers } from "@/hooks/use-cms";
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
        content: "The people accountable for every batch that leaves the Ikeja plant.",
      },
    ],
  }),
  component: LeadershipPage,
});

function LeadershipPage() {
  const { data, isLoading } = useTeamMembers();
  const members = [...(data ?? [])].sort((a, b) => a.order - b.order);
  const featured = members.find((m) => m.isFeatured);
  const rest = members.filter((m) => m.id !== featured?.id);

  return (
    <>
      <HeroFlag />
      <PageHero
        eyebrow="About us"
        title="Leadership"
        description="Our strength lies in visionary leadership that inspires growth, drives innovation, and ensures sustainability across every brand we run."
        
      />

      {/* Mission & Vision — a confident, editorial statement before the people themselves */}
      <Section className="py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="eyebrow"
          >
            Our Vision
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 font-display text-xl font-bold leading-relaxed text-primary-deep sm:text-2xl"
          >
            To be among the globally accepted, most sought-after, user and eco-friendly, quality and affordable cosmetics products manufacturing company in Nigeria.
          </motion.p>
          <br />
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="eyebrow"
          >
            Our Mission
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 font-display text-xl font-bold leading-relaxed text-primary-deep sm:text-2xl"
          >
            To Produce and Market quality, safe and affordable cosmetics products in an eco-friendly manner.
          </motion.p>
          <br />
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="eyebrow"
          >
            Our Core Values
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 font-display text-xl font-bold leading-relaxed text-primary-deep sm:text-2xl"
          >
            <span className="block">Quality Customer Experience</span>
            <span className="mt-3 block">Safe and Healthy Workplace for all employees</span>
            <span className="mt-3 block">Honesty, Transparency &amp; Strict adherence to Statutory standards and Practices</span>
            <span className="mt-3 block">Proactiveness &amp; Innovation</span>
            <span className="mt-3 block">Teamwork and Participatory decision-making</span>
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
        <Section tone="muted" className="py-16 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16"
          >
            <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-full border-4 border-white shadow-lift">
              <CmsImage src={featured.photo} alt={featured.name} className="h-full w-full object-cover" eager />
            </div>
            <div>
              <p className="eyebrow">Meet our founder &amp; chief visionary</p>
              <h2 className="mt-3 font-display text-2xl font-extrabold text-primary-deep sm:text-3xl">
                {featured.name}
              </h2>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.14em] text-accent">{featured.role}</p>
              <div className="mt-2 h-px w-16 bg-accent" />
              <p className="mt-4 line-clamp-4 text-base leading-relaxed text-muted-foreground">
                {featured.bio.split("\n\n")[0]}
              </p>
              <AppLink
                href={`/about/leadership/${memberSlug(featured)}`}
                className="mt-6 inline-flex items-center border-2 border-primary-deep px-6 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-primary-deep transition-colors hover:bg-primary-deep hover:text-primary-foreground"
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
        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {rest.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: (i % 5) * 0.06 }}
            >
              <AppLink href={`/about/leadership/${memberSlug(member)}`} className="group block text-center">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-secondary">
                  <CmsImage
                    src={member.photo}
                    alt={member.name}
                    className="h-full w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-110 group-hover:grayscale-0"
                  />
                  {/* Diagonal shine sweep — same treatment as the business-unit cards */}
                  <div className="pointer-events-none absolute inset-0 -translate-x-[150%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-[150%]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-full flex-col justify-end bg-gradient-to-t from-black/75 via-black/10 to-transparent p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-accent">
                      View profile →
                    </span>
                  </div>
                </div>
                <h3 className="mt-3 font-display text-sm font-bold text-primary-deep">{member.name}</h3>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {member.role}
                </p>
              </AppLink>
            </motion.div>
          ))}
        </div>
      </Section>
    </>
  );
}