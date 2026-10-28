import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AppLink } from "@/components/site/app-link";
import { ChevronDown, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBusinessUnits } from "@/hooks/use-cms";

type NavItem = {
  label: string;
  to: string;
  children?: { label: string; to: string }[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", to: "/" },
  {
    label: "About Us",
    to: "/about",
    children: [
      { label: "Who We Are", to: "/about/who-we-are" },
      { label: "Vision & Mission", to: "/about/vision-mission" },
      { label: "Leadership", to: "/about/leadership" },
    ],
  },
  {
    label: "Business",
    to: "/business/vivon",
    children: [
      { label: "Vivon", to: "/business/vivon" },
      { label: "BlueCrystal", to: "/business/bluecrystal" },
      { label: "Blow Right", to: "/business/blow-right" },
      { label: "BlueFragrance", to: "/business/bluefragrance" },
      { label: "BlueWorld Cosmetics", to: "/business/blueworld-cosmetics" },
    ],
  },
  { label: "Products", to: "/products" },
  { label: "Career", to: "/career" },
  {
    label: "Blog",
    to: "/blog",
    children: [
      { label: "Latest Posts", to: "/blog" },
      { label: "Company News", to: "/blog?category=Company+News" },
      { label: "Research & Development", to: "/blog?category=Research+%26+Development" },
    ],
  },
  { label: "Contact", to: "/contact" },
];

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // The Business menu follows the order set in Admin → Business Units.
  const units = useBusinessUnits();
  const navItems: NavItem[] = NAV_ITEMS.map((item) =>
    item.label === "Business" && units.data && units.data.length > 0
      ? {
          ...item,
          children: [...units.data]
            .sort((a, b) => a.order - b.order)
            .map((u) => ({ label: u.name, to: `/business/${u.slug}` })),
        }
      : item,
  );

  const [openMobile, setOpenMobile] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Transparent on EVERY page, on every fresh load and every client-side
  // navigation, until the user scrolls, hovers the bar, or opens the mobile
  // menu. No route is special-cased.
  const transparent = !scrolled && !openMobile && !hovered;

  useEffect(() => {
    // A client-side route change keeps this component mounted with its old
    // state — always reset to "not scrolled" the instant the route changes,
    // then hand off to the real scroll position on the next paint (by which
    // point the router's own scroll-restoration has settled).
    setScrolled(false);
    const onScroll = () => setScrolled(window.scrollY > 40);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  useEffect(() => {
    if (!openMobile) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenMobile(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openMobile]);

  return (
    <>
    <header
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "fixed top-0 left-0 z-50 w-full transition-all duration-500 ease-out",
        transparent
          ? "border-transparent bg-transparent shadow-none"
          : "border-b border-border/70 bg-background/95 backdrop-blur-xl shadow-sm",
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 lg:px-8">
        <Link to="/" className="group flex items-center gap-3" onClick={() => setOpenMobile(false)}>
          <img
            src="/blueworld.png"
            alt="Blue World Cosmetics"
            className="h-14 w-14 object-cover"
            draggable={false}
          />
          <span className="flex flex-col leading-none">
            <span
              className={cn(
                "font-display text-[1.05rem] font-extrabold tracking-tight transition-colors",
                transparent ? "text-white" : "text-primary-deep",
              )}
            >
              BLUE WORLD
            </span>
            <span
              className={cn(
                "mt-1 text-[0.62rem] font-bold uppercase tracking-[0.28em] transition-colors",
                transparent ? "text-white/80" : "text-accent",
              )}
            >
              Cosmetics
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to.split("?")[0]!);
            if (!item.children) {
              return (
                <AppLink
                  key={item.label}
                  href={item.to}
                  className={cn(
                    "px-3 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] transition-colors duration-200",
                    transparent
                      ? "text-white/90 hover:text-accent"
                      : "text-foreground/80 hover:text-accent",
                    active && (transparent ? "text-white" : "text-primary-deep"),
                  )}
                >
                  {item.label}
                </AppLink>
              );
            }
            return (
              <div key={item.label} className="group relative">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 px-3 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] transition-colors duration-200",
                    transparent
                      ? "text-white/90 hover:text-accent"
                      : "text-foreground/80 hover:text-accent",
                    active && (transparent ? "text-white" : "text-primary-deep"),
                  )}
                >
                  {item.label}
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                </button>
                <div className="invisible absolute left-0 top-full w-64 translate-y-2 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="overflow-hidden border border-border bg-card p-2 shadow-lift">
                    {item.children.map((child) => (
                      <AppLink
                        key={child.label}
                        href={child.to}
                        className="block px-4 py-2.5 text-sm text-foreground/85 transition-colors hover:bg-primary-soft hover:text-primary-deep"
                      >
                        {child.label}
                      </AppLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <Link
            to="/contact"
            className={cn(
              "inline-flex items-center px-6 py-3 text-[0.72rem] font-bold uppercase tracking-[0.16em] transition-colors duration-200",
              transparent
                ? "border border-white/70 text-white hover:bg-white hover:text-primary-deep"
                : "bg-accent text-accent-foreground",
            )}
          >
            Talk to sales
          </Link>
        </div>

        <button
          type="button"
          aria-label={openMobile ? "Close menu" : "Open menu"}
          onClick={() => setOpenMobile((v) => !v)}
          className={cn(
            "grid h-11 w-11 place-items-center border lg:hidden transition-colors",
            transparent ? "border-white/50 text-white" : "border-border text-primary-deep",
          )}
        >
          {openMobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
    </header>

    {/* Drawer sits OUTSIDE <header>: the header's backdrop-blur would otherwise trap position:fixed. */}
    <AnimatePresence>
      {openMobile && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-[60] bg-black/55 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpenMobile(false)}
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="fixed right-0 top-0 z-[70] flex h-full w-[86%] max-w-sm flex-col bg-background shadow-2xl lg:hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex h-20 shrink-0 items-center justify-between border-b border-border px-5">
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpenMobile(false)}
                className="grid h-10 w-10 place-items-center border border-border text-primary-deep"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-5 py-4">
              {NAV_ITEMS.map((item) => (
                <div key={item.label} className="border-b border-border/70">
                  {item.children ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpenAccordion((c) => (c === item.label ? null : item.label))}
                        className="flex w-full items-center justify-between py-4 text-left text-xl font-bold text-primary-deep"
                      >
                        {item.label}
                        <ChevronDown className={cn("h-4 w-4 transition-transform", openAccordion === item.label && "rotate-180")} />
                      </button>
                      <AnimatePresence initial={false}>
                        {openAccordion === item.label && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="mb-3 ml-1 border-l-2 border-accent pl-4">
                              {item.children.map((child) => (
                                <AppLink
                                  key={child.label}
                                  href={child.to}
                                  onClick={() => setOpenMobile(false)}
                                  className="block py-2.5 text-base text-foreground/80 hover:text-accent"
                                >
                                  {child.label}
                                </AppLink>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <AppLink
                      href={item.to}
                      onClick={() => setOpenMobile(false)}
                      className="block py-4 text-xl font-bold text-primary-deep"
                    >
                      {item.label}
                    </AppLink>
                  )}
                </div>
              ))}
            </nav>

            <div className="shrink-0 border-t border-border p-5">
              <Link to="/contact" onClick={() => setOpenMobile(false)} className="btn-corporate w-full">
                Talk to sales
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
    </>
  );
}