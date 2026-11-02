import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SiteHeader } from "../components/site/site-header";
import { SiteFooter } from "../components/site/site-footer";
import { WhatsAppButton } from "../components/site/whatsapp-button";
import { Toaster } from "../components/ui/sonner";

import appCss from "../styles.css?url";
import { reportError } from "../lib/error-reporting";
import { useAnalytics } from "../lib/analytics";

import { HeroProvider, useHasHero } from "../components/site/hero-context";
import { cn } from "../lib/utils";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <img
          src="/blueworld.png"
          alt="Blue World Cosmetics"
          className="mx-auto h-20 w-20 object-cover"
          draggable={false}
        />
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-accent">Error 404</p>
        <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight text-primary-deep">
          Page not found
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center bg-accent px-6 py-3 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-accent-foreground transition-colors hover:opacity-90"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}



function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportError(error, { boundary: "tanstack_root_error_component" });
    // After a new deploy, an already-open tab asks for JS files that no longer exist.
    // Reload once to pick up the new version (the flag stops it from looping).
    if (/dynamically imported module|importing a module script|loading chunk|chunkloaderror/i.test(error.message)) {
      try {
        if (!sessionStorage.getItem("bwc.chunk-reload")) {
          sessionStorage.setItem("bwc.chunk-reload", "1");
          window.location.reload();
        }
      } catch {
        /* storage unavailable: show the normal error screen */
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <img
          src="/blueworld.png"
          alt="Blue World Cosmetics"
          className="mx-auto h-20 w-20 object-cover"
          draggable={false}
        />
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-accent">
          Something went wrong
        </p>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-primary-deep">
          This page didn't load
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Something went wrong on our end. You can try again or head back home.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center bg-accent px-6 py-3 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-accent-foreground transition-colors hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center border border-primary-deep px-6 py-3 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-deep transition-colors hover:bg-primary-deep hover:text-primary-foreground"
          >
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) ?? "https://blueworldcosmetics.ng";
const OG_IMAGE = `${SITE_URL}/blueworld.png`;




export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { title: "Blue World Cosmetics — Nigerian Cosmetics Manufacturer" },
      {
        name: "description",
        content:
          "Blue World Cosmetics manufactures skincare, hygiene, haircare and fragrance brands in Lagos, Nigeria for markets across Africa and Asia.",
      },
      { name: "author", content: "Blue World Cosmetics Limited" },
      { property: "og:site_name", content: "Blue World Cosmetics" },
      { property: "og:title", content: "Blue World Cosmetics" },
      {
        property: "og:description",
        content: "A Nigerian multi-brand cosmetics manufacturing house. God Is Our Strength.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "256" },
      { property: "og:image:height", content: "256" },
      { property: "og:image:alt", content: "Blue World Cosmetics logo" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Blue World Cosmetics" },
      {
        name: "twitter:description",
        content: "A Nigerian multi-brand cosmetics manufacturing house. God Is Our Strength.",
      },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/blueworld.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/blueworld.png" },
      { rel: "preconnect", href: "https://res.cloudinary.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&display=swap",
      },
    ],
  }),



  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isAdmin = useRouterState({ select: (s) => s.location.pathname.startsWith("/admin") });
  useAnalytics();

  return (
    <QueryClientProvider client={queryClient}>
      <HeroProvider>
        <AppShell isAdmin={isAdmin} />
      </HeroProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

function AppShell({ isAdmin }: { isAdmin: boolean }) {
  const hasHero = useHasHero();
  return (
   <div className="flex min-h-dvh flex-col">
      {!isAdmin && <SiteHeader />}
      <div className={cn("flex-1", !isAdmin && !hasHero && "pt-20")}>
        <Outlet />
      </div>
      {!isAdmin && <SiteFooter />}
      {!isAdmin && <WhatsAppButton />}
    </div>
  );
}