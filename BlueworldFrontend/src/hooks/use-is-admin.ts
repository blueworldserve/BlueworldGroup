import { useEffect, useState } from "react";
import { getAdminUser, useAdminUser } from "@/hooks/use-admin-auth";

/**
 * True for admins and the superuser (the seeded superuser has the admin role).
 * Used to hide actions editors and viewers aren't allowed to perform. The
 * backend enforces the same rule; this only keeps the buttons out of sight.
 */
export function useIsAdmin(): boolean {
  const user = useAdminUser();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const session = user ?? (hydrated ? getAdminUser() : null);
  return session?.role === "admin" || (session as { isSuperuser?: boolean } | null)?.isSuperuser === true;
}