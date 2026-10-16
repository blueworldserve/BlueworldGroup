import { useState } from "react";
import { toast } from "sonner";
import { apiFetch, ENDPOINTS } from "@/lib/api";

const ROLES = ["admin", "editor", "sales", "hr", "viewer"] as const;

export function RoleSelect({ user, onChanged }: { user: { id: string; role: string }; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function change(role: string) {
    setBusy(true);
    try {
      await apiFetch(`${ENDPOINTS.users}/${user.id}/role`, { method: "POST", body: JSON.stringify({ role }) });
      toast.success(`Access level changed to ${role}`);
      await onChanged();
    } catch {
      toast.error("Could not change this access level.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <select
      value={user.role}
      disabled={busy}
      onChange={(e) => void change(e.target.value)}
      className="rounded-md border border-border bg-background px-2 py-1 text-sm font-semibold"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}