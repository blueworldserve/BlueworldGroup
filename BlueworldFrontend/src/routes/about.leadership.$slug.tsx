import { createFileRoute, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AppLink } from "@/components/site/app-link";
import { CmsImage, EmptyBlock, LoadingBlock, Section } from "@/components/site/primitives";
import { useTeamMembers } from "@/hooks/use-cms";
import { HeroFlag } from "@/components/site/hero-context";

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
  const member = data?.find((m) => m.slug === slug);

  if (isLoading) {
    return (
      <Section>
        <LoadingBlock label="Loading profile…" />
      </Section>
    );
  }

  if (!member) {
    return (
      <Section>
        <EmptyBlock label="This profile isn't published, or the link is out of date." />
        <div className="mt-6 text-center">
          <AppLink href="/about/leadership" className="text-sm font-bold text-accent">
            ← Back to Leadership
          </AppLink>
        </div>
      </Section>
    );
  }

  return (
    <>
      <HeroFlag />
      <div className="bg-primary-deep pb-6 pt-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/60">
            <AppLink href="/about/leadership" className="hover:text-accent">
              About Us
            </AppLink>
            {" / "}
            <AppLink href="/about/leadership" className="hover:text-accent">
              Leadership
            </AppLink>
            {" / "}
            <span className="text-primary-foreground/90">{member.name}</span>
          </p>
        </div>
      </div>

      <Section className="py-14 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14"
        >
          <div className="overflow-hidden rounded-3xl shadow-lift">
            <CmsImage src={member.photo} alt={member.name} className="aspect-[4/5] w-full object-cover" eager />
          </div>
          <div>
            <h1 className="font-display text-3xl font-extrabold text-primary-deep sm:text-4xl">{member.name}</h1>
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.16em] text-accent">{member.role}</p>
            <div className="mt-4 h-px w-20 bg-primary-deep/15" />
            <div className="mt-6 space-y-4">
              {member.bio.split("\n\n").map((para) => (
                <p key={para.slice(0, 32)} className="text-base leading-relaxed text-muted-foreground">
                  {para}
                </p>
              ))}
            </div>
            <AppLink
              href="/about/leadership"
              className="mt-8 inline-flex items-center border-2 border-primary-deep px-6 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-primary-deep transition-colors hover:bg-primary-deep hover:text-primary-foreground"
            >
              ← Back to Leadership
            </AppLink>
          </div>
        </motion.div>
      </Section>
    </>
  );
}