import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Globe2,
  Images,
  Inbox,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Newspaper,
  Package,
  Settings,
  Sparkles,
  Users,
  Briefcase,
  UserCheck,
  X,
  FileText,
  ScrollText,
  ClipboardList,
  BarChart3,
  Reply,
} from "lucide-react";
import { getAdminUser, logout, useAdminUser } from "@/hooks/use-admin-auth";
import { apiFetch } from "@/lib/api";
import { BrandGlobe } from "@/components/brand/brand-globe";
import { cn } from "@/lib/utils";
import { useCmsSourceAlerts } from "@/hooks/use-cms-source-alerts";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { useCmsThemeScope } from "@/hooks/use-cms-theme";

// Every admin page mounts its own AdminShell, so the sidebar is rebuilt on each click. Remembering where its list was
// scrolled keeps the menu looking static: it stays exactly where you left it instead of jumping back to the top.
let sidebarScrollTop = 0;
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const ADMIN_NAV = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Inbox", to: "/admin/inbox", icon: Inbox },
  { label: "Hero Slides", to: "/admin/hero-slides", icon: Sparkles },
  { label: "Business Units", to: "/admin/business-units", icon: Layers },
  { label: "Pages", to: "/admin/pages", icon: FileText },
  { label: "Country Showcase", to: "/admin/country-showcase", icon: Globe2 },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Team", to: "/admin/team", icon: Users },
  { label: "Blog Posts", to: "/admin/blog", icon: Newspaper },
  { label: "Jobs", to: "/admin/jobs", icon: Briefcase },
  { label: "Applications", to: "/admin/applications", icon: ClipboardList },
  { label: "Responses", to: "/admin/responses", icon: Reply },
  { label: "Media", to: "/admin/media", icon: Images },
  { label: "Access Requests", to: "/admin/access-requests", icon: UserCheck },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Audit Log", to: "/admin/audit", icon: ScrollText },
  { label: "Site Settings", to: "/admin/settings", icon: Settings },
] as const;

