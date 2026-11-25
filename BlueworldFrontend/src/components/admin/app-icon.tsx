import { useState } from "react";
import { cn } from "@/lib/utils";

/** An app's icon, or a letter tile when it has none (or the picture will not load). */
export function AppIcon({ name, icon, className }: { name: string; icon?: string | null; className?: string }) {
  const [broken, setBroken] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-xl bg-primary-soft font-display font-extrabold text-primary-deep",
        className,
      )}
    >
      {icon && !broken ? (
        <img
          src={icon}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        letter
      )}
    </span>
  );
}
