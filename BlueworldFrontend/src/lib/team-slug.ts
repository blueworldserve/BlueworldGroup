import type { TeamMember } from "@/lib/types";

export function memberSlug(m: Pick<TeamMember, "id" | "name" | "slug">): string {
  const existing = (m.slug ?? "").trim();
  if (existing && existing !== "new-leader") return existing;
  const fromName = (m.name ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return fromName || String(m.id);
}