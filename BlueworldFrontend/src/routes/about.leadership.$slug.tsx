import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AppLink } from "@/components/site/app-link";
import { CmsImage, EmptyBlock, LoadingBlock, Section } from "@/components/site/primitives";
import { useTeamMembers } from "@/hooks/use-cms";
import { HeroFlag } from "@/components/site/hero-context";
import { memberSlug } from "@/lib/team-slug";

export const Route = createFileRoute("/about/leadership/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Blue World Cosmetics` },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: LeaderProfilePage,
});

function LeaderProfilePage() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useTeamMembers();
  const member = data?.find((m) => memberSlug(m) === slug);

  if (isLoading) return <Section><LoadingBlock label="Loading profile…" /></Section>;

  if (!member) {
    return (
      <Section>
        <EmptyBlock label="This profile isn't published, or the link is out of date." />
        <div className="mt-6 text-center">
          <AppLink href="/about/leadership" className="btn-corporate-outline">← Back to Leadership</AppLink>
        </div>
      </Section>
    );
  }

  return (
    <>
      <HeroFlag />
      <div className="bg-primary-deep pb-6 pt-28 lg:pt-32">
        <nav className="mx-auto max-w-6xl px-5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70 lg:px-8">
          <AppLink href="/about" className="text-accent">About us</AppLink>
          <span className="mx-2">/</span>
          <AppLink href="/about/leadership" className="hover:text-white">Leadership</AppLink>
          <span className="mx-2">/</span>
          <span className="text-white">{member.name}</span>
        </nav>
      </div>

      <section className="bg-background py-14 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20 lg:px-8"
        >
          <div className="relative mx-auto mb-3 mr-3 w-full max-w-md lg:max-w-none">
            <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 border border-accent" />
            <CmsImage src={member.photo} alt={member.name} className="relative aspect-[4/5] w-full object-cover shadow-lift" eager />
          </div>

          <div className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
            <p className="eyebrow">{member.role}</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-primary-deep sm:text-5xl">{member.name}</h1>
            <div className="mx-auto mt-5 h-0.5 w-16 bg-accent lg:mx-0" />
            <div className="mt-8 space-y-5 text-left">
              {member.bio.split("\n\n").map((para) => (
                <p key={para.slice(0, 32)} className="text-[1.05rem] leading-8 text-primary-deep/90 lg:text-justify lg:[hyphens:auto]">
                  {para}
                </p>
              ))}
            </div>
            <div className="mt-10">
              <AppLink href="/about/leadership" className="btn-corporate">← Back to Leadership</AppLink>
            </div>
          </div>
        </motion.div>
      </section>
    </>
  );
}