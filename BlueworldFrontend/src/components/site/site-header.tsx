import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AppLink } from "@/components/site/app-link";
import { CmsImage } from "@/components/site/primitives";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { stripMarkup } from "@/components/site/rich-text";
import { useBusinessUnits } from "@/hooks/use-cms";

type NavChild = {
  label: string;
  to: string;
  description?: string | undefined;
  image?: string | undefined;
};

type NavItem = {
  label: string;
  to: string;
  blurb?: string | undefined;
  children?: NavChild[] | undefined;
};

/** Items listed here open the wide mega menu. Every other item with children gets a simple dropdown. */
const MEGA_ITEMS = new Set(["Business"]);

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
    to: "/business",
    blurb: "Five brands, one manufacturing house. Pick a brand to see what it makes.",
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
            .map((u) => ({
              label: u.name,
              to: `/business/${u.slug}`,
              description: stripMarkup(u.tagline),
              image: u.heroImage,
            })),
        }
      : item,
  );

  const [openMobile, setOpenMobile] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [previewTo, setPreviewTo] = useState<string | null>(null);

  const openItem = navItems.find((i) => i.label === openMenu && i.children?.length);
  const megaItem = openItem && MEGA_ITEMS.has(openItem.label) ? openItem : undefined;

  // Glass-over-hero until the user scrolls, hovers the bar, opens a menu or the mobile drawer.
  const transparent = !scrolled && !openMobile && !hovered && !openItem;

  const togglePanel = (label: string) => {
    setOpenMenu((c) => (c === label ? null : label));
    setPreviewTo(null);
  };
  const showPanel = (label: string) => {
    setOpenMenu(label);
    setPreviewTo(null);
  };

  useEffect(() => {
    setScrolled(false);
    const onScroll = () => setScrolled(window.scrollY > 40);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  // Close menus on every route change.
  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMenu]);

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

  const linkBase =
    "rounded-xl px-2.5 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.12em] transition-colors duration-200 xl:px-3";

  return (
    <>
      <header
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setOpenMenu(null);
        }}
        className="fixed inset-x-2 top-2 z-50 mx-auto max-w-7xl"
      >
        {/* Glass layer is its own element (not on <header>) so the mega panel can blur the page too. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 rounded-2xl border backdrop-blur-xl transition-all duration-500 ease-out",
            transparent
              ? "border-white/15 bg-primary-deep/25 shadow-none"
              : "border-border/60 bg-background/70 shadow-lg shadow-black/5",
          )}
        />

        <div className="box-content flex h-14 items-center justify-between gap-4 p-2">
          <Link to="/" className="group flex items-center gap-3" onClick={() => setOpenMobile(false)}>
            <img
              src="/blueworld.png"
              alt="Blue World Cosmetics"
              className="h-12 w-12 rounded-xl object-cover"
              draggable={false}
            />
            <span className="flex flex-col leading-none">
              <span
                className={cn(
                  "font-display text-[1.02rem] font-extrabold tracking-tight transition-colors",
                  transparent ? "text-white" : "text-primary-deep",
                )}
              >
                BLUE WORLD
              </span>
              <span
                className={cn(
                  "mt-1 text-[0.6rem] font-bold uppercase tracking-[0.28em] transition-colors",
                  transparent ? "text-white/80" : "text-accent",
                )}
              >
                Cosmetics
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex">
            {navItems.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to.split("?")[0]!);
              const tone = cn(
                linkBase,
                transparent
                  ? "text-white/90 hover:bg-white/10"
                  : "text-foreground/80 hover:bg-primary-soft hover:text-primary-deep",
                active && (transparent ? "bg-white/10 text-white" : "bg-primary-soft text-primary-deep"),
              );
              if (!item.children?.length) {
                return (
                  <div key={item.label} onMouseEnter={() => setOpenMenu(null)}>
                    <AppLink href={item.to} className={cn("block", tone)}>
                      {item.label}
                    </AppLink>
                  </div>
                );
              }
              const isOpen = openMenu === item.label;
              const isMega = MEGA_ITEMS.has(item.label);
              return (
                <div key={item.label} className="relative" onMouseEnter={() => showPanel(item.label)}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    onClick={() => togglePanel(item.label)}
                    className={cn("flex items-center gap-1", tone, isOpen && !transparent && "bg-primary-soft text-primary-deep")}
                  >
                    {item.label}
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                  </button>

                  {/* Simple dropdown for every item that is not a mega menu. */}
                  <AnimatePresence>
                    {!isMega && isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        // The top padding is an invisible bridge so the pointer can cross the gap without closing the menu.
                        className="absolute left-0 top-full w-64 pt-[1.625rem]"
                      >
                        <div className="rounded-2xl border border-border/60 bg-background/85 p-2 shadow-lift backdrop-blur-2xl">
                          {item.children.map((child) => (
                            <AppLink
                              key={child.label}
                              href={child.to}
                              onClick={() => setOpenMenu(null)}
                              className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground/85 transition-colors hover:bg-primary-soft hover:text-primary-deep"
                            >
                              {child.label}
                            </AppLink>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          <div className="hidden lg:block" onMouseEnter={() => setOpenMenu(null)}>
            <Link
              to="/contact"
              className={cn(
                "inline-flex items-center rounded-xl px-5 py-3 text-[0.72rem] font-bold uppercase tracking-[0.16em] transition-colors duration-200",
                transparent
                  ? "border border-white/70 text-white hover:bg-white hover:text-primary-deep"
                  : "bg-accent text-accent-foreground hover:opacity-90",
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
              "grid h-11 w-11 place-items-center rounded-xl border transition-colors lg:hidden",
              transparent ? "border-white/50 text-white" : "border-border text-primary-deep",
            )}
          >
            {openMobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {megaItem && (
            <MegaPanel
              key={megaItem.label}
              item={megaItem}
              previewTo={previewTo}
              onPreview={setPreviewTo}
              onNavigate={() => setOpenMenu(null)}
            />
          )}
        </AnimatePresence>
      </header>

      {/* Drawer sits OUTSIDE <header> so position:fixed is never trapped by an ancestor. */}
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
                  className="grid h-10 w-10 place-items-center rounded-xl border border-border text-primary-deep"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-5 py-4">
                {navItems.map((item) => (
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
                                {item.label === "Business" && (
                                  <AppLink
                                    href="/business"
                                    onClick={() => setOpenMobile(false)}
                                    className="block py-2.5 text-base font-bold text-accent"
                                  >
                                    View Businesses
                                  </AppLink>
                                )}
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

/**
 * Mega menu (Business only): same width as the nav. Column 1 introduces the section,
 * columns 2 and 3 hold the links, column 4 previews whichever link is hovered or focused.
 */
function MegaPanel({
  item,
  previewTo,
  onPreview,
  onNavigate,
}: {
  item: NavItem;
  previewTo: string | null;
  onPreview: (to: string) => void;
  onNavigate: () => void;
}) {
  const children = item.children ?? [];
  const half = Math.ceil(children.length / 2);
  const columns = [children.slice(0, half), children.slice(half)];
  const active = children.find((c) => c.to === previewTo) ?? children[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      // pt-2 is an invisible bridge so the pointer can cross the gap without closing the menu.
      className="absolute inset-x-0 top-full pt-2"
    >
      <div className="grid grid-cols-[1.1fr_1fr_1fr_1.2fr] gap-2 rounded-2xl border border-border/60 bg-background/80 p-2 shadow-lift backdrop-blur-2xl">
        <div className="flex flex-col justify-between p-4">
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-accent">{item.label}</p>
            <h3 className="mt-2 font-display text-2xl font-bold leading-tight text-primary-deep">Our brands</h3>
            {item.blurb && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.blurb}</p>}
          </div>
          <AppLink
            href={item.to}
            onClick={onNavigate}
            className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary-deep transition-colors hover:text-accent"
          >
            View Businesses
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
          </AppLink>
        </div>

        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-1 py-2">
            {col.map((child) => (
              <div key={child.to} onMouseEnter={() => onPreview(child.to)} onFocus={() => onPreview(child.to)}>
                <AppLink
                  href={child.to}
                  onClick={onNavigate}
                  className={cn(
                    "block rounded-xl border-l-2 border-transparent p-3 transition-all hover:bg-primary-soft",
                    active?.to === child.to && "border-accent bg-primary-soft pl-4",
                  )}
                >
                  <span className="block text-sm font-bold text-primary-deep">{child.label}</span>
                  {child.description && (
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{child.description}</span>
                  )}
                </AppLink>
              </div>
            ))}
          </div>
        ))}

        <div className="relative min-h-[17rem] overflow-hidden rounded-xl bg-primary-deep">
          <AnimatePresence mode="wait">
            {active && (
              <motion.div
                key={active.to}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0"
              >
                <AppLink href={active.to} onClick={onNavigate} className="relative block h-full w-full">
                  {active.image ? (
                    <CmsImage src={active.image} alt={active.label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_60%)]" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-white">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-accent">Highlighted</p>
                    <p className="mt-1 font-display text-lg font-bold leading-tight">{active.label}</p>
                    {active.description && <p className="mt-1 text-xs text-white/80">{active.description}</p>}
                  </div>
                </AppLink>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}