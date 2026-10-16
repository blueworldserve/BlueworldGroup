import { useEffect, useState } from "react";
import { apiFetch, ENDPOINTS } from "@/lib/api";

export interface Me {
  role: string;
  isSuperuser: boolean;
  writable: string[];
}

/** Always asks the server who you are, so a role change shows up without re-login. */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const data = (await apiFetch(ENDPOINTS.authMe)) as Me;
        if (live) setMe(data);
      } catch {
        /* stays null → treated as read-only */
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return me;
}

export function useCanWrite(resource: string): boolean {
  return !!useMe()?.writable?.includes(resource);
}