export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const user = useAdminUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useCmsSourceAlerts();
  // Applies the saved light/dark choice to <html> for as long as an admin page is on screen.
  useCmsThemeScope();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (hydrated && !user && !getAdminUser()) void navigate({ to: "/admin/login" });
  }, [hydrated, user, navigate]);

  // Close the mobile nav automatically whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // A mouse opens the side panel just by pointing at the menu button; a touch screen opens it with a tap.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const canHover = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const openNav = () => {
    clearTimeout(closeTimer.current);
    setMobileNavOpen(true);
  };
  const closeNavSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMobileNavOpen(false), 220);
  };

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  // Stop the page behind the slide-out menu from scrolling on touch screens.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const handleSignOut = () => {
    void apiFetch("/auth/logout", { method: "POST" })
      .catch(() => {})
      .finally(() => logout());
    void navigate({ to: "/admin/login" });
  };

  const session = user ?? (hydrated ? getAdminUser() : null);

  // Put the desktop sidebar back where it was, and make sure the current page's link is in view.
  const sidebarNavRef = useRef<HTMLElement>(null);
  const hasSession = !!session;
  useIsoLayoutEffect(() => {
    const nav = sidebarNavRef.current;
    if (!nav) return;
    nav.scrollTop = sidebarScrollTop;
    const active = nav.querySelector<HTMLElement>('[data-active="true"]');
    if (active) {
      const top = active.offsetTop;
      const bottom = top + active.offsetHeight;
      if (top < nav.scrollTop) nav.scrollTop = Math.max(0, top - 8);
      else if (bottom > nav.scrollTop + nav.clientHeight) nav.scrollTop = bottom - nav.clientHeight + 8;
    }
    sidebarScrollTop = nav.scrollTop;
  }, [hasSession, pathname]);

  if (!session) {
    return (
      <div className="grid min-h-dvh place-items-center bg-secondary text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }

  // Only admins (and the superuser) ever see Access Requests and the Audit Log.
  // Used by BOTH the desktop sidebar and the mobile menu below.
  const canManageAccess = session.role === "admin" || session.isSuperuser === true;
  // Applicants' details and resumes are personal data: only admins, editors and HR see them.
  const canSeeApplications = canManageAccess || session.role === "editor" || session.role === "hr";
  const navItems = ADMIN_NAV.filter((item) => {
    if (item.to === "/admin/access-requests" || item.to === "/admin/audit") return canManageAccess;
    if (item.to === "/admin/applications" || item.to === "/admin/responses") return canSeeApplications;
    return true;
  });

  return (
    <div className="flex min-h-dvh bg-secondary">
      {/* Fixed to the screen: it never scrolls, moves or resizes with the page. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-20 items-center gap-3 border-b border-border px-6 transition-opacity hover:opacity-80"
          title="Open the public site in a new tab"
        >
          <BrandGlobe size={36} interactive={false} showMotto={false} />
          <div className="leading-tight">
            <p className="font-display text-sm font-extrabold text-primary-deep">BLUEWORLD</p>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-accent">CMS</p>
          </div>
        </a>
        <nav
          ref={sidebarNavRef}
          onScroll={(e) => {
            sidebarScrollTop = e.currentTarget.scrollTop;
          }}
          className="relative flex-1 space-y-1 overflow-y-auto overscroll-contain p-4"
        >
          {navItems.map((item) => {
            const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                data-active={active}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary-deep text-primary-foreground"
                    : "text-foreground/70 hover:bg-primary-soft hover:text-primary-deep",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <Link to="/" className="block rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground">
            ← View public site
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-card pb-3 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-6 sm:pb-4 sm:pt-4">
          <div className="flex min-w-0 items-center gap-3">
            {/* One hover zone around the button AND the panel, so moving from one to the other never counts as leaving. */}
            <div
              className="contents"
              onMouseEnter={() => canHover() && openNav()}
              onMouseLeave={() => canHover() && closeNavSoon()}
            >
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={mobileNavOpen}
                onClick={() => (canHover() ? openNav() : setMobileNavOpen((v) => !v))}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border text-primary-deep transition-colors hover:bg-primary-soft lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              {/* Side panel for screens without the permanent sidebar: floats over the page, never pushes it down. */}
              <AnimatePresence>
                {mobileNavOpen && (
                  <>
                    {/* Touch screens get a dimmed backdrop you can tap to close; a mouse just moves away. */}
                    {!canHover() && (
                      <motion.div
                        key="nav-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setMobileNavOpen(false)}
                        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                      />
                    )}
                    <motion.aside
                      key="nav-panel"
                      initial={{ x: "-100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "-100%" }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      aria-label="Admin navigation"
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={{ left: 0.4, right: 0 }}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -60 || info.velocity.x < -500) setMobileNavOpen(false);
                      }}
                      className="fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[85vw] flex-col border-r border-border bg-card pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] shadow-2xl lg:hidden"
                    >
                      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
                        <a
                          href="/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 items-center gap-3"
                          title="Open the public site in a new tab"
                        >
                          <BrandGlobe size={32} interactive={false} showMotto={false} />
                          <span className="leading-tight">
                            <span className="block font-display text-sm font-extrabold text-primary-deep">
                              BLUEWORLD
                            </span>
                            <span className="block text-[0.6rem] font-bold uppercase tracking-[0.22em] text-accent">
                              CMS
                            </span>
                          </span>
                        </a>
                        <button
                          type="button"
                          aria-label="Close menu"
                          onClick={() => setMobileNavOpen(false)}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-primary-soft"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
                        {navItems.map((item) => {
                          const active =
                            item.to === "/admin"
                              ? pathname === "/admin"
                              : pathname.startsWith(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors",
                                active
                                  ? "bg-primary-deep text-primary-foreground"
                                  : "text-foreground/70 hover:bg-primary-soft hover:text-primary-deep",
                              )}
                            >
                              <item.icon className="h-4 w-4" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </nav>

                      <div className="shrink-0 space-y-3 border-t border-border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-primary-deep">
                              {session.fullName}
                            </p>
                            <p className="text-xs uppercase tracking-[0.14em] text-accent">
                              {session.isSuperuser ? "Master Key" : session.role}
                            </p>
                          </div>
                          <ThemeToggle />
                        </div>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-primary-soft"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                        <Link
                          to="/"
                          className="block text-center text-xs font-semibold text-muted-foreground"
                        >
                          ← View public site
                        </Link>
                      </div>
                    </motion.aside>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold text-primary-deep sm:text-xl">
                {title}
              </h1>
              {description && (
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{description}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {actions}
            <ThemeToggle />
            {/* On phones the name and sign-out live inside the side panel instead */}
            <div className="hidden items-center gap-3 sm:flex">
              <div className="text-right">
                <p className="text-sm font-semibold text-primary-deep">{session.fullName}</p>
                <p className="text-xs uppercase tracking-[0.14em] text-accent">
                  {session.isSuperuser ? "Master Key" : session.role}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-primary-soft"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 sm:pb-6 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-6">
          {description && <p className="mb-4 text-sm text-muted-foreground sm:hidden">{description}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}