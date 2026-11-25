import { createFileRoute } from "@tanstack/react-router";
import { CmsPageView } from "@/components/site/cms-page";
import { usePage } from "@/hooks/use-cms";
import { LoadingBlock, ErrorBlock, Section } from "@/components/site/primitives";

export const Route = createFileRoute("/about/who-we-are")({
  head: () => ({
    meta: [
      { title: "Who We Are | Blueworld Cosmetics" },
      {
        name: "description",
        content:
          "Inside Blueworld Cosmetics: two production lines, an in-house R&D lab and NAFDAC-certified quality control in Ikeja, Lagos.",
      },
      { property: "og:title", content: "Who We Are | Blueworld Cosmetics" },
      {
        property: "og:description",
        content: "The Organization, the people and the standards behind five Nigerian personal-care brands.",
      },
    ],
  }),
  component: WhoWeArePage,
});

function WhoWeArePage() {
  const { data: page, isLoading, isError } = usePage("about/who-we-are");

  if (isLoading) {
    return (
      <Section>
        <LoadingBlock label="Loading page…" />
      </Section>
    );
  }
  if (isError || !page) {
    return (
      <Section>
        <ErrorBlock label="This page isn't published yet, check Pages in the CMS." />
      </Section>
    );
  }

  return <CmsPageView page={page} />;
}