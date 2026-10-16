import type { ReactNode } from "react";
import { useMe } from "@/hooks/use-me";

export function WriteGate({
  resource,
  notice = true,
  children,
}: {
  resource: string;
  notice?: boolean;
  children: ReactNode;
}) {
  const me = useMe();
  const can = !!me?.writable?.includes(resource);
  return (
    <>
      {notice && me && !can && (
        <p className="mb-4 rounded-xl border border-border bg-primary-soft px-4 py-3 text-sm text-foreground/75">
          You have view-only access to this section.
        </p>
      )}
      <fieldset disabled={!can} className="contents">
        {children}
      </fieldset>
    </>
  );
}