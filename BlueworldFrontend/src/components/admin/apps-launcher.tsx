import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutGrid, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppIcon } from "@/components/admin/app-icon";
import { loadCompanyApps, useCompanyApps } from "@/lib/company-apps";

/**
 * The grid button at the top of the CMS (like the Google apps menu).
 * Click it to see every app Blueworld owns; click an app to open it in a new tab.
 * Apps are added and removed on the Company Apps page.
 */
export function AppsLauncher() {
  const { apps, status } = useCompanyApps();
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadCompanyApps();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Blueworld apps"
          title="Blueworld apps"
          onMouseEnter={() => void loadCompanyApps()}
          onFocus={() => void loadCompanyApps()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-foreground/75 transition-colors hover:bg-primary-soft data-[state=open]:bg-primary-soft sm:h-10 sm:w-10"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[min(22rem,calc(100vw-1rem))] rounded-2xl p-0 shadow-lift"
      >
        <div className="max-h-[min(26rem,70dvh)] overflow-y-auto overscroll-contain p-3">
          {status === "loading" && apps.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading apps…</p>
          )}
          {status === "error" && apps.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Could not load the apps. Try again in a moment.</p>
          )}
          {status === "ready" && apps.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No apps added yet. Use “Manage apps” below to add the first one.
            </p>
          )}

          {apps.length > 0 && (
            <ul className="grid grid-cols-3 gap-1">
              {apps.map((app) => (
                <li key={app.id}>
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={app.description || app.name}
                    onClick={() => setOpen(false)}
                    className="flex h-full flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none"
                  >
                    <AppIcon name={app.name} icon={app.icon} className="h-12 w-12 text-lg" />
                    <span className="line-clamp-2 break-words text-xs font-semibold leading-tight text-foreground/85">
                      {app.name}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-2">
          <Link
            to="/admin/apps"
            onClick={() => setOpen(false)}
            className="flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-primary-deep transition-colors hover:bg-primary-soft"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Manage apps
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
